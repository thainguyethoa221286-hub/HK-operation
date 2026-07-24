import { PlaneLanding, PlaneTakeoff, BedDouble } from 'lucide-react';
import type { HkStatus, FoStatus } from './types';

/* =========================================================
   MỤC 2 — QUY TẮC MÀU SẮC THẺ PHÒNG (dựa trên HK Status)
   Nền LUÔN là trắng — chỉ dải viền trái đổi màu theo trạng thái.
   ========================================================= */
export const HK_STYLE: Record<HkStatus, { border: string }> = {
  'Phòng dơ': { border: 'border-l-red-500' },
  'Phòng đang dọn': { border: 'border-l-blue-500' },
  'Phòng sạch': { border: 'border-l-yellow-400' },
  'Đã kiểm tra': { border: 'border-l-green-500' },
  'Phòng sửa chữa (OOO)': { border: 'border-l-slate-400' },
};

/** Nền tạm thời khi phòng đang trong quá trình kiểm phòng (mục 3) — NGOẠI LỆ DUY NHẤT đổi nền */
export const INSPECTING_BG = 'bg-yellow-100';

/** Trả về class border + background cho 1 phòng, có tính đến trạng thái isInspecting tạm thời */
export function getRoomCardStyle(hkStatus: HkStatus, isInspecting: boolean) {
  const base = HK_STYLE[hkStatus] ?? HK_STYLE['Phòng dơ'];
  return {
    border: base.border,
    bg: isInspecting ? INSPECTING_BG : 'bg-white',
  };
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
