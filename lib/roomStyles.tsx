import { PlaneLanding, PlaneTakeoff, BedDouble } from 'lucide-react';
import type { HkStatus, FoStatus } from './types';

/* =========================================================
   MỤC 2 — QUY TẮC MÀU SẮC THẺ PHÒNG (dựa trên HK Status)
   ========================================================= */
export const HK_STYLE: Record<HkStatus, { border: string; bg: string }> = {
  'Phòng dơ': { border: 'border-l-4 border-l-red-500', bg: 'bg-white' },
  'Phòng đang dọn': { border: 'border-l-4 border-l-red-500', bg: 'bg-blue-50' },
  'Phòng sạch': { border: 'border-l-4 border-l-yellow-400', bg: 'bg-white' },
  'Đã kiểm tra': { border: 'border-l-4 border-l-green-500', bg: 'bg-white' },
  'Phòng sửa chữa (OOO)': { border: 'border-l-4 border-l-slate-400', bg: 'bg-slate-100' },
};

/** Nền tạm thời khi phòng đang trong quá trình kiểm phòng (mục 3) */
export const INSPECTING_BG = 'bg-amber-100';

/** Trả về class border + background cho 1 phòng, có tính đến trạng thái isInspecting tạm thời */
export function getRoomCardStyle(hkStatus: HkStatus, isInspecting: boolean) {
  const base = HK_STYLE[hkStatus] ?? HK_STYLE['Phòng dơ'];
  return {
    border: base.border,
    bg: isInspecting ? INSPECTING_BG : base.bg,
  };
}

/* =========================================================
   MỤC 1 — QUY TẮC ICON THEO FO STATUS (Lucide React)
   ========================================================= */
export function FoStatusIcon({ status }: { status: FoStatus }) {
  const cls = 'w-3.5 h-3.5';
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
