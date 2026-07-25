import { PlaneLanding, PlaneTakeoff, BedDouble, Bell, PenTool, Wrench, BedSingle, Baby, Wine } from 'lucide-react';
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
    default:
      // Vacant: không hiển thị icon
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
