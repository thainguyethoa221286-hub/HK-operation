'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { TaskChart, TaskChartCell } from '@/lib/types';
import { TASK_CHART_COLUMNS } from '@/lib/types';

const PALETTES: Record<number, string> = {
  1: 'bg-slate-800 text-white',
  2: 'bg-purple-800 text-white',
  3: 'bg-zinc-700 text-white',
};
const PALETTE_SWATCH: Record<number, string> = {
  1: 'bg-slate-800',
  2: 'bg-purple-800',
  3: 'bg-zinc-700',
};

interface TaskChartCardProps {
  chart: TaskChart;
  cells: TaskChartCell[];
  search: string;
  onDelete: () => void;
  onUpdateMeta: (title: string, palette: number) => void;
  onUpdateCell: (maPhong: string, checked: boolean, note: string) => void;
}

export default function TaskChartCard({ chart, cells, search, onDelete, onUpdateMeta, onUpdateCell }: TaskChartCardProps) {
  const [titleDraft, setTitleDraft] = useState(chart.title);
  useEffect(() => setTitleDraft(chart.title), [chart.title]);

  const cellMap: Record<string, TaskChartCell> = {};
  cells.forEach((c) => { cellMap[c.maPhong] = c; });

  const getCell = (maPhong: string) => cellMap[maPhong] || { chartId: chart.id, maPhong, checked: false, note: '' };

  const totalChecked = cells.filter((c) => c.checked).length;
  const totalRooms = TASK_CHART_COLUMNS.reduce((sum, col) => sum + col.length, 0);

  const maxRows = Math.max(...TASK_CHART_COLUMNS.map((c) => c.length));
  const q = search.trim().toLowerCase();

  const matchesSearch = (maPhong: string) => {
    if (!q) return true;
    const cell = getCell(maPhong);
    return maPhong.toLowerCase().includes(q) || cell.note.toLowerCase().includes(q);
  };

  const headerCls = PALETTES[chart.palette] || PALETTES[1];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Tiêu đề Task + xoá + chọn bảng màu */}
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-2.5">
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => { if (titleDraft !== chart.title) onUpdateMeta(titleDraft.trim() || 'Task mới', chart.palette); }}
          placeholder="[ NHẬP TÊN TASKS / CHART TITLE ]"
          className="flex-1 min-w-[180px] text-[15px] font-extrabold text-slate-800 outline-none border-b-2 border-transparent focus:border-emerald-400 px-1 py-1"
        />
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((p) => (
            <button
              key={p}
              onClick={() => onUpdateMeta(chart.title, p)}
              className={`w-6 h-6 rounded-full ${PALETTE_SWATCH[p]} ${chart.palette === p ? 'ring-2 ring-offset-2 ring-emerald-500' : ''}`}
              title={`Bảng màu ${p}`}
            />
          ))}
        </div>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 text-[12px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" /> XÓA TASK
        </button>
      </div>

      {/* Lưới 4 cột kép Room Number | Note */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr>
              {[0, 1, 2, 3].map((i) => (
                <th key={i} colSpan={2} className={`px-0 py-0 ${headerCls}`}>
                  <div className="flex">
                    <div className="flex-1 px-2.5 py-2 text-[10px] font-bold uppercase border-r border-white/20 text-center">Room</div>
                    <div className="flex-[2] px-2.5 py-2 text-[10px] font-bold uppercase text-center">Note</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRows }).map((_, rowIdx) => (
              <tr key={rowIdx} className="border-t border-slate-50">
                {TASK_CHART_COLUMNS.map((col, colIdx) => {
                  const maPhong = col[rowIdx];
                  if (!maPhong) return <td key={colIdx} colSpan={2} className="border-r border-slate-100 last:border-r-0" />;
                  const cell = getCell(maPhong);
                  const visible = matchesSearch(maPhong);
                  return (
                    <td key={colIdx} colSpan={2} className="p-0 border-r border-slate-100 last:border-r-0">
                      <div className={`flex items-center gap-1.5 px-2 py-1.5 ${visible ? '' : 'opacity-20'}`}>
                        <input
                          type="checkbox"
                          checked={cell.checked}
                          onChange={(e) => onUpdateCell(maPhong, e.target.checked, cell.note)}
                          className="w-4 h-4 accent-emerald-600 flex-shrink-0"
                        />
                        <span className={`font-extrabold text-slate-700 w-9 flex-shrink-0 ${cell.checked ? 'line-through opacity-50' : ''}`}>
                          {maPhong}
                        </span>
                        <input
                          defaultValue={cell.note}
                          onBlur={(e) => onUpdateCell(maPhong, cell.checked, e.target.value)}
                          placeholder="—"
                          className={`flex-1 min-w-0 text-[12px] outline-none bg-transparent ${cell.checked ? 'line-through opacity-50 text-slate-400' : 'text-slate-600'}`}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer tổng kết */}
      <div className="px-4 py-3 border-t border-slate-100 text-right">
        <span className="text-[12px] font-extrabold text-slate-600">
          TOTAL: {totalChecked} / {totalRooms}
        </span>
      </div>
    </div>
  );
}
