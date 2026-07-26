'use client';

import { useState } from 'react';
import { Key, Clock, CheckSquare, Square } from 'lucide-react';
import { KEY_SETS } from '@/lib/types';
import type { KeyLog } from '@/lib/types';
import { formatTimeOnly } from '@/lib/roomStyles';

interface KeyBoardProps {
  keyLogs: KeyLog[];
  /** Nếu có — cho phép tích chọn nhiều chìa rồi bấm Xác nhận để mượn cùng lúc (dùng ở màn Nhiệm vụ).
   *  Không có thì chỉ xem (dùng ở Báo cáo). */
  myName?: string;
  /** Mục 3 — mượn NHIỀU chìa cùng lúc: nhận vào mảng nhãn đã tích chọn, chỉ gọi 1 lần khi bấm Xác nhận */
  onConfirmBorrow?: (keyLabels: string[]) => void;
  onReturn?: (rowIndex: number) => void;
}

export default function KeyBoard({ keyLogs, myName, onConfirmBorrow, onReturn }: KeyBoardProps) {
  const interactive = !!myName;
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelect = (label: string) => {
    setSelected((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));
  };

  const handleConfirm = () => {
    if (selected.length === 0) return;
    onConfirmBorrow?.(selected);
    setSelected([]);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {KEY_SETS.map((label) => {
          // Bộ chìa nào cũng chỉ có tối đa 1 dòng "Đang giữ" tại 1 thời điểm (đã chặn phía Code.gs)
          const activeLog = keyLogs.find((l) => l.keyLabel === label && l.trangThai === 'Đang giữ');
          const isHeldByMe = activeLog && activeLog.nhanVien === myName;
          const isHeldByOther = activeLog && !isHeldByMe;
          const isPending = selected.includes(label);

          let tileCls = 'border-emerald-500 bg-white'; // Có sẵn
          if (isHeldByMe) tileCls = 'border-blue-500 bg-blue-100';
          else if (isHeldByOther) tileCls = 'border-slate-300 bg-slate-100';
          else if (isPending) tileCls = 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-400';

          const canTap = interactive && (isHeldByMe || !activeLog);
          const handleClick = () => {
            if (!canTap) return;
            if (isHeldByMe && activeLog) onReturn?.(activeLog.rowIndex);
            else if (!activeLog) toggleSelect(label); // Mục 3 — chỉ tích chọn, CHƯA mượn ngay
          };

          return (
            <div
              key={label}
              onClick={handleClick}
              className={`relative rounded-xl border-2 p-2.5 text-center transition-all ${tileCls} ${
                canTap ? 'cursor-pointer hover:shadow-md' : isHeldByOther ? 'opacity-80' : ''
              }`}
            >
              {interactive && !activeLog && (
                <span className="absolute top-1 right-1">
                  {isPending ? <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> : <Square className="w-3.5 h-3.5 text-slate-300" />}
                </span>
              )}
              <Key className={`w-4 h-4 mx-auto mb-1 ${isHeldByMe ? 'text-blue-600' : isHeldByOther ? 'text-slate-400' : 'text-emerald-600'}`} />
              <div className="text-[11px] font-extrabold text-slate-800 leading-tight">{label}</div>
              {activeLog ? (
                <div className="mt-1 text-[9px] font-semibold text-slate-500 flex items-center justify-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {isHeldByMe ? 'Bạn giữ' : activeLog.nhanVien} · {formatTimeOnly(activeLog.gioMuon)}
                </div>
              ) : (
                <div className="mt-1 text-[9px] font-bold text-emerald-600">Có sẵn</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mục 3 — chỉ mượn thật sự (lưu timestamp + mở khóa Nhiệm vụ) khi bấm nút này */}
      {interactive && selected.length > 0 && (
        <button
          onClick={handleConfirm}
          className="w-full mt-3 flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl py-3 text-sm font-bold"
        >
          🔑 XÁC NHẬN NHẬN CHÌA KHÓA ({selected.length})
        </button>
      )}
    </div>
  );
}
