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
import type { Room, Account, HistoryEntry } from './types';

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

/** Áp dữ liệu PDF (Đồng bộ AI) lên hkpro_rooms — CHỈ phần đọc/ghi bảng Phòng của Giai đoạn 1.
 *  Việc reset Giao Nhận Chìa / Lịch Sử Kiểm Phòng / Note Board (các bảng CHƯA migrate) vẫn
 *  chạy qua Apps Script cũ, được gọi riêng ở lib/api.ts để không phá vỡ các module đó. */
export async function sbBulkUpdateRoomsFromAI(items: any[]): Promise<{ updated: number; notFound: string[] }> {
  const { data: existing, error: selErr } = await supabase.from('hkpro_rooms').select('ma_phong, ghi_chu_nv, ghi_chu_admin');
  if (selErr) throw new Error('Supabase bulkUpdateFromAI (đọc) lỗi: ' + selErr.message);
  const knownRooms = new Set((existing || []).map((r: any) => r.ma_phong));

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
