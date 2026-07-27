'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, Printer, Building2 } from 'lucide-react';
import type { TaskChart, TaskChartCell } from '@/lib/types';
import { TASK_CHART_FLOORS } from '@/lib/types';

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
  const cardRef = useRef<HTMLDivElement>(null);

  const cellMap: Record<string, TaskChartCell> = {};
  cells.forEach((c) => { cellMap[c.maPhong] = c; });
  const getCell = (maPhong: string) => cellMap[maPhong] || { chartId: chart.id, maPhong, checked: false, note: '' };

  const totalRooms = TASK_CHART_FLOORS.reduce((sum, f) => sum + f.rooms.length, 0);
  const totalChecked = cells.filter((c) => c.checked).length;

  const q = search.trim().toLowerCase();
  const matchesSearch = (maPhong: string) => {
    if (!q) return true;
    const cell = getCell(maPhong);
    return maPhong.toLowerCase().includes(q) || cell.note.toLowerCase().includes(q);
  };

  const headerCls = PALETTES[chart.palette] || PALETTES[1];

  // In riêng ĐÚNG bảng Task này: đánh dấu card này là .print-target, ẩn mọi thứ khác
  const handlePrint = () => {
    document.body.classList.add('printing-chart-mode');
    cardRef.current?.classList.add('print-target');
    const cleanup = () => {
      document.body.classList.remove('printing-chart-mode');
      cardRef.current?.classList.remove('print-target');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  return (
    <div ref={cardRef} className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
      {/* Tiêu đề Task (to, nổi bật — in ra giấy vẫn giữ) */}
      <div className="p-4 pb-2">
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => { if (titleDraft !== chart.title) onUpdateMeta(titleDraft.trim() || 'Task mới', chart.palette); }}
          placeholder="[ NHẬP TÊN TASKS / CHART TITLE ]"
          className="w-full text-2xl font-bold text-slate-800 outline-none border-b-2 border-transparent focus:border-emerald-400 px-1 py-1"
        />
      </div>

      {/* Thanh điều khiển — ẨN KHI IN (.no-print) */}
      <div className="no-print px-4 pb-3 flex flex-wrap items-center gap-2.5 border-b border-slate-200">
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
          onClick={handlePrint}
          className="flex items-center gap-1 text-[12px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5"
        >
          <Printer className="w-3.5 h-3.5" /> IN TASK
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 text-[12px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" /> XÓA TASK
        </button>
      </div>

      {/* Header Room | Note — 1 hàng duy nhất, nằm ngoài grid, không lặp theo từng tầng */}
      <div className={`flex mx-3 mt-3 rounded-t-lg overflow-hidden ${headerCls}`}>
        <div className="w-14 flex-shrink-0 px-2 py-2 text-[10px] font-bold uppercase text-center border-r border-white/20">Room</div>
        <div className="flex-1 px-2 py-2 text-[10px] font-bold uppercase text-center">Note</div>
      </div>

      {/*
        Mục 1+2 — MẢNG PHẲNG theo tầng 1->9, mỗi tầng là 1 "floor-group" độc lập trong CSS Grid:
        - Desktop: grid-cols-4 + grid-flow-row -> tự chảy trái sang phải, tầng 1,2,3,4 cùng hàng, 5,6,7,8 hàng sau...
        - Mobile & In ấn: task-chart-container chuyển display:block (xem globals.css) -> xếp dọc ĐÚNG thứ tự 1->9,
          vì dữ liệu gốc đã là mảng phẳng sắp theo tầng, không còn bị nhảy cóc như cấu trúc 4 cột cứng trước đây.
      */}
      <div className="task-chart-container grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 grid-flow-row gap-3 p-3">
        {TASK_CHART_FLOORS.map(({ floor, rooms }) => (
          <div key={floor} className="floor-group border border-slate-300 rounded-lg overflow-hidden">
            <div className="bg-slate-100 font-bold text-slate-700 text-[11px] py-1.5 px-2 border-b border-slate-300 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> TẦNG {floor}
            </div>
            {rooms.map((maPhong) => {
              const cell = getCell(maPhong);
              const visible = matchesSearch(maPhong);
              return (
                <div key={maPhong} className={`flex border-b border-slate-200 last:border-b-0 ${visible ? '' : 'opacity-20'}`}>
                  <div className="w-14 flex-shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-r border-slate-200">
                    <input
                      type="checkbox"
                      checked={cell.checked}
                      onChange={(e) => onUpdateCell(maPhong, e.target.checked, cell.note)}
                      className="w-3.5 h-3.5 accent-emerald-600 flex-shrink-0"
                    />
                    <span className={`font-extrabold text-slate-700 text-[12px] ${cell.checked ? 'line-through opacity-50' : ''}`}>
                      {maPhong}
                    </span>
                  </div>
                  <input
                    defaultValue={cell.note}
                    onBlur={(e) => onUpdateCell(maPhong, cell.checked, e.target.value)}
                    placeholder="—"
                    className={`flex-1 min-w-0 text-[12px] outline-none bg-transparent px-2 py-1.5 ${cell.checked ? 'line-through opacity-50 text-slate-400' : 'text-slate-600'}`}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer tổng kết */}
      <div className="px-4 py-3 border-t border-slate-200 text-right">
        <span className="text-[12px] font-extrabold text-slate-600">
          TOTAL: {totalChecked} / {totalRooms}
        </span>
      </div>
    </div>
  );
}
