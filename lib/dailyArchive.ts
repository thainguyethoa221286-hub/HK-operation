import { supabase } from './supabaseClient';
import { sbFetchRooms, sbGetKeyLogs, sbGetTodayHistory, sbGetInspectionLogs, sbGetAssignGroups } from './supabaseHkpro';
import type { Room, KeyLog, HistoryEntry, InspectionLogRow, Group } from './types';

/* =========================================================
   KHO BÁO CÁO NGÀY (bảng hkpro_daily_reports)
   - Mỗi ngày 1 dòng (khoá = "yyyy-mm-dd" theo giờ Việt Nam), lưu TOÀN BỘ dữ liệu để vẽ lại
     đúng tờ Daily Report của ngày đó: phòng, lịch sử trong ngày, chìa khoá, kiểm phòng, nhóm.
   - Tự lưu lúc 23:00 (Vercel Cron gọi /api/cron/daily-report) + nút "Lưu ngay" trên màn Daily Report.
   - Lưu lại trong cùng ngày -> GHI ĐÈ bản cũ của ngày đó (luôn giữ bản mới nhất).
   - Không bao giờ tự xoá -> lưu trữ lâu dài.
   ========================================================= */

export interface DailySnapshot {
  version: 1;
  date: string; // yyyy-mm-dd (giờ VN)
  exportedAt: string; // ISO
  by: string;
  rooms: Room[];
  history: HistoryEntry[];
  keyLogs: KeyLog[];
  inspections: InspectionLogRow[];
  groups: Group[];
}

export interface DailySummary {
  total: number;
  done: number;
  dirty: number;
  dnd: number;
  rf: number;
  pm: number;
}

export interface ArchiveRow {
  date: string;
  savedAt: string;
  savedBy: string;
  isAuto: boolean;
  summary: DailySummary | null;
}

const TABLE = 'hkpro_daily_reports';

/** Ngày hiện tại theo giờ Việt Nam (UTC+7) dạng yyyy-mm-dd — đúng cả khi chạy trên server Vercel (UTC) */
export function vnDateKey(d: Date = new Date()): string {
  return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
/** Giờ hiện tại theo giờ Việt Nam (0-23) */
export function vnHour(d: Date = new Date()): number {
  return new Date(d.getTime() + 7 * 3600 * 1000).getUTCHours();
}
/** "yyyy-mm-dd" -> "dd/mm/yyyy" */
export function keyToDMY(key: string): string {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

export function summarize(s: Pick<DailySnapshot, 'rooms' | 'history'>): DailySummary {
  const pmRooms = new Set(s.history.filter((h) => h.hanhDong === 'Chuyển PM Shift').map((h) => h.maPhong));
  return {
    total: s.rooms.length,
    done: s.rooms.filter((r) => r.TaskStatus === 'Hoàn thành').length,
    dirty: s.rooms.filter((r) => r.HkStatus === 'Phòng dơ').length,
    dnd: new Set(s.history.filter((h) => h.hanhDong === 'DND Bật').map((h) => h.maPhong)).size,
    rf: new Set(s.history.filter((h) => h.hanhDong === 'Từ chối (RF)').map((h) => h.maPhong)).size,
    pm: pmRooms.size,
  };
}

/** Gom toàn bộ dữ liệu HÔM NAY thành 1 bản chụp báo cáo */
export async function buildTodaySnapshot(by: string): Promise<DailySnapshot> {
  const [rooms, history, keyLogs, inspections, groups] = await Promise.all([
    sbFetchRooms(),
    sbGetTodayHistory(),
    sbGetKeyLogs(),
    sbGetInspectionLogs(),
    sbGetAssignGroups(),
  ]);
  // Bỏ trạng thái tạm "đang kiểm" (chỉ tồn tại trong phiên) cho bản lưu gọn, đúng thực tế
  const cleanRooms = rooms.map((r) => ({ ...r, isInspecting: false }));
  return { version: 1, date: vnDateKey(), exportedAt: new Date().toISOString(), by, rooms: cleanRooms, history, keyLogs, inspections, groups };
}

export async function saveSnapshot(snap: DailySnapshot, isAuto: boolean): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from(TABLE).upsert(
    {
      report_date: snap.date,
      snapshot: snap,
      summary: summarize(snap),
      saved_at: snap.exportedAt,
      saved_by: snap.by,
      is_auto: isAuto,
    },
    { onConflict: 'report_date' }
  );
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Lưu báo cáo hôm nay (dùng cho nút "Lưu ngay", tự lưu dự phòng trên app và Cron 23:00) */
export async function saveTodayReport(by: string, isAuto: boolean) {
  const snap = await buildTodaySnapshot(by);
  return saveSnapshot(snap, isAuto);
}

function rowToArchive(row: any): ArchiveRow {
  return {
    date: String(row.report_date),
    savedAt: String(row.saved_at || ''),
    savedBy: String(row.saved_by || ''),
    isAuto: Boolean(row.is_auto),
    summary: row.summary || null,
  };
}

/** Thông tin lần lưu của 1 ngày (không tải cả bản chụp) — null nếu ngày đó chưa lưu */
export async function getArchiveInfo(date: string): Promise<ArchiveRow | null> {
  const { data, error } = await supabase.from(TABLE).select('report_date, saved_at, saved_by, is_auto, summary').eq('report_date', date).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToArchive(data) : null;
}

/** Danh sách ngày đã lưu trong khoảng (mới nhất trước) */
export async function listArchive(from: string, to: string): Promise<ArchiveRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('report_date, saved_at, saved_by, is_auto, summary')
    .gte('report_date', from)
    .lte('report_date', to)
    .order('report_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToArchive);
}

/** Mở lại đầy đủ bản chụp của 1 ngày */
export async function getSnapshot(date: string): Promise<DailySnapshot | null> {
  const { data, error } = await supabase.from(TABLE).select('snapshot').eq('report_date', date).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.snapshot as DailySnapshot) || null;
}

export interface RoomDayRecord {
  date: string;
  room: Room;
  history: HistoryEntry[];
  inspections: InspectionLogRow[];
}

/** Lịch sử 1 phòng qua các ngày đã lưu trong khoảng */
export async function searchRoomHistory(from: string, to: string, roomNo: string): Promise<RoomDayRecord[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('report_date, rooms:snapshot->rooms, history:snapshot->history, inspections:snapshot->inspections')
    .gte('report_date', from)
    .lte('report_date', to)
    .order('report_date', { ascending: false });
  if (error) throw new Error(error.message);
  const out: RoomDayRecord[] = [];
  (data || []).forEach((row: any) => {
    const room = ((row.rooms || []) as Room[]).find((r) => String(r.MaPhong) === roomNo);
    if (!room) return;
    out.push({
      date: String(row.report_date),
      room,
      history: ((row.history || []) as HistoryEntry[]).filter((h) => String(h.maPhong) === roomNo),
      inspections: ((row.inspections || []) as InspectionLogRow[]).filter((l) => String(l.roomNo) === roomNo),
    });
  });
  return out;
}
