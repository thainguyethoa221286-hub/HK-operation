import type { Room, Account, HistoryEntry, KeyLog, TaskChart, TaskChartCell, MaintenanceIssue, LostFoundItem, OverdueHistoryRow, SupplyBoardItem, InspectionLogRow, LinenChangeHistoryRow, BroadcastTaskData } from './types';
// TOÀN BỘ 4 GIAI ĐOẠN đã chuyển sang Supabase — xem lib/supabaseHkpro.ts.
// GIAI ĐOẠN 1: Đăng nhập + Bảng phòng/dọn phòng. GIAI ĐOẠN 2: Giao nhận chìa + Task Chart.
// GIAI ĐOẠN 3: Bảo trì + Lost & Found. GIAI ĐOẠN 4: Note Board + Lịch sử kiểm phòng + Task khẩn.
// Google Sheets/Apps Script (JSONP) KHÔNG còn được dùng nữa (chỉ còn hàm jsonp() giữ lại phòng khi cần).
import {
  sbFetchRooms, sbUpdateRoomField, sbUpdateRoomFields, sbBulkUpdateRoomsFromAI,
  sbLogin, sbLoginByPassword, sbListAccounts, sbUpdateAccountModules,
  sbLogTaskAction, sbGetTaskHistory, sbGetTodayHistory,
  sbGetKeyLogs, sbBorrowKey, sbReturnKey, sbCloseAllOpenKeys,
  sbGetTaskCharts, sbCreateTaskChart, sbDeleteTaskChart, sbUpdateTaskChartMeta, sbUpdateTaskCell,
  sbGetMaintenanceIssues, sbCreateMaintenanceIssue, sbUpdateMaintenanceIssue, sbDeleteMaintenanceIssue,
  sbGetLostFoundItems, sbCreateLostFoundItem, sbUpdateLostFoundItem, sbDeleteLostFoundItem,
  sbGetOverdueHistory, sbDeleteOverdueHistoryRow, sbClearOverdueHistory, sbGetLinenChangeHistory,
  sbGetSuppliesBoard, sbUpdateSupplyItem,
  sbStartInspectionLog, sbEndInspectionLog, sbGetInspectionLogs,
  sbSetBroadcastTask, sbClearBroadcastTask, sbGetBroadcastTask, sbCompleteBroadcastTask,
} from './supabaseHkpro';

// Dán URL Apps Script /exec vào đây (dùng chung backend Code.gs với bản HTML trước đó)
export const API_URL = 'https://script.google.com/macros/s/AKfycbzl3d32rhwekoEpknl3PdcsFXvcZ38ftARDDMjAiSf-MVbLBhqYFf-Vi4AMJLMFy5hkKQ/exec';

function jsonp<T = any>(action: string, params: Record<string, string>, timeoutMs = 8000): Promise<T | null> {
  return new Promise((resolve, reject) => {
    if (!API_URL) { resolve(null); return; }
    const cbName = 'cb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    let settled = false;

    const cleanup = () => {
      delete (window as any)[cbName];
      script.remove();
      clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Hết thời gian chờ phản hồi từ Google Sheet (kiểm tra lại quyền truy cập Apps Script hoặc URL)'));
    }, timeoutMs);

    (window as any)[cbName] = (data: T) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data);
    };

    const qs = new URLSearchParams({ action, callback: cbName, ...params }).toString();
    const script = document.createElement('script');
    script.src = API_URL + '?' + qs;
    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Không tải được script từ Apps Script (network error)'));
    };
    document.body.appendChild(script);
  });
}

export async function fetchRooms(): Promise<Room[]> {
  return sbFetchRooms();
}

export async function updateRoomField(maPhong: string, field: string, value: string) {
  await sbUpdateRoomField(maPhong, field, value);
}

/** Ghi nhiều field cùng lúc cho 1 phòng (VD: bấm "Hoàn thành" cần ghi EndTime+Duration+TaskStatus+HkStatus). */
export async function updateRoomFields(maPhong: string, fields: Record<string, string>) {
  await sbUpdateRoomFields(maPhong, fields);
}

/** Ghi 1 dòng lịch sử mới (KHÔNG ghi đè) — dùng mỗi khi nhân viên bấm
 *  Bắt đầu/Hoàn thành/Báo dơ lại/DND/Từ chối/Làm lại phòng, để có nhật ký nhiều lần trong ngày. */
export async function logTaskAction(maPhong: string, nhanVien: string, hanhDong: string, chiTiet: string = '') {
  await sbLogTaskAction(maPhong, nhanVien, hanhDong, chiTiet);
}

/** Lấy lịch sử thao tác TRONG NGÀY của 1 phòng, mới nhất lên đầu */
export async function getTaskHistory(maPhong: string): Promise<HistoryEntry[]> {
  return sbGetTaskHistory(maPhong);
}

/** Lấy TOÀN BỘ lịch sử thao tác TRONG NGÀY HÔM NAY của TẤT CẢ phòng (không lọc theo 1 phòng) —
 *  dùng cho Housekeeping Daily Report để liệt kê đủ MỌI lần bấm bật DND/Từ chối (RF) trong ngày. */
export async function getTodayHistory(): Promise<HistoryEntry[]> {
  return sbGetTodayHistory();
}

/** Lấy toàn bộ lượt giao/nhận chìa TRONG NGÀY HÔM NAY (mọi nhân viên) — dùng để vẽ trạng thái 9 thẻ chìa */
export async function getKeyLogs(): Promise<KeyLog[]> {
  return sbGetKeyLogs();
}

/** Mượn 1 bộ chìa — ghi 1 dòng mới, trạng thái "Đang giữ" */
export async function borrowKey(nhanVien: string, keyLabel: string): Promise<{ success: boolean; error?: string }> {
  return sbBorrowKey(nhanVien, keyLabel);
}

/** Trả chìa — cập nhật đúng dòng (theo rowIndex) sang trạng thái "Đã trả" */
export async function returnKey(rowIndex: number): Promise<{ success: boolean; error?: string }> {
  return sbReturnKey(rowIndex);
}

/** Đăng nhập bằng ID + mật khẩu — đối chiếu bảng hkpro_accounts trên Supabase qua RPC (bảo mật) */
export async function login(id: string, password: string): Promise<{ success: boolean; account?: Account; error?: string }> {
  return sbLogin(id, password);
}

/** Đăng nhập CHỈ bằng mật khẩu (không cần nhập tên đăng nhập) — hệ thống tự dò đúng tài khoản khớp mật khẩu */
export async function loginByPassword(password: string): Promise<{ success: boolean; account?: Account; error?: string }> {
  return sbLoginByPassword(password);
}

/** Lấy danh sách tài khoản (chỉ id + hoTen + vaiTro, KHÔNG có mật khẩu) — dùng để lấy danh sách
 *  nhân viên ĐỘNG cho màn Phân công, thay vì hardcode cứng trong code. */
export async function listAccounts(): Promise<Account[]> {
  return sbListAccounts();
}

/** Cập nhật danh sách module 1 tài khoản được phép vào — dùng cho Ma trận phân quyền ở Cài đặt.
 *  Truyền mảng RỖNG = xoá tuỳ chỉnh, quay về đúng mặc định theo Role. */
export async function updateAccountModules(id: string, modules: string[]): Promise<{ success: boolean }> {
  return sbUpdateAccountModules(id, modules);
}

/** Đồng bộ AI đọc PDF — áp trạng thái phòng mới lên bảng Phòng + đóng các lượt chìa còn "Đang giữ"
 *  + snapshot DND/RF và Báo cáo thay ga sang lịch sử "hôm qua" + xoá sạch Lịch sử kiểm phòng trong
 *  ngày (TOÀN BỘ đã chuyển sang Supabase từ Giai đoạn 4 — xem sbBulkUpdateRoomsFromAI). KHÔNG còn
 *  gọi Apps Script phụ nữa. */
export async function bulkUpdateFromAI(chunk: any[]): Promise<{ success: boolean; updated?: number; notFound?: string[]; error?: string } | null> {
  try {
    const { updated, notFound } = await sbBulkUpdateRoomsFromAI(chunk);
    try {
      await sbCloseAllOpenKeys();
    } catch (err) {
      console.warn('[HK PRO] Đóng lượt chìa cũ (Đồng bộ AI) lỗi:', err);
    }
    return { success: true, updated, notFound };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Lỗi không xác định' };
  }
}

export const AI_SYSTEM_PROMPT = `Bạn là một trợ lý AI chuyên phân tích dữ liệu khách sạn cho hệ thống HK PRO.
Nhiệm vụ của bạn là đọc nội dung file PDF báo cáo trạng thái phòng được tải lên, trích xuất dữ liệu của tất cả các phòng và trả về dạng JSON duy nhất.

---

### QUY TẮC MÁP DỮ LIỆU (MAPPING RULES)

1. Trạng thái Housekeeping (hkStatus) - BẮT BUỘC chọn 1 trong 5 giá trị sau:
   - "Phòng dơ" (Tương ứng: Dirty, DI, Uncleaned, Bẩn)
   - "Phòng đang dọn" (Tương ứng: Cleaning, In Progress, Đang dọn)
   - "Phòng sạch" (Tương ứng: Inspecting, Touch up, Cần kiểm tra)
   - "Đã kiểm tra" (Tương ứng: Clean, Inspected, CI, Sạch)
   - "Phòng sửa chữa (OOO)" (Tương ứng: Out of Order, OOO, Repair, Maintenance, Hỏng)

2. Trạng thái Front Office / Lễ tân (foStatus) - BẮT BUỘC chọn 1 trong 5 giá trị sau:
   - "Occupied" (Tương ứng: OCC, Có khách, In-house, Chiếm lĩnh)
   - "Due out" (Tương ứng: Expected Departure, ED, Check-out, Dep, Sắp out)
   - "Arrival" (Tương ứng: Expected Arrival, EA, Check-in, Arr, Sắp đến)
   - "Due out/ARR" (Tương ứng: Day Use, DU, Use-in-day)
   - "Vacant" (Tương ứng: VAC, Ready, Phòng trống)

3. Định dạng Số phòng (id):
   - Giữ nguyên số phòng dạng chuỗi text (Ví dụ: "102", "204", "777", "888", "999").
   - Xác định Tầng (floor) dựa trên số đầu tiên của phòng (Ví dụ: Phòng "102" -> floor: 1, Phòng "902" -> floor: 9).

---

### YÊU CẦU ĐẦU RA (OUTPUT FORMAT)

RẤT QUAN TRỌNG: Chỉ trả về một mảng JSON thuần túy (JSON Array). KHÔNG kèm theo lời mở đầu, lời giải thích, KHÔNG bọc trong khối code markdown (như \`\`\`json ... \`\`\`).

Cấu trúc JSON mẫu:
[
  { "id": "102", "floor": 1, "hkStatus": "Phòng dơ", "foStatus": "Occupied", "note": "Check-out 12:00" },
  { "id": "202", "floor": 2, "hkStatus": "Đã kiểm tra", "foStatus": "Vacant", "note": "" }
]`;

export async function readPdfWithAI(file: File): Promise<any[]> {
  const base64Data: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(',')[1]);
    r.onerror = () => rej(new Error('Read failed'));
    r.readAsDataURL(file);
  });

  // Gọi qua API route của chính app (server-side) — tránh lỗi CORS và giữ kín API key
  const response = await fetch('/api/sync-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Đồng bộ AI thất bại');
  }
  return data.rooms;
}

/** ===== MODULE TASK CHART ===== */

/** Lấy toàn bộ bảng Task Chart + toàn bộ ô dữ liệu (mọi bảng) trong 1 lần gọi */
export async function getTaskCharts(): Promise<{ charts: TaskChart[]; cells: TaskChartCell[] }> {
  return sbGetTaskCharts();
}

/** Tạo 1 bảng Task Chart mới */
export async function createTaskChart(title: string): Promise<{ success: boolean; chart?: TaskChart; error?: string }> {
  return sbCreateTaskChart(title);
}

/** Xoá 1 bảng Task Chart (và toàn bộ ô dữ liệu của bảng đó) */
export async function deleteTaskChart(chartId: string): Promise<{ success: boolean; error?: string }> {
  return sbDeleteTaskChart(chartId);
}

/** Đổi tên / đổi bảng màu của 1 Task Chart */
export async function updateTaskChartMeta(chartId: string, title: string, palette: number): Promise<{ success: boolean }> {
  return sbUpdateTaskChartMeta(chartId, title, palette);
}

/** Ghi 1 ô (checkbox + ghi chú) của 1 phòng trong 1 Task Chart — auto-save */
export async function updateTaskCell(chartId: string, maPhong: string, checked: boolean, note: string): Promise<{ success: boolean }> {
  return sbUpdateTaskCell(chartId, maPhong, checked, note);
}

/** ===== MODULE MAINTENANCE ===== */

export async function getMaintenanceIssues(): Promise<MaintenanceIssue[]> {
  return sbGetMaintenanceIssues();
}

export async function createMaintenanceIssue(
  roomNo: string,
  issueDescription: string,
  reportedBy: string
): Promise<{ success: boolean; issue?: MaintenanceIssue; error?: string }> {
  return sbCreateMaintenanceIssue(roomNo, issueDescription, reportedBy);
}

export async function updateMaintenanceIssue(
  id: number,
  changes: { issueDescription?: string; status?: string; dueDate?: string }
): Promise<{ success: boolean }> {
  return sbUpdateMaintenanceIssue(id, changes);
}

export async function deleteMaintenanceIssue(id: number): Promise<{ success: boolean }> {
  return sbDeleteMaintenanceIssue(id);
}

/** ===== MODULE LOST & FOUND ===== */

export async function getLostFoundItems(): Promise<LostFoundItem[]> {
  return sbGetLostFoundItems();
}

export async function createLostFoundItem(item: {
  dateFound: string; roomNo: string; itemDescription: string; foundBy: string; status: string; notes: string;
}): Promise<{ success: boolean; item?: LostFoundItem; error?: string }> {
  return sbCreateLostFoundItem(item);
}

export async function updateLostFoundItem(
  id: number,
  item: { dateFound: string; roomNo: string; itemDescription: string; foundBy: string; status: string; notes: string }
): Promise<{ success: boolean }> {
  return sbUpdateLostFoundItem(id, item);
}

export async function deleteLostFoundItem(id: number): Promise<{ success: boolean }> {
  return sbDeleteLostFoundItem(id);
}

/** ===== MODULE NOTE BOARD (Giai đoạn 4 — Supabase) ===== */

// Báo cáo lịch thay ga/giường "hôm qua" — tự động ghi khi Đồng bộ AI chạy, giữ đúng 1 ngày
export async function getLinenChangeHistory(): Promise<LinenChangeHistoryRow[]> {
  return sbGetLinenChangeHistory();
}

// Bảng 1 — Lịch DND/RF "hôm qua" (tự động ghi khi Đồng bộ AI chạy)
export async function getOverdueHistory(): Promise<OverdueHistoryRow[]> {
  return sbGetOverdueHistory();
}
export async function deleteOverdueHistoryRow(id: number): Promise<{ success: boolean }> {
  return sbDeleteOverdueHistoryRow(id);
}
export async function clearOverdueHistory(): Promise<{ success: boolean }> {
  return sbClearOverdueHistory();
}

// Bảng 3 — Dụng cụ & vật tư đặc biệt (13 mục cố định)
export async function getSuppliesBoard(): Promise<SupplyBoardItem[]> {
  return sbGetSuppliesBoard();
}
export async function updateSupplyItem(label: string, value: string): Promise<{ success: boolean }> {
  return sbUpdateSupplyItem(label, value);
}

/** ===== LỊCH SỬ KIỂM PHÒNG CỦA GIÁM SÁT/ADMIN (Giai đoạn 4 — Supabase, chỉ trong ngày) ===== */

export async function startInspectionLog(roomNo: string, giamSat: string): Promise<{ success: boolean }> {
  return sbStartInspectionLog(roomNo, giamSat);
}

export async function endInspectionLog(roomNo: string, status: string): Promise<{ success: boolean }> {
  return sbEndInspectionLog(roomNo, status);
}

export async function getInspectionLogs(): Promise<InspectionLogRow[]> {
  return sbGetInspectionLogs();
}

/** ===== TASK CHỈ ĐẠO ĐẶC BIỆT CỦA GIÁM SÁT (Broadcast — Giai đoạn 4, Supabase) ===== */

// Giám sát/Admin gửi 1 task khẩn — tự động thay thế task đang active trước đó (nếu có)
export async function setBroadcastTask(content: string): Promise<{ success: boolean }> {
  return sbSetBroadcastTask(content);
}

// Huỷ task đang active (VD gửi nhầm) — mọi nhân viên sẽ hết thấy bảng đỏ ngay
export async function clearBroadcastTask(): Promise<{ success: boolean }> {
  return sbClearBroadcastTask();
}

export async function getBroadcastTask(): Promise<BroadcastTaskData | null> {
  return sbGetBroadcastTask();
}

// Nhân viên bấm HOÀN THÀNH — ghi nhận đã xong, hiện lên "Tiến độ dọn phòng" cho Giám sát theo dõi
export async function completeBroadcastTask(staff: string): Promise<{ success: boolean }> {
  return sbCompleteBroadcastTask(staff);
}
