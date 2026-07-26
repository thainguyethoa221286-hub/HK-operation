'use client';

import type { Room } from '@/lib/types';
import {
  getRoomCardStyle, FoStatusIcon, FlagBadgeIcons, NoteIcons, hasDndOrRf, combineNotes, formatDateShort,
  FO_STATUS_LABEL, DoorHangerTag,
} from '@/lib/roomStyles';

interface RoomCardProps {
  room: Room;
  onClick: () => void;
  /** Phòng đặc biệt (777/888/999) — chiếm 2 cột trong lưới, nội dung to hơn tương ứng */
  special?: boolean;
}

export default function RoomCard({ room, onClick, special }: RoomCardProps) {
  const { border, bg } = getRoomCardStyle(room.HkStatus, room.isInspecting);
  const combinedNote = combineNotes(room.GhiChu, room.GhiChuNV);
  const { dnd, rf } = hasDndOrRf(combinedNote);

  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl cursor-pointer border-2 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${border} ${bg} ${
        special ? 'p-4' : 'p-3'
      }`}
    >
      {/* Hàng trên: góc trái = loại phòng (chip xám), góc phải = thẻ treo DND/RF + icon EB/BBC/HON + ngày check-in/out */}
      <div className="flex items-start justify-between gap-1.5 mb-1">
        <span className={`bg-slate-100 text-slate-500 font-bold rounded-md px-1.5 py-0.5 whitespace-nowrap ${special ? 'text-[11px]' : 'text-[9px]'}`}>
          {room.LoaiPhong}
        </span>
        <div className="flex flex-wrap items-start justify-end gap-1 min-w-0">
          <FlagBadgeIcons flags={room.Flags} />
          {dnd && <DoorHangerTag label="DND" colorCls="bg-red-600" />}
          {rf && <DoorHangerTag label="RF" colorCls="bg-purple-800" />}
          <NoteIcons note={combinedNote} />
          {/* Bỏ tên khách — chỉ hiện ngày check-in/check-out (VD "24/07 - 26/07") */}
          <span className={`text-slate-400 font-semibold whitespace-nowrap ${special ? 'text-[11px]' : 'text-[9px]'}`}>
            {formatDateShort(room.NgayO)}
          </span>
        </div>
      </div>

      {/* Trung tâm: số phòng in đậm lớn */}
      <div className={`font-extrabold leading-none text-slate-800 text-center py-1.5 ${special ? 'text-[38px]' : 'text-[27px]'}`}>
        {room.MaPhong}
      </div>

      {/* Chân thẻ: trái = icon + trạng thái khách, phải = CHỈ tên nhân viên dọn (để trống nếu chưa gán) */}
      <div className="flex items-center justify-between gap-1.5 mt-1">
        <span className={`flex items-center gap-1 font-semibold text-slate-500 min-w-0 ${special ? 'text-[11px]' : 'text-[9px]'}`}>
          <FoStatusIcon status={room.FoStatus} />
          <span className="truncate">{FO_STATUS_LABEL[room.FoStatus]}</span>
        </span>
        {room.NhanVienPhuTrach && (
          <span className={`bg-slate-700 text-white font-bold rounded-full px-2 py-0.5 whitespace-nowrap truncate max-w-[60%] ${special ? 'text-[11px]' : 'text-[9px]'}`}>
            {room.NhanVienPhuTrach}
          </span>
        )}
      </div>
    </div>
  );
}
