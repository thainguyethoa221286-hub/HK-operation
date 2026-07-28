import type { Room, Account, HistoryEntry, KeyLog, TaskChart, TaskChartCell, MaintenanceIssue } from './types';
import { SAMPLE_ROOMS } from './sampleData';

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
  if (!API_URL) return SAMPLE_ROOMS;
  const r = await jsonp<{ success: boolean; rooms?: any[]; error?: string }>('getRooms', {});
  console.log('[HK PRO] Phản hồi getRooms từ Apps Script:', r);
  if (!r) {
    throw new Error('Không nhận được phản hồi từ Apps Script (r = null)');
  }
  if (!r.success || !r.rooms) {
    throw new Error('Apps Script báo lỗi: ' + (r.error || 'không có trường "rooms" trong phản hồi'));
  }
  // Ép toàn bộ trường về dạng chữ — Google Sheets có thể tự lưu ô toàn số (vd MaPhong)
  // thành kiểu Number, phá vỡ mọi hàm xử lý chuỗi (.includes, .toUpperCase...) ở phía sau.
  return r.rooms.map((row) => ({
    ...row,
    MaPhong: String(row.MaPhong ?? ''),
    Tang: String(row.Tang ?? ''),
    LoaiPhong: String(row.LoaiPhong ?? ''),
    HkStatus: String(row.HkStatus ?? ''),
    MorningStatus: String(row.MorningStatus ?? '') || String(row.HkStatus ?? ''),
    FoStatus: String(row.FoStatus ?? ''),
    NgayO: String(row.NgayO ?? ''),
    NhanVienPhuTrach: String(row.NhanVienPhuTrach ?? ''),
    GhiChu: String(row.GhiChu ?? ''),
    GhiChuNV: String(row.GhiChuNV ?? ''),
    GhiChuAdmin: String(row.GhiChuAdmin ?? ''),
    GhiChuSuaChua: String(row.GhiChuSuaChua ?? ''),
    GhiChuNVHomQua: String(row.GhiChuNVHomQua ?? ''),
    GhiChuAdminHomQua: String(row.GhiChuAdminHomQua ?? ''),
    Flags: String(row.Flags ?? ''),
    StartTime: String(row.StartTime ?? ''),
    EndTime: String(row.EndTime ?? ''),
    Duration: String(row.Duration ?? ''),
    TaskStatus: String(row.TaskStatus ?? '') || 'Chưa dọn',
    SafeStatus: String(row.SafeStatus ?? '') || 'Chưa kiểm',
    LinenChange: String(row.LinenChange ?? ''),
    TrolleyCode: String(row.TrolleyCode ?? ''),
    VacuumFloor: String(row.VacuumFloor ?? ''),
    isInspecting: false,
  })) as Room[];
}

export async function updateRoomField(maPhong: string, field: string, value: string) {
  if (!API_URL) return;
  await jsonp('updateRoom', { maPhong, field, value });
}

/** Ghi nhiều field cùng lúc cho 1 phòng (VD: bấm "Hoàn thành" cần ghi EndTime+Duration+TaskStatus+HkStatus).
 *  Gọi song song nhiều request updateRoom thay vì thêm action mới bên Code.gs — giữ backend đơn giản. */
export async function updateRoomFields(maPhong: string, fields: Record<string, string>) {
  if (!API_URL) return;
  await Promise.all(Object.entries(fields).map(([field, value]) => jsonp('updateRoom', { maPhong, field, value })));
}

/** Ghi 1 dòng lịch sử mới (KHÔNG ghi đè) vào tab "LichSuDon" — dùng mỗi khi nhân viên bấm
 *  Bắt đầu/Hoàn thành/Báo dơ lại/DND/Từ chối/Làm lại phòng, để có nhật ký nhiều lần trong ngày. */
export async function logTaskAction(maPhong: string, nhanVien: string, hanhDong: string, chiTiet: string = '') {
  if (!API_URL) return;
  await jsonp('logTaskAction', { maPhong, nhanVien, hanhDong, chiTiet });
}

/** Lấy lịch sử thao tác TRONG NGÀY của 1 phòng, mới nhất lên đầu */
export async function getTaskHistory(maPhong: string): Promise<HistoryEntry[]> {
  if (!API_URL) return [];
  const r = await jsonp<{ success: boolean; history?: HistoryEntry[] }>('getTaskHistory', { maPhong });
  return r?.history || [];
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

/** Đăng nhập bằng ID + mật khẩu, đối chiếu tab "TaiKhoan" trên Google Sheet qua Code.gs */
export async function login(id: string, password: string): Promise<{ success: boolean; account?: Account; error?: string }> {
  if (!API_URL) return { success: false, error: 'Chưa cấu hình API_URL' };
  const r = await jsonp<{ success: boolean; account?: Account; error?: string }>('login', { id, password });
  if (!r) return { success: false, error: 'Không nhận được phản hồi từ Apps Script' };
  return r;
}

/** Đăng nhập CHỈ bằng mật khẩu (không cần nhập tên đăng nhập) — hệ thống tự dò đúng tài khoản khớp mật khẩu */
export async function loginByPassword(password: string): Promise<{ success: boolean; account?: Account; error?: string }> {
  if (!API_URL) return { success: false, error: 'Chưa cấu hình API_URL' };
  const r = await jsonp<{ success: boolean; account?: Account; error?: string }>('loginByPassword', { password });
  if (!r) return { success: false, error: 'Không nhận được phản hồi từ Apps Script' };
  return r;
}

/** Lấy danh sách tài khoản (chỉ id + hoTen + vaiTro, KHÔNG có mật khẩu) — dùng để lấy danh sách
 *  nhân viên ĐỘNG cho màn Phân công, thay vì hardcode cứng trong code. */
export async function listAccounts(): Promise<Account[]> {
  if (!API_URL) return [];
  const r = await jsonp<{ success: boolean; accounts?: Account[] }>('listAccounts', {});
  return r?.accounts || [];
}

export async function bulkUpdateFromAI(chunk: any[]): Promise<{ success: boolean; updated?: number; notFound?: string[]; error?: string } | null> {
  if (!API_URL) return { success: true, updated: chunk.length };
  const result = await jsonp<{ success: boolean; updated?: number; notFound?: string[]; error?: string }>(
    'bulkUpdateFromAI',
    { data: JSON.stringify(chunk) }
  );
  return result;
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
