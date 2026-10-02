'use client';

import { useEffect, useState } from 'react';
import { Play, Square, Ban, Hand, RotateCcw, Lock, Unlock, BedDouble } from 'lucide-react';
import type { Room } from '@/lib/types';
import {
  formatDateShort, nowTimeStr, diffMinutes, elapsedSecondsSince, formatElapsed,
  addNoteCode, removeNoteCode, LinenChangeBadge,
} from '@/lib/roomStyles';

const FO_BADGE: Record<string, { text: string; cls: string }> = {
  Occupied: { text: 'OD', cls: 'bg-red-50 text-red-600 border border-red-300' },
  'Due out': { text: 'DO', cls: 'bg-orange-50 text-orange-600 border border-orange-300' },
  Vacant: { text: 'VD', cls: 'bg-slate-100 text-slate-500 border border-slate-300' },
  'Due out/ARR': { text: 'DO/Arr', cls: 'bg-purple-50 text-purple-600 border border-purple-300' },
  Arrival: { text: 'ARR', cls: 'bg-sky-50 text-sky-600 border border-sky-300' },
};

interface RoomTaskCardProps {
  room: Room;
  onUpdate: (maPhong: string, fields: Partial<Room>) => void;
}

export default function RoomTaskCard({ room, onUpdate }: RoomTaskCardProps) {
  const [noteDraft, setNoteDraft] = useState(room.GhiChuNV || '');
  const [tick, setTick] = useState(0);
  // Mục 2 — nhắc nhở nhẹ khi bấm Hoàn thành mà chưa kiểm két sắt (phòng OCC)
  const [safeWarning, setSafeWarning] = useState(false);

  useEffect(() => setNoteDraft(room.GhiChuNV || ''), [room.GhiChuNV]);

  // Đồng hồ đếm giờ sống khi đang dọn — tick mỗi giây để re-render, giá trị thật tính lại từ StartTime
  useEffect(() => {
    if (room.TaskStatus !== 'Đang dọn') return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [room.TaskStatus]);

  const saveNote = () => {
    if (noteDraft !== room.GhiChuNV) onUpdate(room.MaPhong, { GhiChuNV: noteDraft });
  };

  const toggleDnd = () => {
    if (room.TaskStatus === 'DND') {
      onUpdate(room.MaPhong, { TaskStatus: 'Chưa dọn', GhiChuNV: removeNoteCode(room.GhiChuNV, 'DND') });
    } else {
      onUpdate(room.MaPhong, { TaskStatus: 'DND', GhiChuNV: addNoteCode(room.GhiChuNV, 'DND') });
    }
  };

  const markRefused = () => {
    onUpdate(room.MaPhong, {
      TaskStatus: 'Refused',
      StartTime: nowTimeStr(), // tái sử dụng StartTime làm mốc giờ bấm Refused
      GhiChuNV: addNoteCode(room.GhiChuNV, 'RF'),
    });
  };

  const redoRoom = () => {
    onUpdate(room.MaPhong, {
      TaskStatus: 'Chưa dọn',
      StartTime: '',
      GhiChuNV: removeNoteCode(room.GhiChuNV, 'RF'),
    });
  };

  const setSafeStatus = (value: 'Mở' | 'Đóng') => {
    setSafeWarning(false);
    onUpdate(room.MaPhong, { SafeStatus: room.SafeStatus === value ? 'Chưa kiểm' : value });
  };

  const toggleLinenChange = () => {
    onUpdate(room.MaPhong, { LinenChange: room.LinenChange === 'Có' ? '' : 'Có' });
  };

  const startCleaning = () => {
    onUpdate(room.MaPhong, {
      TaskStatus: 'Đang dọn',
      StartTime: nowTimeStr(),
      HkStatus: 'Phòng đang dọn',
    });
  };

  // Mục 2 — Ràng buộc: phòng OCC (Occupied) bắt buộc đã kiểm két sắt (Mở/Đóng) mới cho Hoàn thành.
  // Phòng Vacant/Due out/Arrival/Due out-ARR không bắt buộc.
  const finishCleaning = () => {
    if (room.FoStatus === 'Occupied' && room.SafeStatus === 'Chưa kiểm') {
      setSafeWarning(true);
      return;
    }
    const end = nowTimeStr();
    onUpdate(room.MaPhong, {
      TaskStatus: 'Hoàn thành',
      EndTime: end,
      Duration: String(diffMinutes(room.StartTime, end)),
      HkStatus: 'Phòng sạch', // chờ giám sát Kiểm phòng/Nhả phòng ở màn Sơ đồ phòng
    });
  };

  const isRefused = room.TaskStatus === 'Refused';
  const isDnd = room.TaskStatus === 'DND';
  const isCleaning = room.TaskStatus === 'Đang dọn';
  const isDone = room.TaskStatus === 'Hoàn thành';
  void tick; // ép re-render mỗi giây khi đang dọn

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header — nền pastel dịu mắt thay vì trắng trơn */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2.5 border-b border-slate-100 bg-slate-50">
        <div className="flex items-baseline gap-2">
          <span className="text-[26px] font-extrabold text-slate-800 leading-none">{room.MaPhong}</span>
          <LinenChangeBadge room={room} />
          {FO_BADGE[room.FoStatus] && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${FO_BADGE[room.FoStatus].cls}`}>
              {FO_BADGE[room.FoStatus].text}
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-500 font-medium">{formatDateShort(room.NgayO)}</span>
      </div>

      {(isRefused || isDnd) && (
        <div className="px-3.5 pt-2.5 flex items-center justify-between">
          <span className="bg-red-100 text-red-700 text-[11px] font-extrabold px-2 py-1 rounded-md">
            {isRefused ? `PHÒNG KHÔNG LÀM — ${room.StartTime}: Refused` : 'DND — KHÔNG LÀM PHIỀN'}
          </span>
          <button
            onClick={isRefused ? redoRoom : toggleDnd}
            className="flex items-center gap-1 text-[11px] font-bold text-blue-600"
          >
            <RotateCcw className="w-3.5 h-3.5" /> {isRefused ? 'LÀM LẠI PHÒNG NÀY' : 'BỎ DND'}
          </button>
        </div>
      )}

      <div className="p-3.5 space-y-2.5">
        {/* Ghi chú — 2 chiều với Sơ đồ phòng (cùng field GhiChuNV) */}
        <input
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={saveNote}
          placeholder="Thêm ghi chú tại đây..."
          className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-[13px] bg-slate-50"
        />

        {/* DND / REFUSED */}
        {!isRefused && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={toggleDnd}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold border ${
                isDnd ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-200'
              }`}
            >
              <Ban className="w-3.5 h-3.5" /> DND
            </button>
            <button
              onClick={markRefused}
              className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold border bg-white text-slate-600 border-slate-200"
            >
              <Hand className="w-3.5 h-3.5" /> REFUSED
            </button>
          </div>
        )}

        {/* Két sắt */}
        <div className="flex items-center justify-between bg-slate-50 rounded-lg px-2.5 py-2">
          <span className="text-[11px] font-bold text-slate-500">KÉT SẮT</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400 mr-1">
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

        {safeWarning && (
          <div className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
            ⚠ Phòng đang có khách (OCC) — vui lòng kiểm két sắt (Mở/Đóng) trước khi Hoàn thành.
          </div>
        )}

        {/* Thay giường — Mục 2, đặt ngay dưới khu vực Két sắt */}
        <button
          onClick={toggleLinenChange}
          className={`w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold border ${
            room.LinenChange === 'Có' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200'
          }`}
        >
          <BedDouble className="w-3.5 h-3.5" /> {room.LinenChange === 'Có' ? 'ĐÃ THAY GIƯỜNG' : 'THAY GIƯỜNG'}
        </button>

        {/* Bấm giờ dọn phòng */}
        {!isRefused && (
          <>
            {!isCleaning && !isDone && (
              <button
                onClick={startCleaning}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-3 text-sm font-bold"
              >
                <Play className="w-4 h-4" /> BẮT ĐẦU DỌN PHÒNG
              </button>
            )}
            {isCleaning && (
              <button
                onClick={finishCleaning}
                className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white rounded-xl py-3 text-sm font-bold"
              >
                <Square className="w-4 h-4" /> HOÀN THÀNH ({formatElapsed(elapsedSecondsSince(room.StartTime))})
              </button>
            )}
            {isDone && (
              <div className="w-full text-center bg-green-50 text-green-700 rounded-xl py-3 text-sm font-bold">
                ✓ ĐÃ HOÀN THÀNH — {room.StartTime} → {room.EndTime} ({room.Duration} phút)
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
