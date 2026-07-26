'use client';

import type { Room } from '@/lib/types';
import {
  getRoomCardStyle, FoStatusIcon, FlagBadgeIcons, PriorityFlagBadges, NoteIcons, hasDndOrRf, combineNotes, formatDateShort,
  FO_STATUS_LABEL, DoorHangerTag, stripCodesFromNote,
} from '@/lib/roomStyles';
import { MessageSquareText } from 'lucide-react';

interface RoomCardProps {
  room: Room;
  onClick: () => void;
  /** Phòng đặc biệt (777/888/999) — chiếm 2 cột trong lưới, nội dung to hơn tương ứng */
  special?: boolean;
  /** Chỉ dùng ở màn Nhiệm vụ — làm mờ + đổi nền pastel khi phòng đã Hoàn thành/DND/Refused,
   *  giúp nhân viên phân biệt ngay phòng nào đã xong. Sơ đồ phòng (Admin) KHÔNG dùng cờ này. */
  dimSettled?: boolean;
}

const SETTLED_BG: Record<string, string> = {
  'Hoàn thành': 'bg-amber-50',
  'DND': 'bg-red-50',
  'Refused': 'bg-purple-50',
};

export default function RoomCard({ room, onClick, special, dimSettled }: RoomCardProps) {
  const { border, bg: defaultBg } = getRoomCardStyle(room.HkStatus, room.isInspecting);
  const combinedNote = combineNotes(room.GhiChu, room.GhiChuNV);
  const { dnd, rf } = hasDndOrRf(combinedNote);

  const isSettled = dimSettled && SETTLED_BG[room.TaskStatus];
  const bg = isSettled ? SETTLED_BG[room.TaskStatus] : defaultBg;
  // Có ghi chú tự do do nhân viên gõ (VD khách yêu cầu riêng) — khác mã hệ thống EB/BBC/HON/DND/RF
  const hasStaffNote = !!stripCodesFromNote(room.GhiChuNV);

  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl cursor-pointer border-4 shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden ${border} ${bg} ${
        isSettled ? 'opacity-60' : ''
      } ${special ? 'p-4' : 'p-3'}`}
    >
      {/* Hàng trên: góc trái = loại phòng (chip xám), góc phải = thẻ treo DND/RF + icon EB/BBC/HON */}
      <div className="flex items-start justify-between gap-1.5 mb-1">
        <span className={`bg-slate-100 text-slate-500 font-bold rounded-md px-1.5 py-0.5 whitespace-nowrap ${special ? 'text-[11px]' : 'text-[9px]'}`}>
          {room.LoaiPhong}
        </span>
        <div className="flex flex-wrap items-start justify-end gap-1 min-w-0">
          <PriorityFlagBadges flags={room.Flags} />
          <FlagBadgeIcons flags={room.Flags} />
          {dnd && <DoorHangerTag label="DND" colorCls="bg-red-600" />}
          {rf && <DoorHangerTag label="RF" colorCls="bg-purple-800" />}
          <NoteIcons note={combinedNote} />
          {hasStaffNote && <MessageSquareText className="w-3.5 h-3.5 text-blue-500" aria-label="Có ghi chú nhân viên" />}
        </div>
      </div>

      {/* Trung tâm: số phòng in đậm lớn + ngày check-in/check-out ngay bên dưới (thay cho tên khách) */}
      <div className="text-center py-1.5">
        <div className={`font-extrabold leading-none text-slate-800 ${special ? 'text-[38px]' : 'text-[27px]'}`}>
          {room.MaPhong}
        </div>
        <div className={`text-slate-400 font-semibold mt-0.5 ${special ? 'text-[12px]' : 'text-[10px]'}`}>
          {formatDateShort(room.NgayO)}
        </div>
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
