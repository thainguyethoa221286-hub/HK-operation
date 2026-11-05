'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, Play, Square, Check, RotateCcw } from 'lucide-react';
import type { ExtraTaskItem } from '@/lib/extraTasks';
import { formatTimeOnly, elapsedSecondsSince, formatElapsed } from '@/lib/roomStyles';

interface ExtraTaskCardProps {
  task: ExtraTaskItem;
  onStart: () => void;
  onFinish: () => void;
  onRedo: () => void;
  busy?: boolean;
}

/** Thẻ NHIỆM VỤ PHỤ ở màn Nhiệm vụ của nhân viên — thiết kế như 1 phiếu công việc định kỳ
 *  (kẹp giấy + bảng Bắt đầu / Kết thúc / Thời gian). Được tính như 01 phòng trong tiến độ. */
export default function ExtraTaskCard({ task, onStart, onFinish, onRedo, busy }: ExtraTaskCardProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (task.status !== 'doing') return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [task.status]);

  const isDoing = task.status === 'doing';
  const isDone = task.status === 'done';
  const tone = isDone
    ? { bar: 'bg-emerald-500', ring: 'ring-2 ring-emerald-400/70', chip: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'ĐÃ XONG' }
    : isDoing
    ? { bar: 'bg-blue-500', ring: 'ring-2 ring-blue-300/70', chip: 'bg-blue-100 text-blue-700 border-blue-200', label: 'ĐANG LÀM' }
    : { bar: 'bg-amber-400', ring: '', chip: 'bg-amber-100 text-amber-800 border-amber-200', label: 'CHƯA LÀM' };

  const duration = isDoing
    ? formatElapsed(elapsedSecondsSince(task.start))
    : isDone
    ? `${task.minutes || '0'} phút`
    : '—';

  return (
    <div className={`relative h-full min-h-[178px] rounded-2xl bg-gradient-to-b from-amber-100 to-amber-200/70 p-1.5 pt-3 shadow-[0_8px_18px_-10px_rgba(15,23,42,0.45)] ${tone.ring}`}>
      {/* Kẹp giấy kim loại */}
      <span className="absolute left-1/2 -top-1.5 -translate-x-1/2 z-10 w-12 h-4 rounded-md bg-gradient-to-b from-slate-200 via-slate-300 to-slate-500 border border-slate-400/70 shadow-[0_2px_3px_rgba(0,0,0,0.3)]">
        <span className="absolute left-1/2 top-[3px] -translate-x-1/2 w-6 h-[5px] rounded-full bg-slate-600/60" />
      </span>

      {/* Tờ phiếu */}
      <div className="relative h-full flex flex-col overflow-hidden rounded-xl bg-white border border-amber-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <span className={`absolute inset-y-0 left-0 w-1.5 ${tone.bar}`} />

        <div className="pl-3.5 pr-2.5 pt-2.5 flex items-start justify-between gap-1.5">
          <span className="flex items-center gap-1 text-[8.5px] font-extrabold tracking-[0.04em] text-amber-700 uppercase whitespace-nowrap min-w-0">
            <ClipboardList className="w-3 h-3" /> Nhiệm vụ phụ
          </span>
          <span className={`text-[8px] font-extrabold border rounded-full px-1.5 py-[1px] whitespace-nowrap flex-shrink-0 ${tone.chip}`}>{tone.label}</span>
        </div>

        <div className="pl-3.5 pr-2.5 mt-1 text-[13px] font-bold leading-snug text-slate-800 line-clamp-2 break-words" title={task.text}>
          {task.text}
        </div>

        {/* Bảng thời gian như phiếu task định kỳ */}
        <div className="mx-2.5 ml-3.5 mt-2 rounded-lg border border-slate-200 overflow-hidden text-[10.5px] tabular-nums">
          {[
            ['Bắt đầu', task.start ? formatTimeOnly(task.start) : '--:--'],
            ['Kết thúc', task.end ? formatTimeOnly(task.end) : '--:--'],
            ['Thời gian', duration],
          ].map(([k, v], i) => (
            <div key={k} className={`flex items-center justify-between px-2 py-[3px] ${i % 2 ? 'bg-slate-50' : 'bg-white'} ${i ? 'border-t border-slate-100' : ''}`}>
              <span className="text-slate-500 font-semibold">{k}</span>
              <span className={`font-bold ${isDoing && k === 'Thời gian' ? 'text-blue-600' : 'text-slate-800'}`}>{v}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto p-2.5 pl-3.5">
          {task.status === 'todo' && (
            <button
              type="button"
              onClick={onStart}
              disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11.5px] font-extrabold text-white bg-gradient-to-r from-blue-600 to-sky-500 shadow-[0_6px_14px_-6px_rgba(37,99,235,0.7)] active:scale-[0.98] transition disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" /> BẮT ĐẦU
            </button>
          )}
          {isDoing && (
            <button
              type="button"
              onClick={onFinish}
              disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11.5px] font-extrabold text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_6px_14px_-6px_rgba(249,115,22,0.7)] active:scale-[0.98] transition disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5" /> HOÀN THÀNH
            </button>
          )}
          {isDone && (
            <div className="flex items-center gap-1.5">
              <span className="flex-1 flex items-center justify-center gap-1 rounded-xl py-2 text-[11.5px] font-extrabold text-white bg-gradient-to-r from-emerald-600 to-green-500">
                <Check className="w-3.5 h-3.5" strokeWidth={3} /> ĐÃ XONG
              </span>
              <button
                type="button"
                onClick={onRedo}
                disabled={busy}
                title="Làm lại nhiệm vụ này"
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 bg-white disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
