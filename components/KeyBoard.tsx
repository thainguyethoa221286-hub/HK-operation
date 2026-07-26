'use client';

import { Key, Clock } from 'lucide-react';
import { KEY_SETS } from '@/lib/types';
import type { KeyLog } from '@/lib/types';
import { formatTimeOnly } from '@/lib/roomStyles';

interface KeyBoardProps {
  keyLogs: KeyLog[];
  /** Nếu có — cho phép bấm mượn/trả (dùng ở màn Nhiệm vụ). Không có thì chỉ xem (dùng ở Báo cáo). */
  myName?: string;
  onBorrow?: (keyLabel: string) => void;
  onReturn?: (rowIndex: number) => void;
}

export default function KeyBoard({ keyLogs, myName, onBorrow, onReturn }: KeyBoardProps) {
  const interactive = !!myName;

  return (
    <div className="grid grid-cols-3 gap-2">
      {KEY_SETS.map((label) => {
        // Bộ chìa nào cũng chỉ có tối đa 1 dòng "Đang giữ" tại 1 thời điểm (đã chặn phía Code.gs)
        const activeLog = keyLogs.find((l) => l.keyLabel === label && l.trangThai === 'Đang giữ');
        const isHeldByMe = activeLog && activeLog.nhanVien === myName;
        const isHeldByOther = activeLog && !isHeldByMe;

        let tileCls = 'border-emerald-500 bg-white'; // Có sẵn
        if (isHeldByMe) tileCls = 'border-blue-500 bg-blue-100';
        else if (isHeldByOther) tileCls = 'border-slate-300 bg-slate-100';

        const canTap = interactive && (isHeldByMe || !activeLog);
        const handleClick = () => {
          if (!canTap) return;
          if (isHeldByMe && activeLog) onReturn?.(activeLog.rowIndex);
          else if (!activeLog) onBorrow?.(label);
        };

        return (
          <div
            key={label}
            onClick={handleClick}
            className={`rounded-xl border-2 p-2.5 text-center transition-all ${tileCls} ${
              canTap ? 'cursor-pointer hover:shadow-md' : isHeldByOther ? 'opacity-80' : ''
            }`}
          >
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
  );
}
