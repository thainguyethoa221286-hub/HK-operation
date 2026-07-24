'use client';

import type { Room } from '@/lib/types';
import { getRoomCardStyle, FoStatusIcon } from '@/lib/roomStyles';

interface RoomCardProps {
  room: Room;
  onClick: () => void;
}

export default function RoomCard({ room, onClick }: RoomCardProps) {
  const { border, bg } = getRoomCardStyle(room.HkStatus, room.isInspecting);
  const hasFlag = Boolean(room.GhiChu);

  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl p-2.5 cursor-pointer shadow-sm transition-colors duration-200 ${border} ${bg}`}
    >
      {hasFlag && (
        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">
          !
        </span>
      )}

      <div className="text-[9px] font-bold tracking-wide text-slate-500">
        {room.LoaiPhong}
      </div>
      <div className="text-[23px] font-extrabold leading-tight text-slate-800">
        {room.MaPhong}
      </div>

      <div className="flex items-center justify-between mt-1.5 text-[9px] text-slate-500 gap-1">
        <span className="flex items-center gap-1">
          <FoStatusIcon status={room.FoStatus} />
          {room.NgayO}
        </span>
        <span className="bg-slate-100 rounded px-1.5 py-0.5 font-bold text-slate-500 whitespace-nowrap">
          {room.NhanVienPhuTrach}
        </span>
      </div>

      {room.isInspecting && (
        <div className="mt-1 text-[9px] font-bold text-amber-700">● Đang kiểm phòng</div>
      )}
    </div>
  );
}
