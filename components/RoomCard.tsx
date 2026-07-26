'use client';

import type { Room } from '@/lib/types';
import {
  FoStatusIcon, FlagBadgeIcons, NoteIcons, hasDndOrRf, combineNotes, formatDateShort,
  HK_STATUS_PILL, FO_STATUS_LABEL, elapsedSecondsSince, formatElapsed,
} from '@/lib/roomStyles';

interface RoomCardProps {
  room: Room;
  onClick: () => void;
  /** Phòng đặc biệt (777/888/999) — chiếm 2 cột trong lưới, nội dung to hơn tương ứng */
  special?: boolean;
}

export default function RoomCard({ room, onClick, special }: RoomCardProps) {
  const combinedNote = combineNotes(room.GhiChu, room.GhiChuNV);
  const { dnd, rf } = hasDndOrRf(combinedNote);
  const pill = HK_STATUS_PILL[room.HkStatus] ?? HK_STATUS_PILL['Phòng dơ'];
  const isCleaning = room.HkStatus === 'Phòng đang dọn' && room.StartTime;

  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl cursor-pointer bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
        room.isInspecting ? 'ring-2 ring-yellow-300' : ''
      } ${special ? 'p-4' : 'p-3'}`}
    >
      {/* Hàng trên: góc trái = loại phòng (chip xám), góc phải = badge dịch vụ + ngày */}
      <div className="flex items-start justify-between gap-1.5 mb-1">
        <span className={`bg-slate-100 text-slate-500 font-bold rounded-md px-1.5 py-0.5 whitespace-nowrap ${special ? 'text-[11px]' : 'text-[9px]'}`}>
          {room.LoaiPhong}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-1 min-w-0">
          <FlagBadgeIcons flags={room.Flags} />
          {dnd && <span className="bg-red-600 text-white font-extrabold px-1.5 py-[1px] rounded text-[8px]">DND</span>}
          {rf && <span className="bg-purple-800 text-white font-extrabold px-1.5 py-[1px] rounded text-[8px]">RF</span>}
          <NoteIcons note={combinedNote} />
          <span className={`text-slate-400 font-semibold whitespace-nowrap ${special ? 'text-[11px]' : 'text-[9px]'}`}>
            {formatDateShort(room.NgayO)}
          </span>
        </div>
      </div>

      {/* Trung tâm: số phòng in đậm lớn */}
      <div className={`font-extrabold leading-none text-slate-800 text-center py-1.5 ${special ? 'text-[38px]' : 'text-[27px]'}`}>
        {room.MaPhong}
      </div>

      {/* Chân thẻ: trái = icon + trạng thái khách, phải = badge màu theo HkStatus, CHỮ là tên nhân viên phụ trách
          (nếu chưa gán ai thì hiện lại nhãn trạng thái như cũ) */}
      <div className="flex items-center justify-between gap-1.5 mt-1">
        <span className={`flex items-center gap-1 font-semibold text-slate-500 min-w-0 ${special ? 'text-[11px]' : 'text-[9px]'}`}>
          <FoStatusIcon status={room.FoStatus} />
          <span className="truncate">{FO_STATUS_LABEL[room.FoStatus]}</span>
        </span>
        <span className={`flex items-center gap-1 font-extrabold rounded-full px-2 py-0.5 whitespace-nowrap truncate max-w-[65%] ${pill.cls} ${special ? 'text-[11px]' : 'text-[9px]'}`}>
          {room.NhanVienPhuTrach || pill.label}
          {isCleaning && <span className="opacity-90">{formatElapsed(elapsedSecondsSince(room.StartTime))}</span>}
        </span>
      </div>
    </div>
  );
}
