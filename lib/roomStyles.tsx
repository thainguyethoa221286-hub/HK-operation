import { PlaneLanding, PlaneTakeoff, BedDouble, Bell, PenTool, Wrench, BedSingle, Baby, Wine, Home, DoorOpen } from 'lucide-react';
import type { HkStatus, FoStatus } from './types';

/* =========================================================
   MỤC 2 — QUY TẮC MÀU SẮC THẺ PHÒNG (dựa trên HK Status)
   Viền trái đổi màu theo trạng thái; nền mặc định trắng.
   ========================================================= */
export const HK_STYLE: Record<HkStatus, { border: string }> = {
  'Phòng dơ': { border: 'border-l-red-500' },
  'Phòng đang dọn': { border: 'border-l-blue-500' },
  'Phòng sạch': { border: 'border-l-yellow-400' },
  'Đã kiểm tra': { border: 'border-l-green-500' },
  'Phòng sửa chữa (OOO)': { border: 'border-l-slate-400' },
};

/** Badge trạng thái vệ sinh dạng viên thuốc (pill) màu đậm, chữ trắng — dùng cho thiết kế thẻ phòng mới.
 *  Giữ nguyên 5 trạng thái/màu đã có (không gộp "Sạch" và "Đã kiểm tra" làm một, vì luồng
 *  Kiểm phòng/Nhả phòng của app phân biệt rõ 2 bước này). */
export const HK_STATUS_PILL: Record<HkStatus, { label: string; cls: string }> = {
  'Phòng dơ': { label: 'DƠ', cls: 'bg-red-500 text-white' },
  'Phòng đang dọn': { label: 'ĐANG DỌN', cls: 'bg-blue-500 text-white' },
  'Phòng sạch': { label: 'SẠCH', cls: 'bg-yellow-400 text-slate-800' },
  'Đã kiểm tra': { label: 'ĐÃ KIỂM', cls: 'bg-green-500 text-white' },
  'Phòng sửa chữa (OOO)': { label: 'OOO', cls: 'bg-slate-400 text-white' },
};

/** Nhãn chữ ngắn gọn cho trạng thái khách (FoStatus) — dùng cạnh icon ở chân thẻ phòng */
export const FO_STATUS_LABEL: Record<FoStatus, string> = {
  Occupied: 'Đang ở',
  'Due out': 'Trả phòng',
  Arrival: 'Khách đến',
  'Due out/ARR': 'Trả phòng/Đến',
  Vacant: 'Phòng trống',
};

/** Nền tạm thời khi phòng đang trong quá trình kiểm phòng — ưu tiên cao nhất, đè lên mọi nền khác */
export const INSPECTING_BG = 'bg-yellow-100';

/** Nền riêng cho trạng thái "Phòng đang dọn" */
export const CLEANING_BG = 'bg-blue-50';

/**
 * Trả về class border + background cho 1 phòng.
 * Thứ tự ưu tiên nền: isInspecting (vàng) > Phòng đang dọn (xanh nhạt) > mặc định (trắng)
 */
export function getRoomCardStyle(hkStatus: HkStatus, isInspecting: boolean) {
  const base = HK_STYLE[hkStatus] ?? HK_STYLE['Phòng dơ'];
  let bg = 'bg-white';
  if (hkStatus === 'Phòng đang dọn') bg = CLEANING_BG;
  if (isInspecting) bg = INSPECTING_BG;
  return { border: base.border, bg };
}

/* =========================================================
   MỤC 1 — QUY TẮC ICON THEO FO STATUS (Lucide React)
   ========================================================= */
export function FoStatusIcon({ status }: { status: FoStatus }) {
  const cls = 'w-[18px] h-[18px] text-slate-700 stroke-[2.25]';
  switch (status) {
    case 'Arrival':
      return <PlaneLanding className={cls} />;
    case 'Due out':
      return <PlaneTakeoff className={cls} />;
    case 'Due out/ARR':
      // Khách ra & vào trong ngày — kết hợp cả 2 icon máy bay
      return (
        <span className="flex items-center -space-x-0.5">
          <PlaneTakeoff className={cls} />
          <PlaneLanding className={cls} />
        </span>
      );
    case 'Occupied':
      return <BedDouble className={cls} />;
    case 'Vacant':
      return <Home className={cls} />;
    default:
      return null;
  }
}


/* =========================================================
   MỤC 3 — ICON HUY HIỆU THEO NÚT ĐIỀU PHỐI (Flags)
   ========================================================= */
export function FlagBadgeIcons({ flags }: { flags: string }) {
  const list = (flags || '').split(',').map((f) => f.trim()).filter(Boolean);
  if (list.length === 0) return null;
  const cls = 'w-3.5 h-3.5';
  return (
    <div className="flex items-center gap-1">
      {list.includes('CayBac') && <Bell className={`${cls} text-red-500`} aria-label="Rush" />}
      {list.includes('TrangDiem') && <PenTool className={`${cls} text-purple-500`} aria-label="MKR" />}
      {list.includes('SuaChua') && <Wrench className={`${cls} text-slate-600`} aria-label="Sửa chữa" />}
    </div>
  );
}

/* =========================================================
   NOTE CLEANER — lớp lọc dự phòng, chỉ giữ lại đúng 5 mã hợp lệ
   (EB, BBC, HON, DND, RF) trong ghi chú, loại bỏ mọi rác khác
   (tên khách, ngày tháng, số phòng...) dù AI có lỡ chèn vào.
   Dùng chung cho cả Frontend (RoomCard/AssignScreen) và Backend
   (route.ts sync-pdf) làm lớp phòng vệ cuối cùng.
   ========================================================= */
/** Gộp ghi chú AI (GhiChu) + ghi chú tay nhân viên (GhiChuNV) thành 1 chuỗi
 *  để quét mã DND/RF/EB/BBC/HON từ cả 2 nguồn — dùng cho mọi nơi hiện badge trên thẻ phòng. */
export function combineNotes(ghiChu?: string | null, ghiChuNV?: string | null): string {
  return [ghiChu, ghiChuNV].filter(Boolean).join(' ');
}

export const ALLOWED_NOTE_CODES = ['EB', 'BBC', 'HON', 'DND', 'RF'] as const;

export function cleanNote(rawNote?: string | null): string {
  if (!rawNote) return '';
  const foundCodes = ALLOWED_NOTE_CODES.filter((code) =>
    new RegExp(`\\b${code}\\b`, 'i').test(rawNote)
  );
  return foundCodes.join(', ');
}

/** Gắn thêm 1 mã (VD "DND") vào chuỗi ghi chú nếu chưa có, giữ nguyên phần chữ khác trong ghi chú */
export function addNoteCode(note: string, code: string): string {
  if (new RegExp(`\\b${code}\\b`, 'i').test(note || '')) return note || '';
  return note ? `${note}, ${code}` : code;
}

/** Gỡ 1 mã (VD "DND") khỏi chuỗi ghi chú, giữ nguyên phần chữ khác trong ghi chú */
export function removeNoteCode(note: string, code: string): string {
  return (note || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s.toUpperCase() !== code.toUpperCase())
    .join(', ');
}

/** Tách phần CHỮ TỰ DO khỏi các mã hệ thống (EB/BBC/HON/DND/RF) trong ghi chú —
 *  dùng để ô "Thêm ghi chú" trong Task Card chỉ hiện/sửa phần chữ tự do,
 *  không hiện trôi nổi các mã đã có badge riêng ở header thẻ phòng. */
export function stripCodesFromNote(note: string): string {
  return (note || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !ALLOWED_NOTE_CODES.some((code) => code.toUpperCase() === s.toUpperCase()))
    .join(', ');
}

/** Lấy riêng các mã hệ thống (EB/BBC/HON/DND/RF) đang có trong ghi chú, dạng mảng chuỗi hoa */
export function extractNoteCodes(note: string): string[] {
  return (note || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => (ALLOWED_NOTE_CODES as readonly string[]).includes(s));
}

/* =========================================================
   MỤC 3 — NHẬN DIỆN DND / RF (Refuse) TRONG GHI CHÚ
   Dựa trên cleanNote() để tránh bắt nhầm chuỗi con (VD "SUPERB" chứa "EB")
   ========================================================= */
export function hasDndOrRf(note: string): { dnd: boolean; rf: boolean } {
  if (!note) return { dnd: false, rf: false };
  const codes = cleanNote(note);
  return {
    dnd: /\bDND\b/i.test(codes),
    rf: /\bRF\b/i.test(codes),
  };
}

/** Badge thẻ treo DND (đỏ) / RF (tím đậm) — dùng inline trực tiếp trong RoomCard/AssignScreen,
 *  hàm này giữ lại để tái sử dụng nếu cần render rời (không có móc treo). */
export function DndRfBadge({ note }: { note: string }) {
  const { dnd, rf } = hasDndOrRf(note);
  if (!dnd && !rf) return null;
  return (
    <div className="flex items-center gap-1">
      {dnd && <span className="bg-red-600 text-white font-extrabold px-1.5 py-[1px] rounded-sm text-[9px]">DND</span>}
      {rf && <span className="bg-purple-800 text-white font-extrabold px-1.5 py-[1px] rounded-sm text-[9px]">RF</span>}
    </div>
  );
}

export function NoteIcons({ note }: { note: string }) {
  const codes = cleanNote(note);
  if (!codes) return null;
  const cls = 'w-3.5 h-3.5';
  const hasEB = /\bEB\b/i.test(codes);
  const hasBBC = /\bBBC\b/i.test(codes);
  const hasHON = /\bHON\b/i.test(codes);
  if (!hasEB && !hasBBC && !hasHON) return null;
  return (
    <div className="flex items-center gap-1">
      {hasEB && <BedSingle className={`${cls} text-indigo-600`} aria-label="Extra Bed" />}
      {hasBBC && <Baby className={`${cls} text-pink-500`} aria-label="Baby Cot" />}
      {hasHON && <Wine className={`${cls} text-rose-600`} aria-label="Honeymoon" />}
    </div>
  );
}

/* =========================================================
   FIX HIỂN THỊ NGÀY — chuẩn hoá mọi định dạng ngày về DD/MM
   hoặc DD/MM-DD/MM, bất kể backend trả về ISO dài hay đã ngắn sẵn.
   ========================================================= */
export function formatDateShort(dateInput?: string | null): string {
  if (!dateInput) return '';
  const str = String(dateInput).trim();
  if (!str) return '';

  // Khoảng ngày dạng "23/07-27/07" hoặc "23/07-DPT" — xử lý từng vế
  if (str.includes('-') && !str.match(/^\d{4}-\d{2}-\d{2}/)) {
    const parts = str.split('-');
    return parts.map((p) => formatSingleDate(p.trim())).join('-');
  }

  return formatSingleDate(str);
}

function formatSingleDate(str: string): string {
  if (!str) return str;
  // Đã là dạng ngắn "24/07" hoặc mã trạng thái như "DPT", "ARR" -> giữ nguyên
  if (/^\d{2}\/\d{2}$/.test(str) || /^[A-ZÀ-Ỹ]+$/.test(str)) return str;

  try {
    const date = new Date(str);
    if (isNaN(date.getTime())) return str;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  } catch {
    return str;
  }
}

/* =========================================================
   MODULE NHIỆM VỤ — style badge TaskStatus + tiện ích tính giờ
   ========================================================= */
export const TASK_STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  'Chưa dọn': { label: 'Chưa dọn', cls: 'bg-slate-100 text-slate-600' },
  'Đang dọn': { label: 'Đang dọn', cls: 'bg-blue-100 text-blue-700' },
  'Hoàn thành': { label: 'Hoàn thành', cls: 'bg-green-100 text-green-700' },
  'Refused': { label: 'PHÒNG KHÔNG LÀM', cls: 'bg-red-100 text-red-700' },
  'DND': { label: 'DND', cls: 'bg-red-100 text-red-700' },
};

/** Giờ hiện tại dạng HH:mm:ss — dùng để ghi StartTime/EndTime khi bấm nút trong module Nhiệm vụ */
export function nowTimeStr(): string {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}

/** CHỈ LẤY GIỜ THỰC dạng HH:mm để hiển thị — chống chịu cả 2 dạng dữ liệu:
 *  - Chuỗi giờ thuần "08:00:58" (dữ liệu đúng chuẩn) -> cắt lấy "08:00"
 *  - Chuỗi ISO hỏng do Google Sheets tự chuyển "1899-12-30T08:00:58.000Z"
 *    (dữ liệu cũ trước khi có fix setNumberFormat ở Code.gs) -> parse ra đúng giờ:phút thật */
export function formatTimeOnly(timeStr?: string | null): string {
  if (!timeStr) return '';
  const str = String(timeStr).trim();
  if (!str) return '';
  // Đã đúng chuẩn "HH:mm" hoặc "HH:mm:ss" -> cắt lấy 5 ký tự đầu
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) return str.slice(0, 5);
  try {
    const date = new Date(str);
    if (isNaN(date.getTime())) return str;
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return str;
  }
}

/** Chuẩn hoá 1 giá trị giờ (chuỗi "HH:mm:ss" chuẩn HOẶC chuỗi ISO hỏng) về dạng "HH:mm:ss" sạch,
 *  dùng nội bộ cho diffMinutes/elapsedSecondsSince — không dùng để hiển thị (dùng formatTimeOnly cho hiển thị). */
function normalizeTimeStr(raw?: string | null): string {
  if (!raw) return '00:00:00';
  const str = String(raw).trim();
  const plain = str.match(/^(\d{2}):(\d{2})(:(\d{2}))?$/);
  if (plain) return `${plain[1]}:${plain[2]}:${plain[4] || '00'}`;
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
  }
  return '00:00:00';
}

/** Số phút chênh lệch giữa 2 mốc giờ (chấp nhận cả "HH:mm:ss" chuẩn lẫn chuỗi ISO hỏng) — làm tròn xuống, tối thiểu 0 */
export function diffMinutes(startTimeStr: string, endTimeStr: string): number {
  const toSeconds = (s: string) => {
    const [h, m, sec] = normalizeTimeStr(s).split(':').map(Number);
    return (h || 0) * 3600 + (m || 0) * 60 + (sec || 0);
  };
  const diff = toSeconds(endTimeStr) - toSeconds(startTimeStr);
  return Math.max(0, Math.floor(diff / 60));
}

/** Số giây đã trôi qua kể từ startTimeStr (chấp nhận cả "HH:mm:ss" chuẩn lẫn chuỗi ISO hỏng) tới hiện tại —
 *  dùng cho đồng hồ đếm giờ sống trên card */
export function elapsedSecondsSince(startTimeStr: string): number {
  if (!startTimeStr) return 0;
  const [h, m, s] = normalizeTimeStr(startTimeStr).split(':').map(Number);
  const start = new Date();
  start.setHours(h || 0, m || 0, s || 0, 0);
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
  return Math.max(0, diff);
}

/** Định dạng số giây thành "mm:ss" cho đồng hồ đếm giờ trên card */
export function formatElapsed(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
