'use client';

import { useEffect, useState } from 'react';
import {
  X, Moon, AlertTriangle, Play, Square, RotateCcw,
  Lock, Unlock, User, CheckCircle2, Undo2, History,
} from 'lucide-react';
import type { Room, HistoryEntry } from '@/lib/types';
import {
  formatDateShort, formatTimeOnly, nowTimeStr, diffMinutes, elapsedSecondsSince, formatElapsed,
  addNoteCode, removeNoteCode, stripCodesFromNote, extractNoteCodes, FO_STATUS_LABEL,
} from '@/lib/roomStyles';
import { getTaskHistory, logTaskAction } from '@/lib/api';

interface RoomTaskModalProps {
  room: Room;
  onUpdate: (maPhong: string, fields: Partial<Room>) => void;
  onClose: () => void;
}

export default function RoomTaskModal({ room, onUpdate, onClose }: RoomTaskModalProps) {
  const [noteDraft, setNoteDraft] = useState(stripCodesFromNote(room.GhiChuNV || ''));
  const [tick, setTick] = useState(0);
  const [safeWarning, setSafeWarning] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => setNoteDraft(stripCodesFromNote(room.GhiChuNV || '')), [room.GhiChuNV]);

  const refreshHistory = () => {
    getTaskHistory(room.MaPhong).then((list) => {
      setHistory(list);
      setLoadingHistory(false);
    });
  };

  useEffect(() => {
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.MaPhong]);

  useEffect(() => {
    if (room.TaskStatus !== 'Đang dọn') return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [room.TaskStatus]);

  const staffName = room.NhanVienPhuTrach || '';

  // Ghi log + refresh lại danh sách để hiện ngay lập tức (không cần đợi polling 15s)
  const log = (hanhDong: string, chiTiet: string = '') => {
    logTaskAction(room.MaPhong, staffName, hanhDong, chiTiet).then(refreshHistory);
  };

  const saveNote = () => {
    const existingCodes = extractNoteCodes(room.GhiChuNV || '');
    const merged = [...existingCodes, noteDraft.trim()].filter(Boolean).join(', ');
    if (merged !== room.GhiChuNV) onUpdate(room.MaPhong, { GhiChuNV: merged });
  };

  const toggleDnd = () => {
    if (room.TaskStatus === 'DND') {
      onUpdate(room.MaPhong, { TaskStatus: 'Chưa dọn', GhiChuNV: removeNoteCode(room.GhiChuNV, 'DND') });
      log('DND Tắt');
    } else {
      onUpdate(room.MaPhong, { TaskStatus: 'DND', GhiChuNV: addNoteCode(room.GhiChuNV, 'DND') });
      log('DND Bật');
    }
  };

  const markRefused = () => {
    onUpdate(room.MaPhong, {
      TaskStatus: 'Refused',
      StartTime: nowTimeStr(),
      GhiChuNV: addNoteCode(room.GhiChuNV, 'RF'),
    });
    log('Từ chối (RF)');
  };

  const redoRoom = () => {
    onUpdate(room.MaPhong, { TaskStatus: 'Chưa dọn', StartTime: '', GhiChuNV: removeNoteCode(room.GhiChuNV, 'RF') });
    log('Làm lại phòng');
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
    onUpdate(room.MaPhong, {
      TaskStatus: 'Hoàn thành',
      EndTime: end,
      Duration: String(dur),
      HkStatus: 'Phòng sạch',
    });
    log('Hoàn thành', `${formatTimeOnly(room.StartTime)} → ${formatTimeOnly(end)} (${dur} phút)`);
  };

  // "Báo dơ lại" — cho phép hoàn tác 1 phòng lỡ bấm Hoàn thành nhầm, quay lại Chưa dọn/Phòng dơ
  const reportDirtyAgain = () => {
    onUpdate(room.MaPhong, {
      TaskStatus: 'Chưa dọn', StartTime: '', EndTime: '', Duration: '', HkStatus: 'Phòng dơ',
    });
    log('Báo dơ lại');
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-white z-10 border-b border-slate-100">
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-extrabold text-indigo-600">Phòng {room.MaPhong}</h2>
            <span className="bg-slate-800 text-white text-[11px] font-bold px-2 py-1 rounded-md">{room.LoaiPhong}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-6 pt-4 space-y-4">
          {/* Dải trạng thái khách + ngày lưu trú */}
          <div className="bg-slate-800 text-white rounded-xl px-3.5 py-2.5 flex items-center justify-between text-[12px] font-semibold">
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
              <button onClick={isRefused ? redoRoom : toggleDnd} className="flex items-center gap-1 text-[11px] font-bold text-blue-600 flex-shrink-0 ml-2">
                <RotateCcw className="w-3.5 h-3.5" /> {isRefused ? 'LÀM LẠI' : 'BỎ DND'}
              </button>
            </div>
          )}

          {/* SECTION 1 — Các thao tác nhanh */}
          <div>
            <div className="text-[11px] font-extrabold text-indigo-500 uppercase tracking-wide mb-2">
              Section 1: Các thao tác nhanh
            </div>
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

          {/* SECTION 2 — Ghi chú buồng phòng & nhân viên */}
          <div>
            <div className="text-[11px] font-extrabold text-indigo-500 uppercase tracking-wide mb-2">
              Section 2: Ghi chú buồng phòng &amp; nhân viên
            </div>
            <div className="text-[12px] font-semibold text-slate-500 mb-1">Nhân viên dọn:</div>
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50 mb-3">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-[13px] font-semibold text-slate-700">{staffName || '—'}</span>
            </div>
            <div className="text-[12px] font-semibold text-slate-500 mb-1">Ghi chú chi tiết phòng:</div>
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={saveNote}
              placeholder="Thêm ghi chú tại đây..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] bg-slate-50"
            />
          </div>

          {/* SECTION 3 — Đồng hồ tác vụ & thao tác trạng thái */}
          {!isRefused && (
            <div>
              <div className="text-[11px] font-extrabold text-indigo-500 uppercase tracking-wide mb-2">
                Section 3: Đồng hồ tác vụ &amp; thao tác trạng thái
              </div>
              {!isCleaning && !isDone && (
                <button
                  onClick={startCleaning}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-3.5 text-sm font-bold"
                >
                  <Play className="w-4 h-4" /> BẮT ĐẦU DỌN PHÒNG
                </button>
              )}
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
                    <CheckCircle2 className="w-4 h-4" /> PHÒNG NÀY ĐÃ SẠCH SẼ &amp; SẴN SÀNG
                  </div>
                  <button
                    onClick={reportDirtyAgain}
                    className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 rounded-xl py-2.5 text-[13px] font-bold"
                  >
                    <Undo2 className="w-3.5 h-3.5" /> Báo dơ lại
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION 4 — Lịch sử dọn thời gian thực tế (nhiều dòng trong ngày, không ghi đè) */}
          <div>
            <div className="text-[11px] font-extrabold text-indigo-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Section 4: Lịch sử dọn hôm nay
            </div>
            {loadingHistory ? (
              <div className="text-[12px] text-slate-400 text-center py-3">Đang tải lịch sử...</div>
            ) : history.length === 0 ? (
              <div className="text-[12px] text-slate-400 text-center py-3">Chưa có thao tác nào hôm nay.</div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {history.map((h, i) => (
                  <div key={i} className="flex items-start justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[12px]">
                    <div>
                      <span className="font-bold text-slate-700">{h.hanhDong}</span>
                      {h.chiTiet && <span className="text-slate-500"> — {h.chiTiet}</span>}
                      {h.nhanVien && <div className="text-[10px] text-slate-400">Nhân viên: {h.nhanVien}</div>}
                    </div>
                    <span className="text-slate-400 font-semibold flex-shrink-0 ml-2">{h.gio?.slice(0, 5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
