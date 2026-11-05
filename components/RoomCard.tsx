'use client';

import { memo } from 'react';
import { isPmLabel, labelNames } from '@/lib/assignHelpers';
import type { Room } from '@/lib/types';
import {
  getRoomCardStyle, FoStatusIcon, FlagBadgeIcons, NoteIcons, hasDndOrRf, combineNotes, formatDateShort,
  FO_STATUS_LABEL, stripCodesFromNote, LinenChangeIcon, formatTimeOnly,
} from '@/lib/roomStyles';
import { Pin, Zap, Check } from 'lucide-react';

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
  const hasRush = flagList.includes('CayBac');
  const hasMkr = flagList.includes('TrangDiem');
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

  // Màn Nhiệm vụ: phòng ĐÃ XONG (Hoàn thành / DND / Refused) KHÔNG còn làm mờ nữa — hiện thành
  // CÁNH CỬA GỖ XÁM đóng kín (cùng tông với cửa trong bảng chi tiết phòng), kèm badge ĐÃ DỌN hoặc
  // thẻ treo DND/RF nhỏ trên tay nắm. Bấm vào vẫn mở bảng chi tiết như cũ.
  if (isSettled) {
    return <SettledDoor room={room} onClick={onClick} special={special} />;
  }

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
            <div className="flex flex-wrap items-center justify-end gap-1 min-w-0 pt-[1px]">
              {specialNoteText && <Pin className="w-3.5 h-3.5 text-rose-500 fill-rose-100" aria-label="Ghi chú đặc biệt" />}
              {/* RUSH — chip TRÒN NHỎ chỉ có icon (không chữ) để không đè lên biển tên loại phòng.
                  MKR giờ là THẺ TREO xanh dương móc trên tay nắm cửa (xem bên dưới). */}
              {hasRush && (
                <span title="RUSH" aria-label="Rush" className={`rounded-full bg-orange-500 text-white flex items-center justify-center shadow-sm ring-2 ring-orange-200 animate-pulse flex-shrink-0 ${special ? 'w-5 h-5' : 'w-4 h-4'}`}>
                  <Zap className={`${special ? 'w-3 h-3' : 'w-2.5 h-2.5'} fill-white`} />
                </span>
              )}
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

          {/* Chân cửa: dòng 1 = icon máy bay/giường/nhà + trạng thái khách (cùng màu vạch cửa);
              dòng 2 = BẢNG TÊN nhân viên phụ trách — dòng riêng, đủ chỗ hiện tên, không bị cắt "H...".
              Ca chiều (PM Shift) -> bảng tên nền VÀNG, chỉ hiện tên nhân viên ca chiều. */}
          <div className="mt-auto pt-2 border-t border-slate-200/80 flex flex-col gap-1">
            <span className={`flex items-center gap-1 font-semibold min-w-0 [&_svg]:!text-current ${accent.text} ${special ? 'text-[13px]' : 'text-[10px]'}`}>
              <FoStatusIcon status={room.FoStatus} />
              <span className="truncate">{FO_STATUS_LABEL[room.FoStatus]}</span>
            </span>
            {room.NhanVienPhuTrach && (() => {
              const pm = isPmLabel(room.NhanVienPhuTrach);
              const name = (pm ? labelNames(room.NhanVienPhuTrach).join(' + ') || 'PM' : labelNames(room.NhanVienPhuTrach).join(' + ') || room.NhanVienPhuTrach);
              return (
                <span
                  title={pm ? `Ca chiều (PM Shift): ${name}` : name}
                  className={`self-start max-w-full flex items-center rounded-md border font-bold uppercase leading-[1.2] ${
                    pm ? 'bg-amber-300 border-amber-400 text-amber-950' : 'bg-slate-100 border-slate-200 text-slate-700'
                  } ${special ? 'text-[11px] px-2 py-1' : 'text-[9.5px] px-1.5 py-[3px]'}`}
                >
                  <span className="truncate">{name}</span>
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Ổ khoá: SƠ ĐỒ PHÒNG dùng khoá thẻ từ DÁNG MẢNH (kiểu A); màn NHIỆM VỤ (dimSettled) giữ khoá đen cũ.
          Thẻ treo DND/RF/MKR móc từ ổ khoá, đung đưa nhẹ. */}
      <div className={`pointer-events-none absolute ${dimSettled ? (special ? 'right-4 top-[22%]' : 'right-3 top-[20%]') : (special ? 'right-5 top-[24%]' : 'right-3.5 top-[22%]')}`}>
        {dimSettled ? (
          <>
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
          </>
        ) : (
          <>
        <div className={`relative rounded-full bg-gradient-to-r from-slate-300 via-slate-50 to-slate-400 border border-slate-400/60 shadow-[0_2px_3px_rgba(15,23,42,0.3)] ${special ? 'w-[15px] h-[54px]' : 'w-[12px] h-[40px]'}`}>
          {/* Khe đọc thẻ */}
          <span className={`absolute left-1/2 -translate-x-1/2 rounded-[3px] bg-slate-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.7)] ${special ? 'top-[7px] w-[8px] h-[14px]' : 'top-[5px] w-[6px] h-[10px]'}`} />
          {/* Đèn LED */}
          <span className={`absolute left-1/2 -translate-x-1/2 rounded-full ${accent.led} ${special ? 'top-[25px] w-[5px] h-[5px]' : 'top-[19px] w-[4px] h-[4px]'}`} />
        </div>
        {/* Tay gạt inox nhỏ — chìa vào trong cửa */}
        <span className={`absolute rounded-full bg-gradient-to-b from-slate-50 via-slate-300 to-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.35)] ${special ? 'right-[7px] top-[36px] w-[30px] h-[6px]' : 'right-[5px] top-[27px] w-[22px] h-[5px]'}`} />
        <span className={`absolute rounded-full bg-gradient-to-br from-white to-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.4)] ${special ? 'right-[3px] top-[34px] w-[9px] h-[9px]' : 'right-[2px] top-[25.5px] w-[8px] h-[8px]'}`} />
          </>
        )}
        {(dnd || rf || hasMkr) && (
          <>
            <style>{`@keyframes hkHangerSwing{0%,100%{transform:translateX(-50%) rotate(7deg)}50%{transform:translateX(-50%) rotate(-3deg)}}`}</style>
            <div
              className={`absolute left-1/2 flex flex-col items-center gap-1 origin-top ${dimSettled ? (special ? 'top-[44px]' : 'top-[33px]') : (special ? 'top-[44px]' : 'top-[32px]')}`}
              style={{ animation: 'hkHangerSwing 3.2s ease-in-out infinite', transform: 'translateX(-50%) rotate(7deg)' }}
            >
              {dnd && (dimSettled ? <HangerTag label="DND" cls="from-red-500 to-red-700" big={special} /> : <RopeHangerTag label="DND" cls="from-red-500 to-red-700" big={special} />)}
              {rf && (dimSettled ? <HangerTag label="RF" cls="from-purple-500 to-purple-800" big={special} /> : <RopeHangerTag label="RF" cls="from-purple-500 to-purple-800" big={special} />)}
              {hasMkr && (dimSettled ? <HangerTag label="MKR" cls="from-blue-500 to-blue-700" big={special} /> : <RopeHangerTag label="MKR" cls="from-blue-500 to-blue-700" big={special} />)}
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
/** Thẻ treo DÁNG MÓC DÂY THỪNG (Sơ đồ phòng): dây xoắn đen + nút thắt, thẻ hẹp bo góc,
 *  chữ DND / RF / MKR xếp dọc vừa thân thẻ, kiểu chữ có chân. Màu giữ nguyên đỏ / tím / xanh. */
function RopeHangerTag({ label, cls, big }: { label: string; cls: string; big?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 10 14" className={big ? 'w-[12px] h-[16px]' : 'w-[10px] h-[13px]'} aria-hidden="true">
        <path d="M3 0 C4 4,6 6,5 9" stroke="#1f2937" strokeWidth="1.3" fill="none" />
        <path d="M7 0 C6 4,4 6,5 9" stroke="#334155" strokeWidth="1.3" fill="none" />
        <path d="M3.2 2 l3.6 1 M3.4 4.5 l3.2 1" stroke="#64748b" strokeWidth=".5" />
        <ellipse cx="5" cy="10.5" rx="2.6" ry="2.2" fill="#111827" />
        <path d="M3.6 10 q1.4 -1.2 2.8 0" stroke="#475569" strokeWidth=".5" fill="none" />
      </svg>
      <div
        className={`-mt-[2px] flex flex-col items-center justify-center rounded-[3px] bg-gradient-to-b ${cls} shadow-[0_2px_4px_rgba(15,23,42,0.3),inset_0_1px_0_rgba(255,255,255,0.25)] ${big ? 'w-[15px] py-[5px]' : 'w-[12px] py-[4px]'}`}
      >
        {label.split('').map((ch, i) => (
          <span key={i} className={`font-bold text-white leading-[1.05] ${big ? 'text-[8.5px]' : 'text-[7px]'}`} style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
}

function HangerTag({ label, cls, big }: { label: string; cls: string; big?: boolean }) {
  return (
    <div className={`relative flex flex-col items-center rounded-md bg-gradient-to-b ${cls} border border-black/10 shadow-[0_4px_8px_rgba(15,23,42,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] ${big ? 'w-[32px] pt-[20px] pb-2' : 'w-[24px] pt-[15px] pb-1.5'}`}>
      <span className={`absolute top-1 rounded-full bg-white shadow-[inset_0_1px_2px_rgba(15,23,42,0.4)] ${big ? 'w-[9px] h-[9px]' : 'w-[7px] h-[7px]'}`} />
      <span className={`font-extrabold text-white leading-none drop-shadow-sm ${big ? 'text-[10px]' : 'text-[8px]'}`}>{label}</span>
    </div>
  );
}

/* ===================== CỬA ĐÃ XONG (màn Nhiệm vụ) ===================== */
const SETTLED_DOOR: Record<string, { chip: string; chipCls: string; led: string }> = {
  'Hoàn thành': { chip: 'ĐÃ DỌN', chipCls: 'bg-emerald-600/90 border-emerald-300 text-white', led: 'bg-emerald-400 shadow-[0_0_5px_2px_rgba(52,211,153,0.85)]' },
  DND: { chip: 'DND', chipCls: 'bg-red-700/85 border-red-300 text-white', led: 'bg-red-400 shadow-[0_0_5px_2px_rgba(248,113,113,0.85)]' },
  Refused: { chip: 'RF', chipCls: 'bg-purple-700/85 border-purple-300 text-white', led: 'bg-purple-400 shadow-[0_0_5px_2px_rgba(192,132,252,0.85)]' },
};

function SettledDoor({ room, onClick, special }: { room: Room; onClick: () => void; special?: boolean }) {
  const cfg = SETTLED_DOOR[room.TaskStatus] ?? SETTLED_DOOR['Hoàn thành'];
  const isDone = room.TaskStatus === 'Hoàn thành';
  const isDnd = room.TaskStatus === 'DND';
  const isRf = room.TaskStatus === 'Refused';
  // Chân cửa: phòng đã dọn ghi giờ xong + số phút; DND/RF ghi ngày lưu trú (RF kèm giờ từ chối)
  const footText = isDone
    ? [room.EndTime && `Xong ${formatTimeOnly(room.EndTime)}`, room.Duration && `${room.Duration}'`].filter(Boolean).join(' · ') || formatDateShort(room.NgayO)
    : isRf && room.StartTime
    ? `RF lúc ${formatTimeOnly(room.StartTime)}`
    : formatDateShort(room.NgayO);
  const digits = String(room.MaPhong).split('');

  return (
    <div onClick={onClick} className="group relative h-full min-h-[178px] cursor-pointer transition-transform duration-200 hover:-translate-y-0.5">
      {/* Tường ốp gạch xám (nền quanh khung cửa) */}
      <div
        className={`relative h-full overflow-hidden rounded-xl p-[7px] pb-0 shadow-[0_8px_18px_-10px_rgba(15,23,42,0.55)] ${isDone ? 'ring-2 ring-emerald-400/80' : ''}`}
        style={{
          backgroundColor: '#55595f',
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.18) 1px, transparent 1px), linear-gradient(160deg, #62666c, #4a4e54)',
          backgroundSize: '100% 46%, 52% 100%, 100% 100%',
        }}
      >
        {/* Khung cửa xám than (lõm vào tường) */}
        <div className="relative h-full rounded-t-[4px] bg-[#6a6e74] p-[5px] pb-0 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.05)]">
          {/* Cánh cửa xám ghi, mặt da nhám, ánh sáng loang từ trên */}
          <div
            className="relative h-full overflow-hidden rounded-t-[2px] shadow-[inset_3px_4px_6px_rgba(0,0,0,0.35)]"
            style={{
              backgroundColor: '#8e9196',
              backgroundImage: `radial-gradient(120% 70% at 55% 18%, rgba(255,255,255,0.28), rgba(255,255,255,0) 60%), linear-gradient(90deg, rgba(0,0,0,0.10), rgba(0,0,0,0) 30%, rgba(0,0,0,0) 75%, rgba(0,0,0,0.12)), ${LEATHER_NOISE}`,
            }}
          >
            {/* Dải inox xước dọc + số phòng in dọc */}
            <div
              className={`absolute top-[5%] h-[48%] left-[11%] ${special ? 'w-[15%]' : 'w-[19%]'} flex flex-col items-center justify-end pb-[10%] shadow-[1px_1px_2px_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(255,255,255,0.25)]`}
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, rgba(0,0,0,0.025) 1px 2px, transparent 2px 4px), linear-gradient(180deg, #eef0f2 0%, #c3c8cd 35%, #dde0e3 60%, #b4b9bf 85%, #cfd3d7 100%)',
              }}
            >
              <span className="absolute top-[6%] text-[6px] font-semibold tracking-[0.18em] pl-[0.18em] text-slate-700/70">{room.LoaiPhong}</span>
              {digits.map((d, i) => (
                <span key={i} className={`font-light leading-[1.05] text-slate-900 ${special ? 'text-[15px]' : 'text-[12px]'}`}>{d}</span>
              ))}
            </div>

            {/* Mắt thần */}
            <span className="absolute left-[56%] top-[36%] w-[7px] h-[7px] rounded-full bg-gradient-to-br from-slate-100 to-slate-500 shadow-[0_1px_1px_rgba(0,0,0,0.4),inset_0_0_0_1.5px_rgba(51,65,85,0.6)]" />

            {/* DND / RF: chỉ hiện bằng thẻ treo trên tay gạt (không cần chip ở góc trên nữa) */}

            {/* Sticker ĐÃ DỌN */}
            {isDone && (
              <span className={`absolute left-[8%] top-[66%] -translate-y-1/2 rotate-[-6deg] inline-flex items-center gap-1 rounded-md border border-emerald-200/90 bg-gradient-to-b from-emerald-500 to-emerald-700 px-1.5 py-[3px] font-extrabold tracking-wide text-white shadow-[0_3px_8px_rgba(4,120,87,0.5)] whitespace-nowrap ${special ? 'text-[12px]' : 'text-[9.5px]'}`}>
                <Check className="w-3 h-3" strokeWidth={3.5} /> ĐÃ DỌN
              </span>
            )}

            {/* Đầu đọc thẻ từ (đèn LED theo trạng thái) + tay gạt inox — mép PHẢI, tay gạt chìa vào trong */}
            <div className="pointer-events-none absolute right-[9%] top-[55%]">
              <div className="relative w-[11px] h-[14px] rounded-[3px] bg-gradient-to-b from-slate-700 to-black border border-slate-400/70 shadow-[0_1px_2px_rgba(0,0,0,0.5)] flex justify-center pt-[3px]">
                <span className={`w-[3px] h-[3px] rounded-full ${cfg.led}`} />
              </div>
              <span className="absolute right-[1px] top-[18px] w-[9px] h-[9px] rounded-full bg-gradient-to-br from-white to-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.45)]" />
              <span className="absolute right-[5px] top-[20px] w-[22px] h-[4px] rounded-full bg-gradient-to-b from-white via-slate-300 to-slate-500 shadow-[0_2px_2px_rgba(0,0,0,0.4)]" />
              {(isDnd || isRf) && (
                <>
                  <style>{`@keyframes hkHangerSwing2{0%,100%{transform:rotate(6deg)}50%{transform:rotate(-4deg)}}`}</style>
                  <div className="absolute right-[-9px] top-[17px] origin-top" style={{ animation: 'hkHangerSwing2 3.2s ease-in-out infinite' }}>
                    {isDnd && <HangerTag label="DND" cls="from-red-500 to-red-700" />}
                    {isRf && <HangerTag label="RF" cls="from-purple-500 to-purple-800" />}
                  </div>
                </>
              )}
            </div>

            {/* Chân cửa — thông tin phòng */}
            <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 rounded-[3px] bg-black/30 px-1.5 py-[3px] text-[8.5px] text-white/95">
              <span className="flex items-center gap-1 font-semibold min-w-0 [&_svg]:!w-3 [&_svg]:!h-3 [&_svg]:!text-white">
                <FoStatusIcon status={room.FoStatus} />
                <span className="truncate">{FO_STATUS_LABEL[room.FoStatus]}</span>
              </span>
              <span className="text-white/80 whitespace-nowrap truncate">{footText}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Vân da nhám rất nhẹ cho mặt cửa (SVG noise) */
const LEATHER_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.10 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")";

export default memo(RoomCard);
