'use client';

import { memo } from 'react';
import type { Room } from '@/lib/types';
import {
  getRoomCardStyle, FoStatusIcon, FlagBadgeIcons, PriorityFlagBadges, NoteIcons, hasDndOrRf, combineNotes, formatDateShort,
  FO_STATUS_LABEL, stripCodesFromNote, LinenChangeIcon,
} from '@/lib/roomStyles';
import { Pin } from 'lucide-react';

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

function RoomCard({ room, onClick, special, dimSettled }: RoomCardProps) {
  const { border, bg: defaultBg } = getRoomCardStyle(room.HkStatus, room.isInspecting);
  const combinedNote = combineNotes(room.GhiChu, room.GhiChuNV, room.GhiChuAdmin);
  const { dnd, rf } = hasDndOrRf(combinedNote);

  const flagList = (room.Flags || '').split(',').map((f) => f.trim());
  // RUSH/MKR tự động bị gỡ khỏi Flags ngay khi phòng chuyển DND/Refused (xem RoomTaskModal),
  // nên phòng DND/RF/Hoàn thành luôn được làm mờ bình thường, không còn ngoại lệ giữ RÕ cho MKR nữa.
  const isSettled = dimSettled && SETTLED_BG[room.TaskStatus];
  // Cờ "Đã out" (DaOut) — nền ĐỎ NHẠT chỉ khi phòng CÒN CHƯA BẮT ĐẦU DỌN ("Phòng dơ").
  // Ngay khi nhân viên bấm "Bắt đầu dọn phòng" (HkStatus -> "Phòng đang dọn"), nền phải chuyển
  // XANH DƯƠNG NHẠT theo đúng viền (không còn giữ đỏ nữa) để phản ánh đúng đang xử lý.
  const hasDaOut = flagList.includes('DaOut');
  const daOutActive = hasDaOut && !room.isInspecting && room.HkStatus === 'Phòng dơ';
  const isCleaningNow = room.HkStatus === 'Phòng đang dọn';
  const bg = isSettled ? SETTLED_BG[room.TaskStatus] : isCleaningNow ? 'bg-blue-50' : daOutActive ? 'bg-red-50' : defaultBg;
  // Ghi chú đặc biệt (VD "Khách dị ứng lông mèo") — CHỈ tính phần ghi chú TỰ DO thật sự, đã lọc bỏ
  // HẾT các mã hệ thống đã có Badge/Icon riêng (EB/BBC/HON/DND/RF/LSG/BC) khỏi CẢ 2 nguồn: ghi chú
  // Giám sát (GhiChuAdmin) VÀ ghi chú nhân viên (GhiChuNV). TRƯỚC ĐÂY chỉ lọc GhiChuNV, còn
  // GhiChuAdmin giữ nguyên -> nếu Giám sát chỉ gõ đúng "LSG" (không có nội dung gì khác) thì Icon
  // Ghim vẫn hiện thừa dù mã LSG đã có badge đỏ riêng rồi (đúng lỗi được báo). Icon Ghim giờ CHỈ hiện
  // khi còn lại nội dung chữ thật sự sau khi đã lọc hết mã hệ thống.
  const specialNoteText = [stripCodesFromNote(room.GhiChuAdmin), stripCodesFromNote(room.GhiChuNV)]
    .filter(Boolean)
    .join(' • ');

  // Vạch mép cửa, màu chữ trạng thái khách và đèn LED khoá từ — suy ra TỪ ĐÚNG class viền theo HkStatus
  // (getRoomCardStyle), nên quy tắc màu Phòng dơ/đang dọn/sạch/đã kiểm tra/OOO/đang kiểm phòng giữ nguyên.
  const accent = ACCENT[border] ?? ACCENT['border-red-500'];
  // Ô ván cửa: phòng nền trắng dùng gradient nhẹ cho có khối; phòng có nền trạng thái (đang dọn, đang kiểm,
  // Đã out, Hoàn thành/DND/Refused ở màn Nhiệm vụ) giữ nguyên đúng màu nền đó.
  const panelBg = bg === 'bg-white' ? 'bg-gradient-to-br from-slate-50 via-white to-slate-100' : bg;

  return (
    <div
      onClick={onClick}
      className={`group relative h-full cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${isSettled ? 'opacity-60' : ''}`}
    >
      {/* Khung cửa (gờ nổi ngoài) */}
      <div className={`relative h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_6px_rgba(15,23,42,0.08),0_8px_18px_-8px_rgba(15,23,42,0.18)] group-hover:shadow-[0_4px_10px_rgba(15,23,42,0.10),0_14px_26px_-10px_rgba(15,23,42,0.25)] transition-shadow ${special ? 'p-3 pl-5' : 'p-2 pl-3.5'}`}>
        {/* Mép cửa — vạch màu theo tình trạng phòng */}
        <div className={`absolute inset-y-0 left-0 ${special ? 'w-2' : 'w-1.5'} ${accent.bar}`} />

        {/* Ô ván cửa lõm (Recessed Door Panel) */}
        <div className={`relative h-full flex flex-col rounded-xl border border-slate-200/80 shadow-[inset_0_2px_5px_rgba(15,23,42,0.10),inset_0_-2px_0_rgba(255,255,255,0.9)] ${panelBg} ${special ? 'p-3.5 pr-12' : 'p-2.5 pr-9'}`}>
          {/* Hàng trên: trái = biển tên loại phòng (kim loại); phải = icon thông tin (ghim, Rush/MKR, sửa chữa, EB/BBC/HON/LSG) */}
          <div className="flex items-start justify-between gap-1.5">
            <span className={`relative inline-flex items-center rounded-[5px] border border-slate-300 bg-gradient-to-b from-white via-slate-100 to-slate-300 font-extrabold tracking-wider text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.25),inset_0_1px_0_rgba(255,255,255,0.95)] whitespace-nowrap flex-shrink-0 ${special ? 'text-[12px] px-2.5 py-0.5' : 'text-[9px] px-2 py-[1px]'}`}>
              <span className="absolute left-[3px] top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full bg-slate-400" />
              {room.LoaiPhong}
              <span className="absolute right-[3px] top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full bg-slate-400" />
            </span>
            <div className="flex flex-wrap items-start justify-end gap-1 min-w-0">
              {specialNoteText && <Pin className="w-3.5 h-3.5 text-rose-500 fill-rose-100" aria-label="Ghi chú đặc biệt" />}
              <PriorityFlagBadges flags={room.Flags} />
              <FlagBadgeIcons flags={room.Flags} />
              <NoteIcons note={combinedNote} ngayO={room.NgayO} />
            </div>
          </div>

          {/* Số phòng to, căn trái (kèm icon gối nếu đúng lịch thay ga) + ngày in/out ngay bên dưới */}
          <div className="mt-1">
            <div className="flex items-center gap-1.5">
              <span className={`font-extrabold leading-none tracking-tight text-slate-800 drop-shadow-[0_1px_0_rgba(255,255,255,0.9)] ${special ? 'text-[40px]' : 'text-[28px]'}`}>
                {room.MaPhong}
              </span>
              <LinenChangeIcon room={room} />
            </div>
            <div className={`text-slate-400 font-semibold mt-1 mb-2 min-h-[1em] ${special ? 'text-[12px]' : 'text-[10px]'}`}>
              {formatDateShort(room.NgayO)}
            </div>
          </div>

          {/* Chân cửa: trái = icon máy bay/giường/nhà + trạng thái khách (cùng màu vạch cửa), phải = tên nhân viên */}
          <div className="flex items-center justify-between gap-1.5 mt-auto pt-2 border-t border-slate-200/80">
            <span className={`flex items-center gap-1 font-semibold min-w-0 [&_svg]:!text-current ${accent.text} ${special ? 'text-[13px]' : 'text-[10px]'}`}>
              <FoStatusIcon status={room.FoStatus} />
              <span className="truncate">{FO_STATUS_LABEL[room.FoStatus]}</span>
            </span>
            {room.NhanVienPhuTrach && (
              <span className={`bg-slate-100 border border-slate-200 text-slate-700 font-bold uppercase rounded-md px-1.5 py-0.5 whitespace-nowrap truncate max-w-[55%] ${special ? 'text-[11px]' : 'text-[9px]'}`}>
                {room.NhanVienPhuTrach}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bộ khoá từ thông minh (thân đen bóng + mắt đọc thẻ + đèn LED màu trạng thái) + tay gạt kim loại 3D.
          Thẻ treo DND/RF móc từ ổ khoá, nghiêng và đung đưa nhẹ, được phép thò ra ngoài mép cửa như thật. */}
      <div className={`pointer-events-none absolute ${special ? 'right-4 top-[22%]' : 'right-3 top-[20%]'}`}>
        <div className={`relative rounded-[7px] bg-gradient-to-br from-slate-600 via-slate-800 to-slate-950 border border-slate-900 shadow-[0_3px_6px_rgba(15,23,42,0.35),inset_1px_1px_0_rgba(255,255,255,0.18)] flex flex-col items-center ${special ? 'w-[22px] h-[60px] pt-1.5' : 'w-[17px] h-[46px] pt-1'}`}>
          {/* Mắt cảm biến thẻ từ */}
          <span className={`rounded-[3px] bg-slate-950 border border-slate-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] ${special ? 'w-[12px] h-[9px]' : 'w-[9px] h-[7px]'}`} />
          {/* Đèn LED */}
          <span className={`mt-1.5 rounded-full ${accent.led} ${special ? 'w-[5px] h-[5px]' : 'w-[4px] h-[4px]'}`} />
          {/* Vệt bóng loáng */}
          <span className="absolute top-1 left-[3px] w-[2px] h-[60%] rounded-full bg-white/10" />
        </div>
        {/* Tay gạt kim loại 3D — chìa sang trái từ phần dưới ổ khoá */}
        <span className={`absolute rounded-full bg-gradient-to-b from-slate-100 via-slate-300 to-slate-500 border border-slate-400/70 shadow-[0_2px_3px_rgba(15,23,42,0.35)] ${special ? 'right-[8px] bottom-[10px] w-[34px] h-[9px]' : 'right-[6px] bottom-[7px] w-[26px] h-[7px]'}`} />
        {(dnd || rf) && (
          <>
            <style>{`@keyframes hkHangerSwing{0%,100%{transform:translateX(-50%) rotate(7deg)}50%{transform:translateX(-50%) rotate(-3deg)}}`}</style>
            <div
              className={`absolute left-1/2 flex flex-col items-center gap-1 origin-top ${special ? 'top-[44px]' : 'top-[33px]'}`}
              style={{ animation: 'hkHangerSwing 3.2s ease-in-out infinite', transform: 'translateX(-50%) rotate(7deg)' }}
            >
              {dnd && <HangerTag label="DND" cls="from-red-500 to-red-700" big={special} />}
              {rf && <HangerTag label="RF" cls="from-teal-500 to-teal-700" big={special} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Màu vạch mép cửa, chữ trạng thái khách và đèn LED khoá từ — tra theo class viền HkStatus
 *  (viết đủ tên class để Tailwind sinh CSS) */
const ACCENT: Record<string, { bar: string; text: string; led: string }> = {
  'border-red-500': { bar: 'bg-red-500', text: 'text-red-600', led: 'bg-red-400 shadow-[0_0_5px_2px_rgba(248,113,113,0.85)]' },
  'border-blue-500': { bar: 'bg-blue-500', text: 'text-blue-600', led: 'bg-blue-400 shadow-[0_0_5px_2px_rgba(96,165,250,0.85)]' },
  'border-amber-400': { bar: 'bg-amber-400', text: 'text-amber-600', led: 'bg-amber-400 shadow-[0_0_5px_2px_rgba(251,191,36,0.85)]' },
  'border-emerald-500': { bar: 'bg-emerald-500', text: 'text-emerald-600', led: 'bg-emerald-400 shadow-[0_0_5px_2px_rgba(52,211,153,0.85)]' },
  'border-slate-400': { bar: 'bg-slate-400', text: 'text-slate-500', led: 'bg-slate-300 shadow-[0_0_4px_1px_rgba(203,213,225,0.7)]' },
  'border-purple-500': { bar: 'bg-purple-500', text: 'text-purple-600', led: 'bg-purple-400 shadow-[0_0_5px_2px_rgba(192,132,252,0.85)]' },
};

/** Thẻ treo tay nắm cửa: lỗ tròn trắng phía trên (xỏ vào ổ khoá) + chữ đậm phía dưới, nền gradient có khối */
function HangerTag({ label, cls, big }: { label: string; cls: string; big?: boolean }) {
  return (
    <div className={`relative flex flex-col items-center rounded-md bg-gradient-to-b ${cls} border border-black/10 shadow-[0_4px_8px_rgba(15,23,42,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] ${big ? 'w-[32px] pt-[20px] pb-2' : 'w-[24px] pt-[15px] pb-1.5'}`}>
      <span className={`absolute top-1 rounded-full bg-white shadow-[inset_0_1px_2px_rgba(15,23,42,0.4)] ${big ? 'w-[9px] h-[9px]' : 'w-[7px] h-[7px]'}`} />
      <span className={`font-extrabold text-white leading-none drop-shadow-sm ${big ? 'text-[10px]' : 'text-[8px]'}`}>{label}</span>
    </div>
  );
}

export default memo(RoomCard);
