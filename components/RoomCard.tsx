'use client';

import type { Room } from '@/lib/types';
import { getRoomCardStyle, FoStatusIcon, FlagBadgeIcons, NoteIcons } from '@/lib/roomStyles';

interface RoomCardProps {
  room: Room;
  onClick: () => void;
}

export default function RoomCard({ room, onClick }: RoomCardProps) {
  const { border, bg } = getRoomCardStyle(room.HkStatus, room.isInspecting);

  return (
    <div
      onClick={onClick}
      className={`relative rounded-lg p-2.5 cursor-pointer shadow-sm border-l-[6px] transition-all duration-200 ${border} ${bg}`}
    >
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
        <FlagBadgeIcons flags={room.Flags} />
        <NoteIcons note={room.GhiChu} />
      </div>

      <div className="text-[9px] font-bold tracking-wide text-slate-500">
        {room.LoaiPhong}
      </div>
      <div className="text-[23px] font-extrabold leading-tight text-slate-800">
        {room.MaPhong}
      </div>

      <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-600 gap-1">
        <span className="flex items-center gap-1 font-medium">
          <FoStatusIcon status={room.FoStatus} />
          {room.NgayO}
        </span>
        <span className="bg-slate-100 rounded px-1.5 py-0.5 font-bold text-slate-500 whitespace-nowrap">
          {room.NhanVienPhuTrach}
        </span>
      </div>

      {room.isInspecting && (
        <div className="mt-1 text-[9px] font-bold text-yellow-700">● Đang kiểm phòng</div>
      )}
    </div>
  );
}
