/**
 * ============================================================
 *  supabaseHkpro.ts — GIAI ĐOẠN 1: Đăng nhập + Bảng phòng/dọn phòng
 *  chạy trên Supabase (project riêng của HK Operation) thay cho
 *  Google Sheets + Apps Script (JSONP).
 * ============================================================
 *  File này chỉ chứa phần ĐỌC/GHI DỮ LIỆU — lib/api.ts vẫn là nơi
 *  DUY NHẤT các component gọi vào (giữ nguyên tên hàm/tham số), chỉ
 *  đổi "ruột bên trong" từ JSONP sang Supabase cho các hàm Giai đoạn 1.
 *  Các module CHƯA migrate (Giao nhận chìa, Task Chart, Maintenance,
 *  Lost&Found, Note Board, Kiểm phòng, Task khẩn...) vẫn chạy Google
 *  Sheets như cũ cho tới khi tới lượt của từng giai đoạn sau.
 * ============================================================
 */
import { supabase } from './supabaseClient';
import type {
  Room, Account, HistoryEntry, KeyLog, TaskChart, TaskChartCell, MaintenanceIssue, LostFoundItem,
  OverdueHistoryRow, LinenChangeHistoryRow, SupplyBoardItem, InspectionLogRow, BroadcastTaskData, Group,
} from './types';
import { DEFAULT_ASSIGN_GROUPS } from './types';

// Chuyển mọi giá trị input (kể cả '', null, undefined) thành chuỗi rỗng an
// toàn để hiển thị — tránh hiện chữ "null"/"undefined" ngoài màn hình.
function str(v: any): string {
  return v === null || v === undefined ? '' : String(v);
}

function roomRowToRoom(row: any): Room {
  const flags = str(row.flags);
  return {
    MaPhong: str(row.ma_phong),
    Tang: str(row.tang),
    LoaiPhong: str(row.loai_phong),
    HkStatus: str(row.hk_status) as any,
    MorningStatus: (str(row.morning_status) || str(row.hk_status)) as any,
    FoStatus: str(row.fo_status) as any,
    NgayO: str(row.ngay_o),
    NhanVienPhuTrach: str(row.nhan_vien_phu_trach),
    GhiChu: str(row.ghi_chu),
    GhiChuNV: str(row.ghi_chu_nv),
    GhiChuSuaChua: str(row.ghi_chu_sua_chua),
    GhiChuNVHomQua: str(row.ghi_chu_nv_hom_qua),
    GhiChuAdminHomQua: str(row.ghi_chu_admin_hom_qua),
    GhiChuAdmin: str(row.ghi_chu_admin),
    Flags: flags,
    StartTime: str(row.start_time),
    EndTime: str(row.end_time),
    Duration: str(row.duration),
    TaskStatus: (str(row.task_status) || 'Chưa dọn') as any,
    SafeStatus: (str(row.safe_status) || 'Chưa kiểm') as any,
    LinenChange: str(row.linen_change),
    TrolleyCode: str(row.trolley_code),
    VacuumFloor: str(row.vacuum_floor),
    isInspecting: flags.split(',').map((f) => f.trim()).includes('DangKiem'),
  } as Room;
}

/** Field (app, PascalCase) -> cột Supabase (snake_case) — dùng cho updateRoomField */
const ROOM_FIELD_COL: Record<string, string> = {
  HkStatus: 'hk_status', FoStatus: 'fo_status', LoaiKhach: 'loai_khach', NgayO: 'ngay_o',
  NhanVienPhuTrach: 'nhan_vien_phu_trach', GhiChu: 'ghi_chu', Flags: 'flags', GhiChuNV: 'ghi_chu_nv',
  StartTime: 'start_time', EndTime: 'end_time', Duration: 'duration', TaskStatus: 'task_status',
  SafeStatus: 'safe_status', LinenChange: 'linen_change', TrolleyCode: 'trolley_code',
  VacuumFloor: 'vacuum_floor', GhiChuAdmin: 'ghi_chu_admin', MorningStatus: 'morning_status',
  GhiChuNgay: 'ghi_chu_ngay', GhiChuSuaChua: 'ghi_chu_sua_chua',
  GhiChuNVHomQua: 'ghi_chu_nv_hom_qua', GhiChuAdminHomQua: 'ghi_chu_admin_hom_qua',
};

export async function sbFetchRooms(): Promise<Room[]> {
  const { data, error } = await supabase.from('hkpro_rooms').select('*').order('ma_phong');
  if (error) throw new Error('Supabase getRooms lỗi: ' + error.message);
  return (data || []).map(roomRowToRoom);
}

export async function sbUpdateRoomField(maPhong: string, field: string, value: string): Promise<void> {
  const col = ROOM_FIELD_COL[field];
  if (!col) return; // field không hợp lệ -> bỏ qua êm, giống hành vi cũ trả lỗi nhưng không throw ra UI
  const { error } = await supabase.from('hkpro_rooms').update({ [col]: value, updated_at: new Date().toISOString() }).eq('ma_phong', maPhong);
  if (error) throw new Error('Supabase updateRoom lỗi: ' + error.message);
}

export async function sbUpdateRoomFields(maPhong: string, fields: Record<string, string>): Promise<void> {
  const row: Record<string, any> = { updated_at: new Date().toISOString() };
  Object.entries(fields).forEach(([field, value]) => {
    const col = ROOM_FIELD_COL[field];
    if (col) row[col] = value;
  });
  const { error } = await supabase.from('hkpro_rooms').update(row).eq('ma_phong', maPhong);
  if (error) throw new Error('Supabase updateRoomFields lỗi: ' + error.message);
}

/** Áp dữ liệu PDF (Đồng bộ AI) lên hkpro_rooms — bao gồm CẢ Giai đoạn 1 (bảng Phòng) VÀ
 *  Giai đoạn 4 (snapshot DND/RF + Báo cáo thay ga sang lịch sử "hôm qua" + xoá sạch Lịch sử
 *  kiểm phòng trong ngày) — TRƯỚC KHI xoá các field đó cho ngày mới, y hệt hành vi cũ của
 *  Code.gs (Apps Script) trên Google Sheet. */
export async function sbBulkUpdateRoomsFromAI(items: any[]): Promise<{ updated: number; notFound: string[] }> {
  const { data: existing, error: selErr } = await supabase
    .from('hkpro_rooms')
    .select('ma_phong, ghi_chu_nv, ghi_chu_admin, loai_phong, nhan_vien_phu_trach, task_status, linen_change');
  if (selErr) throw new Error('Supabase bulkUpdateFromAI (đọc) lỗi: ' + selErr.message);
  const knownRooms = new Set((existing || []).map((r: any) => r.ma_phong));

  // Bước 0 (Giai đoạn 4) — snapshot DND/RF đang bật (TaskStatus = 'DND'/'Refused') VÀ LinenChange
  // đã chọn sang 2 bảng lịch sử "hôm qua", TRƯỚC KHI bước 1 xoá sạch các field này cho ngày mới.
  // Đồng thời xoá sạch Lịch sử kiểm phòng (chỉ có giá trị trong ngày, y hệt Code.gs cũ xoá tab
  // "InspectionLog" mỗi lần sync).
  const todayDMY = fmtDdMmYyyy(new Date());
  const overdueRows: any[] = [];
  const linenRows: any[] = [];
  (existing || []).forEach((r: any) => {
    if (r.task_status === 'DND') overdueRows.push({ category: 'DND', room_no: r.ma_phong, date_noted: todayDMY });
    if (r.task_status === 'Refused') overdueRows.push({ category: 'RF', room_no: r.ma_phong, date_noted: todayDMY });
    if (r.linen_change === 'Có' || r.linen_change === 'Không') {
      linenRows.push({
        room_no: r.ma_phong, room_type: r.loai_phong || '', date: todayDMY,
        staff: r.nhan_vien_phu_trach || '', status: r.linen_change,
      });
    }
  });
  if (overdueRows.length > 0) {
    const { error: ovErr } = await supabase.from('hkpro_overdue_history').insert(overdueRows);
    if (ovErr) console.warn('[HK PRO] Snapshot Lịch DND/RF (Đồng bộ AI) lỗi:', ovErr.message);
  }
  if (linenRows.length > 0) {
    const { error: linErr } = await supabase.from('hkpro_linen_change_history').insert(linenRows);
    if (linErr) console.warn('[HK PRO] Snapshot Báo cáo thay ga (Đồng bộ AI) lỗi:', linErr.message);
  }
  try {
    await supabase.from('hkpro_inspection_logs').delete().gte('id', 0);
  } catch (err: any) {
    console.warn('[HK PRO] Xoá Lịch sử kiểm phòng (Đồng bộ AI) lỗi:', err?.message);
  }
  // Reset Nhóm phân công (tên nhân viên gán ở màn Phân công) về mặc định (N1-N5, rỗng) NGAY TRÊN
  // SERVER — để MỌI thiết bị/trình duyệt đang mở màn Phân công đều thấy trống ngay khi họ tải lại
  // (polling), không còn phụ thuộc localStorage của riêng từng máy như trước (đây chính là lý do
  // trước đây reset không ăn khi Đồng bộ AI chạy ở máy khác với máy đang xem Phân công).
  try {
    await supabase.from('hkpro_assign_groups').upsert(
      { id: 1, groups_json: DEFAULT_ASSIGN_GROUPS, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
  } catch (err: any) {
    console.warn('[HK PRO] Reset Nhóm phân công (Đồng bộ AI) lỗi:', err?.message);
  }

  // Bước 1 — reset toàn bộ phòng đã biết (snapshot GhiChuNV/GhiChuAdmin sang "HomQua" trước khi xoá)
  const resets = (existing || []).map((r: any) => ({
    ma_phong: r.ma_phong,
    nhan_vien_phu_trach: '',
    flags: '',
    ghi_chu_nv: '',
    ghi_chu_admin: '',
    ghi_chu_sua_chua: '',
    ghi_chu_ngay: '',
    start_time: '',
    end_time: '',
    duration: '',
    task_status: 'Chưa dọn',
    safe_status: 'Chưa kiểm',
    linen_change: '',
    trolley_code: '',
    vacuum_floor: '',
    ghi_chu_nv_hom_qua: r.ghi_chu_nv || '',
    ghi_chu_admin_hom_qua: r.ghi_chu_admin || '',
    updated_at: new Date().toISOString(),
  }));
  if (resets.length > 0) {
    const { error: resetErr } = await supabase.from('hkpro_rooms').upsert(resets, { onConflict: 'ma_phong' });
    if (resetErr) throw new Error('Supabase bulkUpdateFromAI (reset) lỗi: ' + resetErr.message);
  }

  // Bước 2 — áp dữ liệu PDF mới nhất
  let updated = 0;
  const notFound: string[] = [];
  const applies: any[] = [];
  items.forEach((item) => {
    const id = String(item.id);
    if (!knownRooms.has(id)) { notFound.push(id); return; }
    const row: Record<string, any> = {
      ma_phong: id,
      hk_status: item.hkStatus || '',
      morning_status: item.hkStatus || '',
      fo_status: item.foStatus || '',
      updated_at: new Date().toISOString(),
    };
    if (item.date !== undefined) row.ngay_o = item.date || '';
    if (item.note) row.ghi_chu = item.note;
    applies.push(row);
    updated++;
  });
  if (applies.length > 0) {
    const { error: applyErr } = await supabase.from('hkpro_rooms').upsert(applies, { onConflict: 'ma_phong' });
    if (applyErr) throw new Error('Supabase bulkUpdateFromAI (áp dữ liệu) lỗi: ' + applyErr.message);
  }

  return { updated, notFound };
}

/** ===== Tài khoản (đăng nhập) — qua RPC vì bảng hkpro_accounts bị khoá đọc trực tiếp ===== */

function accountFromRpc(a: any): Account {
  return { id: str(a.id), hoTen: str(a.hoTen), vaiTro: str(a.vaiTro) as any, modulesAllowed: a.modulesAllowed || [] };
}

export async function sbLogin(id: string, password: string): Promise<{ success: boolean; account?: Account; error?: string }> {
  const { data, error } = await supabase.rpc('hkpro_login', { p_id: id, p_password: password });
  if (error) return { success: false, error: 'Supabase login lỗi: ' + error.message };
  if (!data?.success) return { success: false, error: data?.error || 'Đăng nhập thất bại' };
  return { success: true, account: accountFromRpc(data.account) };
}

export async function sbLoginByPassword(password: string): Promise<{ success: boolean; account?: Account; error?: string }> {
  const { data, error } = await supabase.rpc('hkpro_login_by_password', { p_password: password });
  if (error) return { success: false, error: 'Supabase login lỗi: ' + error.message };
  if (!data?.success) return { success: false, error: data?.error || 'Đăng nhập thất bại' };
  return { success: true, account: accountFromRpc(data.account) };
}

export async function sbListAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.rpc('hkpro_list_accounts');
  if (error) throw new Error('Supabase listAccounts lỗi: ' + error.message);
  return (data || []).map(accountFromRpc);
}

export async function sbUpdateAccountModules(id: string, modules: string[]): Promise<{ success: boolean }> {
  const { data, error } = await supabase.rpc('hkpro_update_account_modules', { p_id: id, p_modules: modules.join(',') });
  if (error) return { success: false };
  return { success: !!data?.success };
}

/** ===== Lịch sử thao tác (LichSuDon) ===== */

function fmtDdMm(d: Date): string {
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
}
function fmtDdMmYyyy(d: Date): string {
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}
function fmtHhMmSs(d: Date): string {
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}

export async function sbLogTaskAction(maPhong: string, nhanVien: string, hanhDong: string, chiTiet = ''): Promise<void> {
  const now = new Date();
  const { error } = await supabase.from('hkpro_lich_su_don').insert({
    ngay: fmtDdMm(now), ma_phong: maPhong, nhan_vien: nhanVien, hanh_dong: hanhDong, gio: fmtHhMmSs(now), chi_tiet: chiTiet,
  });
  if (error) throw new Error('Supabase logTaskAction lỗi: ' + error.message);
}

function historyRowToEntry(row: any): HistoryEntry {
  return { ngay: str(row.ngay), maPhong: str(row.ma_phong), nhanVien: str(row.nhan_vien), hanhDong: str(row.hanh_dong), gio: str(row.gio), chiTiet: str(row.chi_tiet) };
}

export async function sbGetTaskHistory(maPhong: string): Promise<HistoryEntry[]> {
  const now = new Date();
  const today = fmtDdMm(now);
  const { data, error } = await supabase.from('hkpro_lich_su_don').select('*').eq('ma_phong', maPhong).eq('ngay', today).order('id', { ascending: false });
  if (error) throw new Error('Supabase getTaskHistory lỗi: ' + error.message);
  return (data || []).map(historyRowToEntry);
}

export async function sbGetTodayHistory(): Promise<HistoryEntry[]> {
  const now = new Date();
  const today = fmtDdMm(now);
  const { data, error } = await supabase.from('hkpro_lich_su_don').select('*').eq('ngay', today).order('id', { ascending: true });
  if (error) throw new Error('Supabase getTodayHistory lỗi: ' + error.message);
  return (data || []).map(historyRowToEntry);
}

/** ============================================================
 *  GIAI ĐOẠN 2 — Giao nhận chìa khóa + Task Chart
 * ============================================================ */

/** ===== Giao nhận chìa khóa (hkpro_key_logs) ===== */

function keyLogRowToLog(row: any): KeyLog {
  return {
    rowIndex: Number(row.id),
    ngay: str(row.ngay),
    nhanVien: str(row.nhan_vien),
    keyLabel: str(row.key_label),
    gioMuon: str(row.gio_muon),
    gioTra: str(row.gio_tra),
    trangThai: (str(row.trang_thai) || 'Đang giữ') as any,
  };
}

/** Lấy toàn bộ lượt giao/nhận chìa TRONG NGÀY HÔM NAY (mọi nhân viên) */
export async function sbGetKeyLogs(): Promise<KeyLog[]> {
  const today = fmtDdMm(new Date());
  const { data, error } = await supabase.from('hkpro_key_logs').select('*').eq('ngay', today).order('id', { ascending: true });
  if (error) throw new Error('Supabase getKeyLogs lỗi: ' + error.message);
  return (data || []).map(keyLogRowToLog);
}

/** Mượn 1 bộ chìa — chặn mượn nếu bộ chìa đó ĐANG có người khác giữ (trạng thái "Đang giữ" trong hôm nay) */
export async function sbBorrowKey(nhanVien: string, keyLabel: string): Promise<{ success: boolean; error?: string }> {
  if (!nhanVien || !keyLabel) return { success: false, error: 'Thiếu tên nhân viên hoặc mã chìa' };
  const today = fmtDdMm(new Date());
  const { data: existing, error: selErr } = await supabase
    .from('hkpro_key_logs')
    .select('id')
    .eq('ngay', today)
    .eq('key_label', keyLabel)
    .eq('trang_thai', 'Đang giữ')
    .limit(1);
  if (selErr) return { success: false, error: 'Supabase borrowKey lỗi: ' + selErr.message };
  if (existing && existing.length > 0) return { success: false, error: 'Bộ chìa này đang có người khác giữ' };

  const gio = fmtHhMmSs(new Date());
  const { error: insErr } = await supabase.from('hkpro_key_logs').insert({
    ngay: today, nhan_vien: nhanVien, key_label: keyLabel, gio_muon: gio, gio_tra: '', trang_thai: 'Đang giữ',
  });
  if (insErr) return { success: false, error: 'Supabase borrowKey lỗi: ' + insErr.message };
  return { success: true };
}

/** Trả chìa — cập nhật đúng dòng (theo rowIndex = id) sang trạng thái "Đã trả" */
export async function sbReturnKey(rowIndex: number): Promise<{ success: boolean; error?: string }> {
  if (!rowIndex) return { success: false, error: 'Thiếu rowIndex' };
  const gio = fmtHhMmSs(new Date());
  const { error } = await supabase.from('hkpro_key_logs').update({ gio_tra: gio, trang_thai: 'Đã trả' }).eq('id', rowIndex);
  if (error) return { success: false, error: 'Supabase returnKey lỗi: ' + error.message };
  return { success: true };
}

/** Đồng bộ AI (bắt đầu ca mới) — đóng (trả) toàn bộ lượt chìa còn "Đang giữ" dở của ca cũ.
 *  Tương đương bước reset Bảng Quản Lý Chìa Khóa trong bulkUpdateFromAI cũ (Code.gs), nay
 *  bảng chìa đã chuyển sang Supabase nên bước reset này cũng thực hiện ở đây. */
export async function sbCloseAllOpenKeys(): Promise<void> {
  const gio = fmtHhMmSs(new Date());
  const { error } = await supabase
    .from('hkpro_key_logs')
    .update({ gio_tra: gio, trang_thai: 'Đã trả' })
    .eq('trang_thai', 'Đang giữ');
  if (error) throw new Error('Supabase reset Giao nhận chìa (Đồng bộ AI) lỗi: ' + error.message);
}

/** ===== Task Chart (hkpro_task_charts + hkpro_task_chart_cells) ===== */

/** Lấy toàn bộ bảng Task Chart + toàn bộ ô dữ liệu (mọi bảng) trong 1 lần gọi */
export async function sbGetTaskCharts(): Promise<{ charts: TaskChart[]; cells: TaskChartCell[] }> {
  const [chartsRes, cellsRes] = await Promise.all([
    supabase.from('hkpro_task_charts').select('*').order('created_at', { ascending: true }),
    supabase.from('hkpro_task_chart_cells').select('*'),
  ]);
  if (chartsRes.error) throw new Error('Supabase getTaskCharts lỗi: ' + chartsRes.error.message);
  if (cellsRes.error) throw new Error('Supabase getTaskCharts (cells) lỗi: ' + cellsRes.error.message);
  const charts: TaskChart[] = (chartsRes.data || []).map((row: any) => ({
    id: str(row.chart_id), title: str(row.title), palette: (Number(row.palette) || 1) as any,
  }));
  const cells: TaskChartCell[] = (cellsRes.data || []).map((row: any) => ({
    chartId: str(row.chart_id), maPhong: str(row.ma_phong), checked: !!row.checked, note: str(row.note),
  }));
  return { charts, cells };
}

/** Tạo 1 bảng Task Chart mới — mặc định bảng màu 1, tiêu đề do người dùng đặt */
export async function sbCreateTaskChart(title: string): Promise<{ success: boolean; chart?: TaskChart; error?: string }> {
  const id = 'TC' + Date.now();
  const { error } = await supabase.from('hkpro_task_charts').insert({ chart_id: id, title: title || '', palette: 1 });
  if (error) return { success: false, error: 'Supabase createTaskChart lỗi: ' + error.message };
  return { success: true, chart: { id, title: title || '', palette: 1 } };
}

/** Xoá 1 bảng Task Chart — xoá cả hkpro_task_charts LẪN toàn bộ ô dữ liệu liên quan (ON DELETE CASCADE) */
export async function sbDeleteTaskChart(chartId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('hkpro_task_charts').delete().eq('chart_id', chartId);
  if (error) return { success: false, error: 'Supabase deleteTaskChart lỗi: ' + error.message };
  return { success: true };
}

/** Đổi tên / đổi bảng màu của 1 Task Chart */
export async function sbUpdateTaskChartMeta(chartId: string, title: string, palette: number): Promise<{ success: boolean }> {
  const row: Record<string, any> = {};
  if (title !== undefined && title !== null) row.title = title;
  if (palette) row.palette = palette;
  const { error } = await supabase.from('hkpro_task_charts').update(row).eq('chart_id', chartId);
  if (error) return { success: false };
  return { success: true };
}

/** Ghi 1 ô (checkbox + ghi chú) — UPSERT theo khoá (chartId, maPhong) */
export async function sbUpdateTaskCell(chartId: string, maPhong: string, checked: boolean, note: string): Promise<{ success: boolean }> {
  const { error } = await supabase.from('hkpro_task_chart_cells').upsert(
    { chart_id: chartId, ma_phong: maPhong, checked: !!checked, note: note || '', updated_at: new Date().toISOString() },
    { onConflict: 'chart_id,ma_phong' }
  );
  if (error) return { success: false };
  return { success: true };
}

/** ============================================================
 *  GIAI ĐOẠN 3 — Bảo trì (Maintenance) + Lost & Found
 * ============================================================ */

/** ===== Bảo trì (hkpro_maintenance_issues) ===== */

function maintenanceRowToIssue(row: any): MaintenanceIssue {
  return {
    id: Number(row.id),
    roomNo: str(row.room_no),
    issueDescription: str(row.issue_description),
    reportedBy: str(row.reported_by),
    reportedDate: str(row.reported_date),
    status: (str(row.status) || 'Đang xử lý') as any,
    dueDate: str(row.due_date),
  };
}

/** Lấy toàn bộ ticket Bảo trì — đồng thời tự dọn (xoá hẳn) ticket ĐÃ XONG quá 180 ngày,
 *  giống hệt hành vi getMaintenanceIssues() cũ bên Apps Script. */
export async function sbGetMaintenanceIssues(): Promise<MaintenanceIssue[]> {
  const { data, error } = await supabase.from('hkpro_maintenance_issues').select('*').order('id', { ascending: false });
  if (error) throw new Error('Supabase getMaintenanceIssues lỗi: ' + error.message);
  const rows = data || [];

  const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const expiredIds: number[] = [];
  const kept = rows.filter((row: any) => {
    if (str(row.status) !== 'Đã xong') return true;
    const parts = str(row.reported_date).split('/'); // dd/MM/yyyy
    if (parts.length !== 3) return true;
    const reportedTime = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
    if (now - reportedTime > SIX_MONTHS_MS) { expiredIds.push(Number(row.id)); return false; }
    return true;
  });
  if (expiredIds.length > 0) {
    supabase.from('hkpro_maintenance_issues').delete().in('id', expiredIds).then(({ error: delErr }) => {
      if (delErr) console.warn('[HK PRO] Dọn ticket Bảo trì quá hạn lỗi:', delErr.message);
    });
  }
  return kept.map(maintenanceRowToIssue);
}

export async function sbCreateMaintenanceIssue(roomNo: string, issueDescription: string, reportedBy: string): Promise<{ success: boolean; issue?: MaintenanceIssue; error?: string }> {
  const today = fmtDdMmYyyy(new Date());
  const { data, error } = await supabase.from('hkpro_maintenance_issues').insert({
    room_no: roomNo || '', issue_description: issueDescription || '', reported_by: reportedBy || '',
    reported_date: today, status: 'Đang xử lý', due_date: '',
  }).select().single();
  if (error) return { success: false, error: 'Supabase createMaintenanceIssue lỗi: ' + error.message };
  return { success: true, issue: maintenanceRowToIssue(data) };
}

/** Cập nhật 1 phần (issueDescription/status/dueDate) — field nào không truyền thì giữ nguyên */
export async function sbUpdateMaintenanceIssue(id: number, changes: { issueDescription?: string; status?: string; dueDate?: string }): Promise<{ success: boolean }> {
  const row: Record<string, any> = {};
  if (changes.issueDescription !== undefined) row.issue_description = changes.issueDescription;
  if (changes.status !== undefined) row.status = changes.status;
  if (changes.dueDate !== undefined) row.due_date = changes.dueDate;
  const { error } = await supabase.from('hkpro_maintenance_issues').update(row).eq('id', id);
  if (error) return { success: false };
  return { success: true };
}

export async function sbDeleteMaintenanceIssue(id: number): Promise<{ success: boolean }> {
  const { error } = await supabase.from('hkpro_maintenance_issues').delete().eq('id', id);
  if (error) return { success: false };
  return { success: true };
}

/** ===== Lost & Found (hkpro_lost_found_items) ===== */

function lostFoundRowToItem(row: any): LostFoundItem {
  return {
    id: Number(row.id),
    dateFound: str(row.date_found),
    roomNo: str(row.room_no),
    itemDescription: str(row.item_description),
    foundBy: str(row.found_by),
    status: (str(row.status) || 'Lưu kho') as any,
    notes: str(row.notes),
  };
}

export async function sbGetLostFoundItems(): Promise<LostFoundItem[]> {
  const { data, error } = await supabase.from('hkpro_lost_found_items').select('*').order('id', { ascending: false });
  if (error) throw new Error('Supabase getLostFoundItems lỗi: ' + error.message);
  return (data || []).map(lostFoundRowToItem);
}

export async function sbCreateLostFoundItem(item: {
  dateFound: string; roomNo: string; itemDescription: string; foundBy: string; status: string; notes: string;
}): Promise<{ success: boolean; item?: LostFoundItem; error?: string }> {
  const dateFound = item.dateFound || fmtDdMmYyyy(new Date());
  const { data, error } = await supabase.from('hkpro_lost_found_items').insert({
    date_found: dateFound, room_no: item.roomNo || '', item_description: item.itemDescription || '',
    found_by: item.foundBy || '', status: item.status || 'Lưu kho', notes: item.notes || '',
  }).select().single();
  if (error) return { success: false, error: 'Supabase createLostFoundItem lỗi: ' + error.message };
  return { success: true, item: lostFoundRowToItem(data) };
}

export async function sbUpdateLostFoundItem(
  id: number,
  item: { dateFound: string; roomNo: string; itemDescription: string; foundBy: string; status: string; notes: string }
): Promise<{ success: boolean }> {
  const { error } = await supabase.from('hkpro_lost_found_items').update({
    date_found: item.dateFound || '', room_no: item.roomNo || '', item_description: item.itemDescription || '',
    found_by: item.foundBy || '', status: item.status || 'Lưu kho', notes: item.notes || '',
  }).eq('id', id);
  if (error) return { success: false };
  return { success: true };
}

export async function sbDeleteLostFoundItem(id: number): Promise<{ success: boolean }> {
  const { error } = await supabase.from('hkpro_lost_found_items').delete().eq('id', id);
  if (error) return { success: false };
  return { success: true };
}

/** ===== GIAI ĐOẠN 4 — NOTE BOARD (Bảng 1: Lịch DND/RF "hôm qua") ===== */

function overdueRowFromDb(row: any): OverdueHistoryRow {
  return { id: Number(row.id), category: row.category === 'RF' ? 'RF' : 'DND', roomNo: str(row.room_no), dateNoted: str(row.date_noted) };
}

export async function sbGetOverdueHistory(): Promise<OverdueHistoryRow[]> {
  const { data, error } = await supabase.from('hkpro_overdue_history').select('*').order('id', { ascending: false });
  if (error) throw new Error('Supabase getOverdueHistory lỗi: ' + error.message);
  return (data || []).map(overdueRowFromDb);
}
export async function sbDeleteOverdueHistoryRow(id: number): Promise<{ success: boolean }> {
  const { error } = await supabase.from('hkpro_overdue_history').delete().eq('id', id);
  if (error) return { success: false };
  return { success: true };
}
export async function sbClearOverdueHistory(): Promise<{ success: boolean }> {
  const { error } = await supabase.from('hkpro_overdue_history').delete().gte('id', 0);
  if (error) return { success: false };
  return { success: true };
}

/** ===== GIAI ĐOẠN 4 — NOTE BOARD (Bảng 2: Báo cáo lịch thay ga "hôm qua") ===== */

function linenRowFromDb(row: any): LinenChangeHistoryRow {
  return {
    id: Number(row.id), roomNo: str(row.room_no), roomType: str(row.room_type),
    date: str(row.date), staff: str(row.staff), status: row.status === 'Có' ? 'Có' : 'Không',
  };
}

export async function sbGetLinenChangeHistory(): Promise<LinenChangeHistoryRow[]> {
  const { data, error } = await supabase.from('hkpro_linen_change_history').select('*').order('id', { ascending: false });
  if (error) throw new Error('Supabase getLinenChangeHistory lỗi: ' + error.message);
  return (data || []).map(linenRowFromDb);
}

/** ===== GIAI ĐOẠN 4 — NOTE BOARD (Bảng 3: Dụng cụ & vật tư đặc biệt) ===== */

export async function sbGetSuppliesBoard(): Promise<SupplyBoardItem[]> {
  const { data, error } = await supabase.from('hkpro_supply_board').select('*');
  if (error) throw new Error('Supabase getSuppliesBoard lỗi: ' + error.message);
  return (data || []).map((row: any) => ({ label: str(row.label), value: str(row.value) }));
}
export async function sbUpdateSupplyItem(label: string, value: string): Promise<{ success: boolean }> {
  const { error } = await supabase.from('hkpro_supply_board').upsert(
    { label, value, updated_at: new Date().toISOString() },
    { onConflict: 'label' }
  );
  if (error) return { success: false };
  return { success: true };
}

/** ===== GIAI ĐOẠN 4 — LỊCH SỬ KIỂM PHÒNG CỦA GIÁM SÁT/ADMIN (chỉ trong ngày) ===== */

function inspectionRowFromDb(row: any): InspectionLogRow {
  return {
    id: Number(row.id), roomNo: str(row.room_no), startTime: str(row.start_time),
    endTime: str(row.end_time), status: str(row.status), giamSat: str(row.giam_sat),
  };
}

export async function sbStartInspectionLog(roomNo: string, giamSat: string): Promise<{ success: boolean }> {
  const now = new Date();
  const hhmmss = [now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
  const { error } = await supabase.from('hkpro_inspection_logs').insert({
    room_no: roomNo, start_time: hhmmss, end_time: '', status: '', giam_sat: giamSat,
  });
  if (error) return { success: false };
  return { success: true };
}

export async function sbEndInspectionLog(roomNo: string, status: string): Promise<{ success: boolean }> {
  // Tìm đúng dòng đang MỞ (end_time rỗng) mới nhất của phòng này để điền EndTime + tình trạng sau khi nhả.
  const { data, error: selErr } = await supabase
    .from('hkpro_inspection_logs')
    .select('id')
    .eq('room_no', roomNo)
    .eq('end_time', '')
    .order('id', { ascending: false })
    .limit(1);
  if (selErr || !data || data.length === 0) return { success: false };
  const now = new Date();
  const hhmmss = [now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
  const { error } = await supabase.from('hkpro_inspection_logs').update({ end_time: hhmmss, status }).eq('id', data[0].id);
  if (error) return { success: false };
  return { success: true };
}

export async function sbGetInspectionLogs(): Promise<InspectionLogRow[]> {
  const { data, error } = await supabase.from('hkpro_inspection_logs').select('*').order('id', { ascending: false });
  if (error) throw new Error('Supabase getInspectionLogs lỗi: ' + error.message);
  return (data || []).map(inspectionRowFromDb);
}

/** ===== GIAI ĐOẠN 4 — TASK CHỈ ĐẠO ĐẶC BIỆT CỦA GIÁM SÁT (Broadcast, 1 dòng duy nhất id=1) ===== */

function broadcastFromDb(row: any): BroadcastTaskData {
  let completions: string[] = [];
  try { completions = Array.isArray(row.completions) ? row.completions : JSON.parse(row.completions || '[]'); } catch { completions = []; }
  return { content: str(row.content), active: Boolean(row.active), date: str(row.task_date), completions };
}

export async function sbSetBroadcastTask(content: string): Promise<{ success: boolean }> {
  const todayDMY = fmtDdMmYyyy(new Date());
  const { error } = await supabase.from('hkpro_broadcast_task').upsert(
    { id: 1, content, active: true, task_date: todayDMY, completions: [], updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
  if (error) return { success: false };
  return { success: true };
}

export async function sbClearBroadcastTask(): Promise<{ success: boolean }> {
  const { error } = await supabase.from('hkpro_broadcast_task')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) return { success: false };
  return { success: true };
}

export async function sbGetBroadcastTask(): Promise<BroadcastTaskData | null> {
  const { data, error } = await supabase.from('hkpro_broadcast_task').select('*').eq('id', 1).maybeSingle();
  if (error || !data) return null;
  return broadcastFromDb(data);
}

export async function sbCompleteBroadcastTask(staff: string): Promise<{ success: boolean }> {
  const { data, error: selErr } = await supabase.from('hkpro_broadcast_task').select('completions').eq('id', 1).maybeSingle();
  if (selErr || !data) return { success: false };
  let completions: string[] = [];
  try { completions = Array.isArray(data.completions) ? data.completions : JSON.parse(data.completions || '[]'); } catch { completions = []; }
  if (!completions.includes(staff)) completions.push(staff);
  const { error } = await supabase.from('hkpro_broadcast_task')
    .update({ completions, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) return { success: false };
  return { success: true };
}

/** ===== NHÓM PHÂN CÔNG (màn Phân công dọn phòng) — 1 dòng duy nhất id=1, DÙNG CHUNG mọi thiết bị.
 *  Thay cho localStorage trước đây (chỉ lưu riêng từng trình duyệt, không ai khác thấy được khi
 *  Đồng bộ AI reset). Đọc/ghi TOÀN BỘ mảng Group 1 lần (dữ liệu nhỏ, không cần tách bảng riêng). ===== */

export async function sbGetAssignGroups(): Promise<Group[]> {
  const { data, error } = await supabase.from('hkpro_assign_groups').select('groups_json').eq('id', 1).maybeSingle();
  if (error || !data || !Array.isArray(data.groups_json) || data.groups_json.length === 0) {
    return DEFAULT_ASSIGN_GROUPS;
  }
  return data.groups_json as Group[];
}

export async function sbSaveAssignGroups(groups: Group[]): Promise<{ success: boolean }> {
  const { error } = await supabase.from('hkpro_assign_groups').upsert(
    { id: 1, groups_json: groups, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
  if (error) return { success: false };
  return { success: true };
}
