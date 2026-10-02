'use client';

import { useEffect, useState } from 'react';
import {
  X, Moon, AlertTriangle, Play, Square, RotateCcw,
  Lock, Unlock, CheckCircle2, Undo2, BellRing, Send, MessageSquareWarning,
} from 'lucide-react';
import type { Room } from '@/lib/types';
import {
  formatDateShort, formatTimeOnly, nowTimeStr, diffMinutes, elapsedSecondsSince, formatElapsed,
  addNoteCode, removeNoteCode, stripCodesFromNote, extractNoteCodes, FO_STATUS_LABEL, LinenChangeBadge,
  combineNotes, isLongStay,
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
  const isDnd = room.TaskStatus === 'DND';
  const isCleaning = room.TaskStatus === 'Đang dọn';
  const isDone = room.TaskStatus === 'Hoàn thành';
  void tick;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — bớt dồn icon/badge trên 1 dòng: số phòng + LSG + sao thay ga ở dòng trên,
            hạng phòng (LoaiPhong) dời xuống dòng riêng bên dưới cho thoáng. */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3 sticky top-0 bg-white z-10 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-2xl font-extrabold text-indigo-600">Phòng {room.MaPhong}</h2>
              {showLsg && (
                <span className="bg-red-600 text-white font-bold px-2 py-0.5 rounded-md text-xs shadow-sm">
                  LSG
                </span>
              )}
              <LinenChangeBadge room={room} />
            </div>
            <span className="inline-block mt-1 bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-1 rounded-md">
              {room.LoaiPhong}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-6 pt-4 space-y-4">
          {/* Dải trạng thái khách + ngày lưu trú — đổi nền ĐEN sang nền SÁNG (xanh dương nhạt) để dễ nhìn hơn */}
          <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-[12px] font-semibold">
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
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={toggleDnd}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-[13px] font-bold ${
                    isDnd ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Moon className="w-4 h-4" /> DND {isDnd ? '(Bật)' : ''}
                </button>
                <button
                  onClick={markRefused}
                  className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-[13px] font-bold bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  <AlertTriangle className="w-4 h-4" /> Từ chối (RF)
                </button>
              </div>
            )}

            {/* Khối checklist — Thay ga giường (LinenChange) + Kiểm tra Két sắt (Mở/Đóng, giữ 3 trạng thái) */}
            <div className="bg-slate-100 rounded-xl p-3 space-y-2.5">
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
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${
                      room.SafeStatus === 'Mở' ? 'bg-amber-500 text-white' : 'bg-white border border-slate-200 text-slate-500'
                    }`}
                  >
                    <Unlock className="w-3 h-3" /> MỞ
                  </button>
                  <button
                    onClick={() => setSafeStatus('Đóng')}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${
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
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] bg-slate-50"
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
                        className="w-full flex items-center justify-center gap-2 bg-slate-200 text-slate-400 rounded-xl py-3.5 text-sm font-bold cursor-not-allowed opacity-70"
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
                        className="w-full flex items-center justify-center gap-2 bg-slate-200 text-slate-400 rounded-xl py-3.5 text-sm font-bold cursor-not-allowed"
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
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-3.5 text-sm font-bold"
                  >
                    <Play className="w-4 h-4" /> BẮT ĐẦU DỌN PHÒNG
                  </button>
                );
              })()}
              {isCleaning && (
                <button
                  onClick={finishCleaning}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white rounded-xl py-3.5 text-sm font-bold"
                >
                  <Square className="w-4 h-4" /> HOÀN THÀNH ({formatElapsed(elapsedSecondsSince(room.StartTime))})
                </button>
              )}
              {isDone && (
                <div className="space-y-2">
                  <div className="w-full flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl py-3.5 text-sm font-bold">
                    <CheckCircle2 className="w-4 h-4" /> PHÒNG ĐÃ DỌN
                  </div>
                  <button
                    onClick={reportDirtyAgain}
                    className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 rounded-xl py-2.5 text-[13px] font-bold"
                  >
                    <Undo2 className="w-3.5 h-3.5" /> LÀM LẠI PHÒNG
                  </button>
                </div>
              )}
            </div>
          )}
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
