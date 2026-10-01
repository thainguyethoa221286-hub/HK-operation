import type { Room, Account, HistoryEntry, KeyLog, TaskChart, TaskChartCell, MaintenanceIssue, LostFoundItem, OverdueHistoryRow, SupplyBoardItem, InspectionLogRow, LinenChangeHistoryRow, BroadcastTaskData } from './types';
// GIAI ĐOẠN 1 (Đăng nhập + Bảng phòng/dọn phòng) đã chuyển sang Supabase — xem lib/supabaseHkpro.ts.
// Các module khác (Giao nhận chìa, Task Chart, Maintenance, Lost&Found, Note Board...) vẫn
// chạy Google Sheets/Apps Script (JSONP) bên dưới cho tới khi tới lượt giai đoạn của chúng.
import {
  sbFetchRooms, sbUpdateRoomField, sbUpdateRoomFields, sbBulkUpdateRoomsFromAI,
  sbLogin, sbLoginByPassword, sbListAccounts, sbUpdateAccountModules,
  sbLogTaskAction, sbGetTaskHistory, sbGetTodayHistory,
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
  if (!API_URL) return [];
  const r = await jsonp<{ success: boolean; logs?: KeyLog[] }>('getKeyLogs', {});
  return r?.logs || [];
}

/** Mượn 1 bộ chìa — ghi 1 dòng mới, trạng thái "Đang giữ" */
export async function borrowKey(nhanVien: string, keyLabel: string): Promise<{ success: boolean; error?: string }> {
  if (!API_URL) return { success: false, error: 'Chưa cấu hình API_URL' };
  const r = await jsonp<{ success: boolean; error?: string }>('borrowKey', { nhanVien, keyLabel });
  return r || { success: false, error: 'Không nhận được phản hồi' };
}

/** Trả chìa — cập nhật đúng dòng (theo rowIndex) sang trạng thái "Đã trả" */
export async function returnKey(rowIndex: number): Promise<{ success: boolean; error?: string }> {
  if (!API_URL) return { success: false, error: 'Chưa cấu hình API_URL' };
  const r = await jsonp<{ success: boolean; error?: string }>('returnKey', { rowIndex: String(rowIndex) });
  return r || { success: false, error: 'Không nhận được phản hồi' };
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

/** Đồng bộ AI đọc PDF — áp trạng thái phòng mới lên bảng Phòng (Supabase, Giai đoạn 1).
 *  Đồng thời GIỮ NGUYÊN lệnh gọi Apps Script cũ (chạy nền, không chặn UI) để các module CHƯA
 *  migrate (Giao nhận chìa, Lịch sử kiểm phòng, Note Board...) vẫn được reset/ghi nhận như trước
 *  cho tới khi các module đó cũng chuyển sang Supabase ở giai đoạn sau. */
export async function bulkUpdateFromAI(chunk: any[]): Promise<{ success: boolean; updated?: number; notFound?: string[]; error?: string } | null> {
  if (API_URL) {
    jsonp('bulkUpdateFromAI', { data: JSON.stringify(chunk) }).catch((err) => {
      console.warn('[HK PRO] Đồng bộ phụ (Giao nhận chìa/Kiểm phòng/Note Board) qua Apps Script lỗi:', err);
    });
  }
  try {
    const { updated, notFound } = await sbBulkUpdateRoomsFromAI(chunk);
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
  if (!API_URL) return { charts: [], cells: [] };
  const r = await jsonp<{ success: boolean; charts?: TaskChart[]; cells?: TaskChartCell[] }>('getTaskCharts', {});
  return { charts: r?.charts || [], cells: r?.cells || [] };
}

/** Tạo 1 bảng Task Chart mới */
export async function createTaskChart(title: string): Promise<{ success: boolean; chart?: TaskChart; error?: string }> {
  if (!API_URL) return { success: false, error: 'Chưa cấu hình API_URL' };
  const r = await jsonp<{ success: boolean; chart?: TaskChart; error?: string }>('createTaskChart', { title });
  return r || { success: false, error: 'Không nhận được phản hồi' };
}

/** Xoá 1 bảng Task Chart (và toàn bộ ô dữ liệu của bảng đó) */
export async function deleteTaskChart(chartId: string): Promise<{ success: boolean; error?: string }> {
  if (!API_URL) return { success: false, error: 'Chưa cấu hình API_URL' };
  const r = await jsonp<{ success: boolean; error?: string }>('deleteTaskChart', { chartId });
  return r || { success: false, error: 'Không nhận được phản hồi' };
}

/** Đổi tên / đổi bảng màu của 1 Task Chart */
export async function updateTaskChartMeta(chartId: string, title: string, palette: number): Promise<{ success: boolean }> {
  if (!API_URL) return { success: false };
  const r = await jsonp<{ success: boolean }>('updateTaskChartMeta', { chartId, title, palette: String(palette) });
  return r || { success: false };
}

/** Ghi 1 ô (checkbox + ghi chú) của 1 phòng trong 1 Task Chart — auto-save */
export async function updateTaskCell(chartId: string, maPhong: string, checked: boolean, note: string): Promise<{ success: boolean }> {
  if (!API_URL) return { success: false };
  const r = await jsonp<{ success: boolean }>('updateTaskCell', { chartId, maPhong, checked: checked ? '1' : '', note });
  return r || { success: false };
}

/** ===== MODULE MAINTENANCE ===== */

export async function getMaintenanceIssues(): Promise<MaintenanceIssue[]> {
  if (!API_URL) return [];
  const r = await jsonp<{ success: boolean; issues?: MaintenanceIssue[]; error?: string }>('getMaintenanceIssues', {});
  console.log('[HK PRO] Phản hồi getMaintenanceIssues từ Apps Script:', r);
  if (!r) throw new Error('Không nhận được phản hồi từ Apps Script (r = null)');
  if (!r.success) throw new Error(r.error || 'Apps Script báo lỗi không rõ nguyên nhân khi lấy danh sách Maintenance');
  return r.issues || [];
}

export async function createMaintenanceIssue(
  roomNo: string,
  issueDescription: string,
  reportedBy: string
): Promise<{ success: boolean; issue?: MaintenanceIssue; error?: string }> {
  if (!API_URL) return { success: false, error: 'Chưa cấu hình API_URL' };
  const r = await jsonp<{ success: boolean; issue?: MaintenanceIssue; error?: string }>('createMaintenanceIssue', {
    roomNo, issueDescription, reportedBy,
  });
  return r || { success: false, error: 'Không nhận được phản hồi' };
}

export async function updateMaintenanceIssue(
  id: number,
  changes: { issueDescription?: string; status?: string; dueDate?: string }
): Promise<{ success: boolean }> {
  if (!API_URL) return { success: false };
  const r = await jsonp<{ success: boolean }>('updateMaintenanceIssue', {
    id: String(id),
    issueDescription: changes.issueDescription ?? '__skip__',
    status: changes.status ?? '__skip__',
    dueDate: changes.dueDate ?? '__skip__',
  });
  return r || { success: false };
}

export async function deleteMaintenanceIssue(id: number): Promise<{ success: boolean }> {
  if (!API_URL) return { success: false };
  const r = await jsonp<{ success: boolean }>('deleteMaintenanceIssue', { id: String(id) });
  return r || { success: false };
}

/** ===== MODULE LOST & FOUND ===== */

export async function getLostFoundItems(): Promise<LostFoundItem[]> {
  if (!API_URL) return [];
  const r = await jsonp<{ success: boolean; items?: LostFoundItem[]; error?: string }>('getLostFoundItems', {});
  if (!r) throw new Error('Không nhận được phản hồi từ Apps Script (r = null)');
  if (!r.success) throw new Error(r.error || 'Apps Script báo lỗi không rõ nguyên nhân khi lấy danh sách Lost & Found');
  return r.items || [];
}

export async function createLostFoundItem(item: {
  dateFound: string; roomNo: string; itemDescription: string; foundBy: string; status: string; notes: string;
}): Promise<{ success: boolean; item?: LostFoundItem; error?: string }> {
  if (!API_URL) return { success: false, error: 'Chưa cấu hình API_URL' };
  const r = await jsonp<{ success: boolean; item?: LostFoundItem; error?: string }>('createLostFoundItem', item);
  return r || { success: false, error: 'Không nhận được phản hồi' };
}

export async function updateLostFoundItem(
  id: number,
  item: { dateFound: string; roomNo: string; itemDescription: string; foundBy: string; status: string; notes: string }
): Promise<{ success: boolean }> {
  if (!API_URL) return { success: false };
  const r = await jsonp<{ success: boolean }>('updateLostFoundItem', { id: String(id), ...item });
  return r || { success: false };
}

export async function deleteLostFoundItem(id: number): Promise<{ success: boolean }> {
  if (!API_URL) return { success: false };
  const r = await jsonp<{ success: boolean }>('deleteLostFoundItem', { id: String(id) });
  return r || { success: false };
}

/** ===== MODULE NOTE BOARD ===== */

// Báo cáo lịch thay ga/giường — tự động ghi khi Đồng bộ AI chạy, giữ đúng 1 ngày (xem Code.gs)
export async function getLinenChangeHistory(): Promise<LinenChangeHistoryRow[]> {
  if (!API_URL) return [];
  const r = await jsonp<{ success: boolean; rows?: LinenChangeHistoryRow[]; error?: string }>('getLinenChangeHistory', {});
  if (!r) throw new Error('Không nhận được phản hồi từ Apps Script');
  if (!r.success) throw new Error(r.error || 'Lỗi khi lấy Báo cáo lịch thay giường');
  return r.rows || [];
}

// Bảng 2 — Lịch thay giường & theo dõi Special (tự động ghi khi Đồng bộ AI chạy)
export async function getOverdueHistory(): Promise<OverdueHistoryRow[]> {
  if (!API_URL) return [];
  const r = await jsonp<{ success: boolean; rows?: OverdueHistoryRow[]; error?: string }>('getOverdueHistory', {});
  if (!r) throw new Error('Không nhận được phản hồi từ Apps Script');
  if (!r.success) throw new Error(r.error || 'Lỗi khi lấy Lịch sử thay giường/Special');
  return r.rows || [];
}
export async function deleteOverdueHistoryRow(id: number): Promise<{ success: boolean }> {
  if (!API_URL) return { success: false };
  const r = await jsonp<{ success: boolean }>('deleteOverdueHistoryRow', { id: String(id) });
  return r || { success: false };
}
export async function clearOverdueHistory(): Promise<{ success: boolean }> {
  if (!API_URL) return { success: false };
  const r = await jsonp<{ success: boolean }>('clearOverdueHistory', {});
  return r || { success: false };
}

// Bảng 3 — Dụng cụ & vật tư đặc biệt (10 mục cố định)
export async function getSuppliesBoard(): Promise<SupplyBoardItem[]> {
  if (!API_URL) return [];
  const r = await jsonp<{ success: boolean; items?: SupplyBoardItem[]; error?: string }>('getSuppliesBoard', {});
  if (!r) throw new Error('Không nhận được phản hồi từ Apps Script');
  if (!r.success) throw new Error(r.error || 'Lỗi khi lấy Bảng dụng cụ & vật tư');
  return r.items || [];
}
export async function updateSupplyItem(label: string, value: string): Promise<{ success: boolean }> {
  if (!API_URL) return { success: false };
  const r = await jsonp<{ success: boolean }>('updateSupplyItem', { label, value });
  return r || { success: false };
}

/** ===== LỊCH SỬ KIỂM PHÒNG CỦA GIÁM SÁT/ADMIN ===== */

export async function startInspectionLog(roomNo: string, giamSat: string): Promise<{ success: boolean }> {
  if (!API_URL) return { success: false };
  const r = await jsonp<{ success: boolean }>('startInspectionLog', { roomNo, giamSat });
  return r || { success: false };
}

export async function endInspectionLog(roomNo: string, status: string): Promise<{ success: boolean }> {
  if (!API_URL) return { success: false };
  const r = await jsonp<{ success: boolean }>('endInspectionLog', { roomNo, status });
  return r || { success: false };
}

export async function getInspectionLogs(): Promise<InspectionLogRow[]> {
  if (!API_URL) return [];
  const r = await jsonp<{ success: boolean; rows?: InspectionLogRow[]; error?: string }>('getInspectionLogs', {});
  if (!r) throw new Error('Không nhận được phản hồi từ Apps Script');
  if (!r.success) throw new Error(r.error || 'Lỗi khi lấy Lịch sử kiểm phòng');
  return r.rows || [];
}

/** ===== TASK CHỈ ĐẠO ĐẶC BIỆT CỦA GIÁM SÁT (Broadcast) ===== */

// Giám sát/Admin gửi 1 task khẩn — tự động thay thế task đang active trước đó (nếu có)
export async function setBroadcastTask(content: string): Promise<{ success: boolean }> {
  if (!API_URL) return { success: false };
  const r = await jsonp<{ success: boolean }>('setBroadcastTask', { content });
  return r || { success: false };
}

// Huỷ task đang active (VD gửi nhầm) — mọi nhân viên sẽ hết thấy bảng đỏ ngay
export async function clearBroadcastTask(): Promise<{ success: boolean }> {
  if (!API_URL) return { success: false };
  const r = await jsonp<{ success: boolean }>('clearBroadcastTask', {});
  return r || { success: false };
}

export async function getBroadcastTask(): Promise<BroadcastTaskData | null> {
  if (!API_URL) return null;
  const r = await jsonp<{ success: boolean; task?: BroadcastTaskData }>('getBroadcastTask', {});
  return r?.task || null;
}

// Nhân viên bấm HOÀN THÀNH — ghi nhận đã xong, hiện lên "Tiến độ dọn phòng" cho Giám sát theo dõi
export async function completeBroadcastTask(staff: string): Promise<{ success: boolean }> {
  if (!API_URL) return { success: false };
  const r = await jsonp<{ success: boolean }>('completeBroadcastTask', { staff });
  return r || { success: false };
}
