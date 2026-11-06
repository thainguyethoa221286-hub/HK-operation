'use client';

import { AlertTriangle, LogOut, Trash2 } from 'lucide-react';
import type { Room, OverdueHistoryRow } from '@/lib/types';
import { departureLabel } from '@/lib/roomStyles';

/* =========================================================
   LỊCH DND & RF (Noted Board)
   • DND: gộp theo phòng, đếm số ngày DND. Từ DND_WARN_DAYS ngày trở lên -> CẢNH BÁO (cần kiểm tra phòng).
   • RF : chỉ có ngày hôm qua (server giữ đúng 1 ngày).
   • Cạnh số phòng hiện ngày khách trả phòng "OUT 08/11" (lấy từ ngày ở của phòng).
   • Khách đã trả phòng (Vacant / qua ngày out) -> hệ thống tự xoá; giám sát cũng xoá tay được.
   ========================================================= */
export const DND_WARN_DAYS = 3;

interface Props {
  rows: OverdueHistoryRow[];
  rooms: Room[];
  onDeleteRoom: (roomNo: string, category: 'DND' | 'RF') => void;
  onClearAll: () => void;
}

/** "05/11/2026" -> số để sắp xếp */
function dmyKey(d: string): number {
  const m = String(d).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : 0;
}
const shortDM = (d: string) => String(d).split('/').slice(0, 2).join('/');

interface Group { roomNo: string; dates: string[] }

function groupByRoom(rows: OverdueHistoryRow[]): Group[] {
  const map = new Map<string, Set<string>>();
  rows.forEach((r) => {
    if (!map.has(r.roomNo)) map.set(r.roomNo, new Set());
    map.get(r.roomNo)!.add(r.dateNoted);
  });
  return Array.from(map.entries()).map(([roomNo, set]) => ({
    roomNo,
    dates: Array.from(set).sort((a, b) => dmyKey(b) - dmyKey(a)),
  }));
}

export default function OverdueBoard({ rows, rooms, onDeleteRoom, onClearAll }: Props) {
  const roomMap = new Map(rooms.map((r) => [r.MaPhong, r]));
  const dnd = groupByRoom(rows.filter((r) => r.category === 'DND'))
    .sort((a, b) => b.dates.length - a.dates.length || a.roomNo.localeCompare(b.roomNo));
  const rf = groupByRoom(rows.filter((r) => r.category === 'RF')).sort((a, b) => a.roomNo.localeCompare(b.roomNo));
  const warnRooms = dnd.filter((g) => g.dates.length >= DND_WARN_DAYS);

  const OutTag = ({ roomNo }: { roomNo: string }) => {
    const out = departureLabel(roomMap.get(roomNo)?.NgayO);
    return out ? (
      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-md px-1.5 py-[2px] tabular-nums">
        <LogOut className="w-3 h-3" /> OUT {out}
      </span>
    ) : (
      <span className="text-[10.5px] text-slate-400">chưa rõ ngày out</span>
    );
  };

  const DelBtn = ({ roomNo, cat }: { roomNo: string; cat: 'DND' | 'RF' }) => (
    <button
      onClick={() => onDeleteRoom(roomNo, cat)}
      title="Xoá (khách đã trả phòng)"
      className="text-red-500 bg-red-50 hover:bg-red-100 rounded-lg p-1.5 flex-shrink-0"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-lg font-bold text-slate-800">Lịch DND &amp; RF</h2>
        <button onClick={onClearAll} className="flex items-center gap-1.5 text-[12px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
          <Trash2 className="w-3.5 h-3.5" /> Xoá tất cả lịch sử
        </button>
      </div>

      {warnRooms.length > 0 && (
        <div className="mb-3 rounded-xl border border-red-300 bg-gradient-to-r from-red-50 to-rose-50 px-3.5 py-2.5 flex items-start gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center flex-shrink-0 animate-pulse">
            <AlertTriangle className="w-[18px] h-[18px]" />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-extrabold text-red-700">
              {warnRooms.length} phòng DND từ {DND_WARN_DAYS} ngày trở lên — cần kiểm tra
            </div>
            <div className="text-[12px] text-red-600 font-semibold tabular-nums">
              {warnRooms.map((g) => `${g.roomNo} (${g.dates.length} ngày)`).join(' · ')}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* DND */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 text-[12px] font-bold bg-red-100 text-red-700 flex justify-between">
            <span>DND</span><span className="font-semibold">giữ đến khi khách trả phòng</span>
          </div>
          {dnd.length === 0 ? (
            <div className="text-[12px] text-slate-400 text-center py-4">Trống</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {dnd.map((g) => {
                const warn = g.dates.length >= DND_WARN_DAYS;
                return (
                  <div key={g.roomNo} className={`flex items-center gap-2 px-3 py-2 ${warn ? 'bg-red-50/70' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-800 text-[14px] tabular-nums">{g.roomNo}</span>
                        <OutTag roomNo={g.roomNo} />
                        <span className={`text-[10.5px] font-extrabold rounded-md px-1.5 py-[2px] ${warn ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700'}`}>
                          {warn && '⚠ '}{g.dates.length} ngày
                        </span>
                      </div>
                      <div className="text-[10.5px] text-slate-400 mt-0.5 tabular-nums">{g.dates.map(shortDM).join(' · ')}</div>
                    </div>
                    <DelBtn roomNo={g.roomNo} cat="DND" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RF */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 text-[12px] font-bold bg-purple-100 text-purple-700 flex justify-between">
            <span>RF</span><span className="font-semibold">chỉ giữ ngày hôm qua</span>
          </div>
          {rf.length === 0 ? (
            <div className="text-[12px] text-slate-400 text-center py-4">Trống</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rf.map((g) => (
                <div key={g.roomNo} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-800 text-[14px] tabular-nums">{g.roomNo}</span>
                      <OutTag roomNo={g.roomNo} />
                    </div>
                    <div className="text-[10.5px] text-slate-400 mt-0.5 tabular-nums">{g.dates.map(shortDM).join(' · ')}</div>
                  </div>
                  <DelBtn roomNo={g.roomNo} cat="RF" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
