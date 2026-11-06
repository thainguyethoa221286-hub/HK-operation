'use client';

import { useEffect, useState } from 'react';
import {
  X, Moon, AlertTriangle, Play, Square, RotateCcw, DoorOpen, Sparkles, Zap, Leaf, Users,
  Lock, Unlock, CheckCircle2, Undo2, BellRing, Send, MessageSquareWarning,
} from 'lucide-react';
import type { Room } from '@/lib/types';
import {
  formatDateShort, formatTimeOnly, nowTimeStr, diffMinutes, elapsedSecondsSince, formatElapsed,
  addNoteCode, removeNoteCode, stripCodesFromNote, extractNoteCodes, FO_STATUS_LABEL, checkLinenChange,
  combineNotes, isLongStay, hasDndOrRf, getRoomGroup, ROOM_GROUP_TONE,
} from '@/lib/roomStyles';
import { logTaskAction } from '@/lib/api';

interface RoomTaskModalProps {
  room: Room;
  onUpdate: (maPhong: string, fields: Partial<Room>) => void;
  onClose: () => void;
}

export default function RoomTaskModal({ room, onUpdate, onClose }: RoomTaskModalProps) {
  const [noteDraft, setNoteDraft] = useState(stripCodesFromNote(room.GhiChuNV || ''));
  const [tick, setTick] = useState(0);
  const [safeWarning, setSafeWarning] = useState(false);
  // "Hẹn quay lại" — TRƯỚC ĐÂY dùng window.prompt() của trình duyệt, luôn kèm theo dòng chữ mặc
  // định "The page at ... says:" do CHÍNH TRÌNH DUYỆT vẽ ra (không phải web page), nên không thể
  // ẩn/sửa bằng code được. Nay thay bằng 1 khung popup tự thiết kế trong app -> chỉ còn đúng dòng
  // "Hẹn quay lại lúc mấy giờ?" như chị yêu cầu.
  const [scheduleReturnOpen, setScheduleReturnOpen] = useState(false);
  const [scheduleReturnTime, setScheduleReturnTime] = useState('');

  useEffect(() => setNoteDraft(stripCodesFromNote(room.GhiChuNV || '')), [room.GhiChuNV]);

  useEffect(() => {
    if (room.TaskStatus !== 'Đang dọn') return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [room.TaskStatus]);

  const staffName = room.NhanVienPhuTrach || '';
  // Mục mới — hiện badge LSG (Long Stay Guest) ngay trên thẻ Nhiệm vụ của nhân viên, giống hệt
  // Khung Pop-up Chi tiết bên Admin, để nhân viên cũng biết phòng này khách ở dài ngày.
  const showLsg = isLongStay(combineNotes(room.GhiChu, room.GhiChuNV, room.GhiChuAdmin), room.NgayO);

  // Ghi log + refresh lại danh sách để hiện ngay lập tức (không cần đợi polling 15s)
  // Ghi log ngầm (dùng cho Báo cáo sau này) — Section 4 "Lịch sử dọn hôm nay" đã ẩn khỏi Nhiệm vụ
  const log = (hanhDong: string, chiTiet: string = '') => {
    logTaskAction(room.MaPhong, staffName, hanhDong, chiTiet);
  };

  const saveNote = () => {
    const existingCodes = extractNoteCodes(room.GhiChuNV || '');
    const merged = [...existingCodes, noteDraft.trim()].filter(Boolean).join(', ');
    if (merged !== room.GhiChuNV) onUpdate(room.MaPhong, { GhiChuNV: merged });
  };

  // Gỡ cờ RUSH (CayBac) + MKR (TrangDiem) khỏi Flags — dùng khi phòng chuyển sang DND/RF,
  // vì phòng không làm được nữa thì 2 cờ ưu tiên này không còn ý nghĩa, tự động biến mất khỏi thẻ phòng.
  const clearRushMkrFlags = (flags: string) =>
    (flags || '').split(',').map((f) => f.trim()).filter((f) => f && f !== 'CayBac' && f !== 'TrangDiem').join(',');

  const toggleDnd = () => {
    if (room.TaskStatus === 'DND') {
      onUpdate(room.MaPhong, { TaskStatus: 'Chưa dọn', GhiChuNV: removeNoteCode(room.GhiChuNV, 'DND') });
      log('DND Tắt');
    } else {
      // Bật DND -> gỡ luôn mã RF nếu có (loại trừ lẫn nhau, tránh cả 2 badge cùng hiện)
      // + tự động gỡ RUSH/MKR (phòng không làm được nữa thì không cần nhắc ưu tiên nữa)
      const cleaned = removeNoteCode(room.GhiChuNV, 'RF');
      onUpdate(room.MaPhong, { TaskStatus: 'DND', GhiChuNV: addNoteCode(cleaned, 'DND'), Flags: clearRushMkrFlags(room.Flags) });
      log('DND Bật');
    }
  };

  const markRefused = () => {
    // Từ chối (RF) -> gỡ luôn mã DND nếu có (loại trừ lẫn nhau, tránh cả 2 badge cùng hiện)
    // + tự động gỡ RUSH/MKR (phòng không làm được nữa thì không cần nhắc ưu tiên nữa)
    const cleaned = removeNoteCode(room.GhiChuNV, 'DND');
    onUpdate(room.MaPhong, {
      TaskStatus: 'Refused',
      StartTime: nowTimeStr(),
      GhiChuNV: addNoteCode(cleaned, 'RF'),
      Flags: clearRushMkrFlags(room.Flags),
    });
    log('Từ chối (RF)');
  };

  const redoRoom = () => {
    onUpdate(room.MaPhong, { TaskStatus: 'Chưa dọn', StartTime: '', GhiChuNV: removeNoteCode(room.GhiChuNV, 'RF') });
    log('Làm lại phòng');
  };

  // "Hẹn quay lại" — phòng khách từ chối dọn, nhân viên hẹn giờ sẽ quay lại thử dọn lần nữa.
  // Chỉ ghi lại mốc giờ hẹn vào lịch sử (Section 4), không đổi trạng thái phòng — vẫn giữ nguyên "Refused"
  // cho tới khi nhân viên chủ động bấm "Làm lại" khi thực sự quay lại dọn.
  const scheduleReturn = () => {
    setScheduleReturnTime('');
    setScheduleReturnOpen(true);
  };
  const confirmScheduleReturn = () => {
    const time = scheduleReturnTime.trim();
    if (!time) return;
    log('Hẹn quay lại', `Dự kiến quay lại lúc ${time}`);
    setScheduleReturnOpen(false);
  };

  // "Gửi thông báo DND" — ghi nhận đã báo cho lễ tân/giám sát biết phòng đang bật DND,
  // chỉ ghi log mốc giờ gửi, không đổi trạng thái phòng.
  const notifyDnd = () => {
    log('Đã gửi thông báo DND');
  };

  const setSafeStatus = (value: 'Mở' | 'Đóng') => {
    setSafeWarning(false);
    const next = room.SafeStatus === value ? 'Chưa kiểm' : value;
    onUpdate(room.MaPhong, { SafeStatus: next });
    log('Kiểm két sắt', next);
  };

  const toggleLinenChange = () => {
    const next = room.LinenChange === 'Có' ? '' : 'Có';
    onUpdate(room.MaPhong, { LinenChange: next });
    log(next === 'Có' ? 'Thay ga giường' : 'Bỏ đánh dấu thay ga');
  };
  // "Không thay giường" — LOẠI TRỪ LẪN NHAU với "Thay ga giường": chọn 1 trong 2, không thể chọn cả 2
  const toggleNoLinenChange = () => {
    const next = room.LinenChange === 'Không' ? '' : 'Không';
    onUpdate(room.MaPhong, { LinenChange: next });
    log(next === 'Không' ? 'Không thay giường' : 'Bỏ đánh dấu không thay ga');
  };

  const startCleaning = () => {
    onUpdate(room.MaPhong, { TaskStatus: 'Đang dọn', StartTime: nowTimeStr(), HkStatus: 'Phòng đang dọn' });
    log('Bắt đầu dọn');
  };

  const finishCleaning = () => {
    if (room.FoStatus === 'Occupied' && room.SafeStatus === 'Chưa kiểm') {
      setSafeWarning(true);
      return;
    }
    const end = nowTimeStr();
    const dur = diffMinutes(room.StartTime, end);
    // Phòng đã dọn xong, trả về "Phòng sạch" — cờ MKR đã hoàn thành nhiệm vụ, tự động xoá khỏi Flags
    const newFlags = (room.Flags || '').split(',').map((f) => f.trim()).filter((f) => f && f !== 'TrangDiem').join(',');
    onUpdate(room.MaPhong, {
      TaskStatus: 'Hoàn thành',
      EndTime: end,
      Duration: String(dur),
      HkStatus: 'Phòng sạch',
      Flags: newFlags,
    });
    log('Hoàn thành', `${formatTimeOnly(room.StartTime)} → ${formatTimeOnly(end)} (${dur} phút)`);
  };

  // "Làm lại phòng" — cho phép hoàn tác 1 phòng lỡ bấm Hoàn thành nhầm, quay lại Chưa dọn/Phòng dơ
  const reportDirtyAgain = () => {
    onUpdate(room.MaPhong, {
      TaskStatus: 'Chưa dọn', StartTime: '', EndTime: '', Duration: '', HkStatus: 'Phòng dơ',
    });
    log('Làm lại phòng');
  };

  const isRefused = room.TaskStatus === 'Refused';
  // Thẻ trạng thái ở đầu thân cửa — RUSH (CayBac) / MKR (TrangDiem) đọc từ Flags; DND / RF lấy theo
  // trạng thái nhiệm vụ HOẶC mã trong ghi chú (giống đúng cách thẻ phòng ngoài sơ đồ nhận biết).
  const flagList = (room.Flags || '').split(',').map((f) => f.trim());
  const hasRush = flagList.includes('CayBac');
  const hasMkr = flagList.includes('TrangDiem');
  const noteCodes = hasDndOrRf(combineNotes(room.GhiChu, room.GhiChuNV, room.GhiChuAdmin));
  const isDnd = room.TaskStatus === 'DND';
  const isCleaning = room.TaskStatus === 'Đang dọn';
  const isDone = room.TaskStatus === 'Hoàn thành';
  const showDndTag = room.TaskStatus === 'DND' || noteCodes.dnd;
  const showRfTag = isRefused || noteCodes.rf;
  const showLinen = checkLinenChange(room);
  const groupCode = getRoomGroup(room.Flags);
  void tick;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose}>
      {/* Khung cửa (bậu cửa kim loại xám bạc) bao quanh toàn bộ modal */}
      <div
        className="relative w-full sm:max-w-md max-h-[94vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] p-2 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 shadow-[0_20px_50px_rgba(15,23,42,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ====== ĐẦU CÁNH CỬA — vân gỗ xám, biển số phòng kim loại đắp nổi, nút đóng ====== */}
        <div
          className="relative h-[150px] rounded-t-[22px] overflow-hidden border border-black/10 shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)]"
          style={{
            // Cùng màu xám ghi + mặt da nhám như cửa "đã xong" ở thẻ nhiệm vụ (RoomCard)
            backgroundColor: '#8e9196',
            backgroundImage:
              "radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.26), rgba(255,255,255,0) 60%), linear-gradient(90deg, rgba(0,0,0,0.10), rgba(0,0,0,0) 30%, rgba(0,0,0,0) 75%, rgba(0,0,0,0.12)), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.10 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        >
          {/* Đường ghép ván cửa */}
          <span className="absolute inset-y-0 right-[22%] w-[2px] bg-black/10 shadow-[1px_0_0_rgba(255,255,255,0.18)]" />
          {/* Biển số phòng kim loại */}
          <div className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-400/70 bg-gradient-to-b from-slate-100 via-slate-300 to-slate-400 px-5 pt-1.5 pb-1 shadow-[0_4px_10px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.95)]">
            <span
              className="block text-[38px] font-extrabold leading-none tracking-wide text-slate-900"
              style={{ textShadow: '0 1px 0 rgba(255,255,255,0.95), 0 -1px 0 rgba(15,23,42,0.35)' }}
            >
              {room.MaPhong}
            </span>
            <span
              className="block mt-1 text-center text-[11px] font-extrabold tracking-[0.25em] text-slate-700"
              style={{ textShadow: '0 1px 0 rgba(255,255,255,0.9)' }}
            >
              {room.LoaiPhong}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="absolute top-3 right-3 z-30 w-9 h-9 rounded-full bg-white/90 text-slate-600 flex items-center justify-center shadow-[0_3px_8px_rgba(0,0,0,0.25)] hover:bg-white active:scale-95 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ====== KHOÁ TỪ THÔNG MINH + TAY GẠT — mép phải, nối từ đầu cửa xuống thân cửa ====== */}
        <div className="pointer-events-none absolute right-6 top-[96px] z-20">
          <div className="relative w-[44px] h-[138px] rounded-xl border border-stone-500/50 bg-gradient-to-r from-stone-400 via-stone-200 to-stone-400 shadow-[0_6px_14px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.8)] flex flex-col items-center pt-2">
            {/* Màn hình cảm ứng / bàn phím số */}
            <div className="w-[28px] h-[58px] rounded-md bg-gradient-to-b from-slate-800 to-slate-950 border border-slate-900 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)] flex flex-col items-center pt-1.5">
              <span className="w-[8px] h-[8px] rounded-full border border-sky-300/70 shadow-[0_0_4px_rgba(125,211,252,0.8)]" />
              <div className="mt-1.5 grid grid-cols-3 gap-[3px]">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} className="w-[3px] h-[3px] rounded-full bg-white/45" />
                ))}
              </div>
            </div>
            {/* Đèn LED trạng thái — đổi màu theo tiến độ dọn */}
            <span
              className={`mt-2 w-[5px] h-[5px] rounded-full ${
                isDone
                  ? 'bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.85)]'
                  : isCleaning
                  ? 'bg-blue-400 shadow-[0_0_6px_2px_rgba(96,165,250,0.85)]'
                  : isDnd || isRefused
                  ? 'bg-red-400 shadow-[0_0_6px_2px_rgba(248,113,113,0.85)]'
                  : 'bg-amber-300 shadow-[0_0_6px_2px_rgba(252,211,77,0.85)]'
              }`}
            />
            {/* Núm xoay tay gạt */}
            <span className="absolute bottom-[28px] left-1/2 -translate-x-1/2 w-[22px] h-[22px] rounded-full bg-gradient-to-br from-stone-100 to-stone-400 border border-stone-500/50 shadow-[0_2px_4px_rgba(0,0,0,0.35)]" />
          </div>
          {/* Tay gạt kim loại 3D */}
          <span className="absolute bottom-[32px] right-[22px] w-[78px] h-[14px] rounded-full bg-gradient-to-b from-stone-100 via-stone-300 to-stone-500 border border-stone-500/50 shadow-[0_4px_8px_rgba(0,0,0,0.35)]" />
        </div>

        {/* ====== THÂN CÁNH CỬA — chứa toàn bộ thông tin tác nghiệp ====== */}
        <div className="relative -mt-6 z-10 rounded-[22px] sm:rounded-b-[22px] bg-gradient-to-b from-slate-100 to-slate-200 shadow-[0_-6px_16px_rgba(15,23,42,0.18)]">
        {/* Đầu thân cửa — thay cho dòng "Phòng 104 / ZEN" (số phòng + hạng phòng đã nằm trên biển cửa):
            hiện các thẻ trạng thái cần chú ý RUSH / MKR / DND / RF (+ LSG, thay ga nếu có).
            Chừa khoảng trống bên phải cho khoá từ & tay gạt. */}
        <div className="pl-5 pr-28 pt-5 pb-3 min-h-[92px]">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">Thẻ trạng thái</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {hasRush && (
              <span className="flex items-center gap-1 bg-gradient-to-b from-orange-500 to-orange-600 text-white text-[12px] font-extrabold px-2.5 py-1 rounded-lg shadow-[0_3px_6px_rgba(234,88,12,0.4)] animate-pulse">
                <Zap className="w-3.5 h-3.5 fill-white" /> RUSH
              </span>
            )}
            {hasMkr && (
              <span className="flex items-center gap-1 bg-gradient-to-b from-blue-500 to-blue-600 text-white text-[12px] font-extrabold px-2.5 py-1 rounded-lg shadow-[0_3px_6px_rgba(37,99,235,0.4)]">
                <Sparkles className="w-3.5 h-3.5" /> MKR
              </span>
            )}
            {showDndTag && (
              <span className="flex items-center gap-1 bg-gradient-to-b from-red-500 to-red-700 text-white text-[12px] font-extrabold px-2.5 py-1 rounded-lg shadow-[0_3px_6px_rgba(220,38,38,0.4)]">
                <Moon className="w-3.5 h-3.5" /> DND
              </span>
            )}
            {showRfTag && (
              <span className="flex items-center gap-1 bg-gradient-to-b from-purple-500 to-purple-800 text-white text-[12px] font-extrabold px-2.5 py-1 rounded-lg shadow-[0_3px_6px_rgba(126,34,206,0.4)]">
                <AlertTriangle className="w-3.5 h-3.5" /> RF
              </span>
            )}
            {showLsg && (
              <span className="bg-red-600 text-white font-bold px-2 py-1 rounded-lg text-[12px] shadow-sm">
                LSG
              </span>
            )}
            {/* Thay ga hôm nay — hiện CHỮ RÕ ngay trong thẻ, KHÔNG dùng tooltip nổi nữa (tooltip cũ bị
                tràn ra ngoài, đè mất dòng Vacant/Occupied bên dưới trên điện thoại). */}
            {showLinen && (
              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[12px] font-bold px-2.5 py-1 rounded-lg shadow-sm">
                <Leaf className="w-3.5 h-3.5 text-emerald-600 fill-emerald-400" /> Thay ga hôm nay
              </span>
            )}
            {groupCode && (
              <span className={`flex items-center gap-1 text-[12px] font-extrabold px-2.5 py-1 rounded-lg shadow-sm ${(ROOM_GROUP_TONE[groupCode] || ROOM_GROUP_TONE.A).solid}`}>
                <Users className="w-3.5 h-3.5" strokeWidth={2.75} /> Nhóm đi cùng {groupCode}
              </span>
            )}
            {!hasRush && !hasMkr && !showDndTag && !showRfTag && !showLsg && !showLinen && !groupCode && (
              <span className="text-[12px] font-semibold text-slate-400 italic">Không có yêu cầu đặc biệt</span>
            )}
          </div>
        </div>

        <div className="px-4 pb-6 pt-2 space-y-4">
          {/* Dải trạng thái khách + ngày lưu trú — đổi nền ĐEN sang nền SÁNG (xanh dương nhạt) để dễ nhìn hơn */}
          <div className="bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200/80 text-blue-900 rounded-2xl px-4 py-3 flex items-center justify-between text-[13px] font-bold shadow-[inset_0_1px_3px_rgba(37,99,235,0.12),0_1px_0_rgba(255,255,255,0.9)]">
            <span>{FO_STATUS_LABEL[room.FoStatus]}</span>
            <span>{formatDateShort(room.NgayO)}</span>
          </div>

          {(isRefused || isDnd) && (
            <div
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 border ${
                isRefused ? 'bg-purple-50 border-purple-200' : 'bg-amber-50 border-amber-200'
              }`}
            >
              <span className={`text-[12px] font-extrabold ${isRefused ? 'text-purple-700' : 'text-amber-700'}`}>
                {isRefused ? `PHÒNG KHÔNG LÀM — ${formatTimeOnly(room.StartTime)}: Refused` : 'DND — KHÔNG LÀM PHIỀN'}
              </span>
              <span className="flex items-center gap-2.5 flex-shrink-0 ml-2">
                {isRefused && (
                  <button onClick={scheduleReturn} className="flex items-center gap-1 text-[11px] font-bold text-purple-600">
                    <BellRing className="w-3.5 h-3.5" /> HẸN QUAY LẠI
                  </button>
                )}
                <button onClick={isRefused ? redoRoom : toggleDnd} className="flex items-center gap-1 text-[11px] font-bold text-blue-600">
                  <RotateCcw className="w-3.5 h-3.5" /> {isRefused ? 'LÀM LẠI' : 'BỎ DND'}
                </button>
                {isDnd && (
                  <button onClick={notifyDnd} title="Gửi thông báo DND cho lễ tân/giám sát" className="text-amber-600">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            </div>
          )}

          {/* Các thao tác nhanh */}
          <div>
            {!isRefused && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={toggleDnd}
                  className={`flex items-center justify-center gap-1.5 rounded-2xl py-3.5 text-[13px] font-bold transition active:scale-[0.98] ${
                    isDnd ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-white shadow-md' : 'bg-slate-100 text-slate-700 shadow-[4px_4px_10px_rgba(148,163,184,0.35),-4px_-4px_10px_rgba(255,255,255,0.95)] hover:bg-white'
                  }`}
                >
                  <Moon className="w-4 h-4" /> DND {isDnd ? '(Bật)' : ''}
                </button>
                <button
                  onClick={markRefused}
                  className="flex items-center justify-center gap-1.5 rounded-2xl py-3.5 text-[13px] font-bold bg-slate-100 text-slate-700 shadow-[4px_4px_10px_rgba(148,163,184,0.35),-4px_-4px_10px_rgba(255,255,255,0.95)] hover:bg-white transition active:scale-[0.98]"
                >
                  <AlertTriangle className="w-4 h-4" /> Từ chối (RF)
                </button>
              </div>
            )}

            {/* Khối checklist — Thay ga giường (LinenChange) + Kiểm tra Két sắt (Mở/Đóng, giữ 3 trạng thái) */}
            <div className="bg-white/80 rounded-2xl p-4 space-y-3 border border-white shadow-[4px_4px_10px_rgba(148,163,184,0.35),-4px_-4px_10px_rgba(255,255,255,0.95)]">
              <label className="flex items-center gap-2.5 text-[13px] font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={room.LinenChange === 'Có'}
                  onChange={toggleLinenChange}
                  className="w-4 h-4 accent-blue-600"
                />
                Thay ga giường
              </label>
              <label className="flex items-center gap-2.5 text-[13px] font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={room.LinenChange === 'Không'}
                  onChange={toggleNoLinenChange}
                  className="w-4 h-4 accent-slate-600"
                />
                Không thay giường
              </label>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-slate-700">Kiểm tra Két sắt</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-400">
                    {room.SafeStatus === 'Chưa kiểm' ? 'Chưa kiểm' : ''}
                  </span>
                  <button
                    onClick={() => setSafeStatus('Mở')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-sm ${
                      room.SafeStatus === 'Mở' ? 'bg-amber-500 text-white' : 'bg-white border border-slate-200 text-slate-500'
                    }`}
                  >
                    <Unlock className="w-3 h-3" /> MỞ
                  </button>
                  <button
                    onClick={() => setSafeStatus('Đóng')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-sm ${
                      room.SafeStatus === 'Đóng' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-500'
                    }`}
                  >
                    <Lock className="w-3 h-3" /> ĐÓNG
                  </button>
                </div>
              </div>
            </div>
            {safeWarning && (
              <div className="mt-2 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                ⚠ Phòng đang có khách (OCC) — vui lòng kiểm két sắt (Mở/Đóng) trước khi Hoàn thành.
              </div>
            )}
          </div>

          {/* Ghi chú buồng phòng & nhân viên */}
          <div>

            {/* Ghi chú GỐC do AI tự đồng bộ từ dữ liệu đặt phòng (room.GhiChu) — hiện công khai, chỉ
                đọc, để nhân viên/giám sát đối chiếu nếu thấy icon EB/BBC/HON/LSG lạ trên thẻ phòng
                (các icon này tự nhận diện dựa trên nội dung của đúng trường này). */}
            {room.GhiChu && (
              <div className="flex items-start gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2.5 mb-3">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Dữ liệu gốc (AI)</div>
                  <div className="text-[13px] font-semibold text-slate-700">{room.GhiChu}</div>
                </div>
              </div>
            )}

            {/* Ghi chú từ Admin/Giám sát — nổi bật NỀN VÀNG + NHẤP NHÁY để gây chú ý mạnh, chỉ đọc (không sửa từ đây) */}
            {room.GhiChuAdmin && (
              <div className="flex items-start gap-2 bg-amber-100 border border-amber-400 text-amber-900 rounded-lg px-3 py-2.5 mb-3 animate-pulse">
                <MessageSquareWarning className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wide">Ghi chú từ Giám sát</div>
                  <div className="text-[13px] font-semibold">{room.GhiChuAdmin}</div>
                </div>
              </div>
            )}

            <div className="text-[12px] font-semibold text-slate-500 mb-1">Ghi chú chi tiết phòng:</div>
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={saveNote}
              placeholder="Thêm ghi chú tại đây..."
              className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-[13px] bg-white shadow-[inset_0_2px_4px_rgba(15,23,42,0.06)] focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {/* Đồng hồ tác vụ & thao tác trạng thái */}
          {!isRefused && (
            <div>
              {!isCleaning && !isDone && (() => {
                const isBlockedByDndOrRf = isDnd || isRefused;
                const isDueOutGate = room.FoStatus === 'Due out' || room.FoStatus === 'Due out/ARR';
                if (isBlockedByDndOrRf) {
                  return (
                    <div>
                      <button
                        disabled
                        className="w-full flex items-center justify-center gap-2 bg-slate-200 text-slate-400 rounded-2xl py-4 text-sm font-bold cursor-not-allowed opacity-70"
                      >
                        🔒 KHÔNG THỂ DỌN (PHÒNG {isDnd ? 'DND' : 'RF'})
                      </button>
                      <p className="text-center text-[11px] text-amber-600 font-semibold mt-1.5">
                        ⚠️ Bỏ chọn {isDnd ? 'DND' : 'Từ chối (RF)'} phía trên để mở khóa nút dọn phòng.
                      </p>
                    </div>
                  );
                }
                if (isDueOutGate) {
                  return (
                    <div>
                      <button
                        disabled
                        className="w-full flex items-center justify-center gap-2 bg-slate-200 text-slate-400 rounded-2xl py-4 text-sm font-bold cursor-not-allowed"
                      >
                        <Play className="w-4 h-4" /> BẮT ĐẦU DỌN PHÒNG
                      </button>
                      <div className="text-[11px] text-slate-400 text-center mt-1.5">
                        Chỉ dọn khi khách đã trả phòng — chờ chuyển sang Vacant/Arrival/Occupied
                      </div>
                    </div>
                  );
                }
                return (
                  <button
                    onClick={startCleaning}
                    className="group relative w-full flex items-center justify-center gap-2.5 overflow-hidden rounded-2xl py-4 pl-14 pr-3 text-[13px] font-extrabold tracking-wide text-white bg-gradient-to-r from-[#2563EB] via-[#1d8fd8] to-[#10B981] shadow-[0_8px_20px_-6px_rgba(37,99,235,0.6)] active:scale-[0.98] transition"
                  >
                    {/* Ổ khoá mở — biểu tượng "mở cửa để làm việc" */}
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-white/20 border border-white/40 flex items-center justify-center shadow-inner">
                      <Unlock className="w-5 h-5" />
                    </span>
                    {/* Vệt sáng lướt qua */}
                    <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-white/25 skew-x-[-20deg] animate-[hkShine_2.8s_ease-in-out_infinite]" />
                    <style>{`@keyframes hkShine{0%{transform:translateX(0) skewX(-20deg)}60%,100%{transform:translateX(420%) skewX(-20deg)}}`}</style>
                    <DoorOpen className="w-5 h-5 flex-shrink-0" />
                    <span className="text-left leading-tight">BẤM MỞ CỬA - BẮT ĐẦU DỌN PHÒNG</span>
                  </button>
                );
              })()}
              {isCleaning && (
                <button
                  onClick={finishCleaning}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl py-4 text-sm font-extrabold shadow-[0_8px_20px_-6px_rgba(249,115,22,0.6)] active:scale-[0.98] transition"
                >
                  <Square className="w-4 h-4" /> HOÀN THÀNH ({formatElapsed(elapsedSecondsSince(room.StartTime))})
                </button>
              )}
              {isDone && (
                <div className="space-y-2">
                  <div className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-green-500 text-white rounded-2xl py-4 text-sm font-extrabold shadow-[0_8px_20px_-6px_rgba(16,185,129,0.55)]">
                    <CheckCircle2 className="w-4 h-4" /> PHÒNG ĐÃ DỌN
                  </div>
                  <button
                    onClick={reportDirtyAgain}
                    className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 rounded-2xl py-3 text-[13px] font-bold"
                  >
                    <Undo2 className="w-3.5 h-3.5" /> LÀM LẠI PHÒNG
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Khung "Hẹn quay lại" tự thiết kế — thay cho window.prompt() của trình duyệt (luôn kèm dòng
          "The page at ... says:" không thể ẩn được vì do chính trình duyệt vẽ ra, không phải web). */}
      {scheduleReturnOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setScheduleReturnOpen(false)}
        >
          <div
            className="bg-white w-full max-w-xs rounded-2xl shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[15px] font-bold text-slate-800 mb-3">Hẹn quay lại lúc mấy giờ?</div>
            <input
              autoFocus
              type="text"
              value={scheduleReturnTime}
              onChange={(e) => setScheduleReturnTime(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmScheduleReturn(); }}
              placeholder="VD: 14:30"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setScheduleReturnOpen(false)}
                className="flex-1 rounded-xl py-2.5 text-[13px] font-bold bg-gray-100 text-gray-700"
              >
                Huỷ
              </button>
              <button
                onClick={confirmScheduleReturn}
                className="flex-1 rounded-xl py-2.5 text-[13px] font-bold bg-purple-600 text-white"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
