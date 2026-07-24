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
   MỤC 3 — NHẬN DIỆN DND / REFUSE TRONG GHI CHÚ
   ========================================================= */
export function hasDndOrRf(note: string): { dnd: boolean; rf: boolean } {
  if (!note) return { dnd: false, rf: false };
  const upper = note.toUpperCase();
  return {
    dnd: upper.includes('DND'),
    rf: upper.includes('REFUSE') || upper.includes('TỪ CHỐI'),
  };
}

export function DndRfBadge({ note }: { note: string }) {
  const { dnd, rf } = hasDndOrRf(note);
  if (!dnd && !rf) return null;
  return (
    <div className="flex items-center gap-1">
      {dnd && <span className="bg-red-100 text-red-700 font-bold px-1 rounded text-[9px]">DND</span>}
      {rf && <span className="bg-slate-200 text-slate-700 font-bold px-1 rounded text-[9px]">RF</span>}
    </div>
  );
}
export function NoteIcons({ note }: { note: string }) {
  if (!note) return null;
  const upperNote = note.toUpperCase();
  const cls = 'w-3.5 h-3.5';
  const hasEB = upperNote.includes('EB');
  const hasBBC = upperNote.includes('BBC');
  const hasHON = upperNote.includes('HON');
  if (!hasEB && !hasBBC && !hasHON) return null;
  return (
    <div className="flex items-center gap-1">
      {hasEB && <BedSingle className={`${cls} text-indigo-600`} aria-label="Extra Bed" />}
      {hasBBC && <Baby className={`${cls} text-pink-500`} aria-label="Baby Cot" />}
      {hasHON && <Wine className={`${cls} text-rose-600`} aria-label="Honeymoon" />}
    </div>
  );
}
