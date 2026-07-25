'use client';

import type { Room } from '@/lib/types';
import { getRoomCardStyle, FoStatusIcon, FlagBadgeIcons, NoteIcons, hasDndOrRf, combineNotes, formatDateShort } from '@/lib/roomStyles';

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
      className={`relative rounded-lg cursor-pointer shadow-sm border-l-[6px] transition-all duration-200 overflow-hidden ${border} ${bg} ${
        special ? 'p-3.5' : 'p-2.5'
      }`}
    >
      {/* Thẻ treo cửa DND/RF, móc phía trên góc số phòng — hiện đồng thời nếu có cả 2 */}
      {(dnd || rf) && (
        <div className="absolute -top-1 left-2 flex items-start gap-1 z-10">
          {dnd && (
            <div className="flex flex-col items-center">
              <div className="w-[2px] h-1.5 bg-slate-400" />
              <div className="px-1.5 py-[1px] rounded-sm text-[8px] font-extrabold text-white shadow bg-red-600">
                DND
              </div>
            </div>
          )}
          {rf && (
            <div className="flex flex-col items-center">
              <div className="w-[2px] h-1.5 bg-slate-400" />
              <div className="px-1.5 py-[1px] rounded-sm text-[8px] font-extrabold text-white shadow bg-purple-800">
                RF
              </div>
            </div>
          )}
        </div>
      )}

      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-10">
        <FlagBadgeIcons flags={room.Flags} />
        <NoteIcons note={combinedNote} />
      </div>

      <div className={`font-bold tracking-wide text-slate-500 ${special ? 'text-[11px]' : 'text-[9px]'}`}>
        {room.LoaiPhong}
      </div>
      <div className={`font-extrabold leading-tight text-slate-800 ${special ? 'text-[32px]' : 'text-[23px]'}`}>
        {room.MaPhong}
      </div>

      <div className={`flex items-center justify-between mt-1.5 text-slate-600 gap-1 ${special ? 'text-[12px]' : 'text-[10px]'}`}>
        <span className="flex items-center gap-1 font-medium">
          <FoStatusIcon status={room.FoStatus} />
          {formatDateShort(room.NgayO)}
        </span>
        {room.NhanVienPhuTrach && (
          <span className="bg-slate-100 rounded px-1.5 py-0.5 font-bold text-slate-500 whitespace-nowrap">
            {room.NhanVienPhuTrach}
          </span>
        )}
      </div>

      {room.isInspecting && (
        <div className="mt-1 text-[9px] font-bold text-yellow-700">● Đang kiểm phòng</div>
      )}
    </div>
  );
}
