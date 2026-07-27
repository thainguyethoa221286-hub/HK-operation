'use client';

import { useEffect, useRef, useState, Fragment } from 'react';
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

/** Layout RIÊNG cho bản in A4 ngang — 2 khối x 4 cột, y hệt mẫu giấy chị chụp.
 *  Khối 1: tầng 2,3,4,5 (8 phòng/cột). Khối 2: tầng 6,7,8, và tầng 9+1 GỘP chung 1 cột. */
const PRINT_BLOCKS: string[][][] = [
  [
    ['202', '204', '206', '208', '210', '212', '214', '216'],
    ['302', '304', '306', '308', '310', '312', '314', '316'],
    ['402', '404', '406', '408', '410', '412', '414', '416'],
    ['502', '504', '506', '508', '510', '512', '514', '516'],
  ],
  [
    ['602', '604', '606', '608', '610', '612', '614', '616'],
    ['777', '702', '704', '706', '708'],
    ['888', '802', '804'],
    ['999', '902', '904', '906', '908', '102', '104'],
  ],
];

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
      {/* ============ PHẦN MÀN HÌNH — tương tác, ẩn hoàn toàn khi in ============ */}
      <div className="screen-only">
        <div className="p-4 pb-2">
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => { if (titleDraft !== chart.title) onUpdateMeta(titleDraft.trim() || 'Task mới', chart.palette); }}
            placeholder="[ NHẬP TÊN TASKS / CHART TITLE ]"
            className="w-full text-2xl font-bold text-slate-800 outline-none border-b-2 border-transparent focus:border-emerald-400 px-1 py-1"
          />
        </div>

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

        <div className={`flex mx-3 mt-3 rounded-t-lg overflow-hidden ${headerCls}`}>
          <div className="w-14 flex-shrink-0 px-2 py-2 text-[10px] font-bold uppercase text-center border-r border-white/20">Room</div>
          <div className="flex-1 px-2 py-2 text-[10px] font-bold uppercase text-center">Note</div>
        </div>

        {/* Mảng phẳng theo tầng 1->9 — đúng thứ tự trên mọi kích thước màn hình */}
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

        <div className="px-4 py-3 border-t border-slate-200 text-right">
          <span className="text-[12px] font-extrabold text-slate-600">
            TOTAL: {totalChecked} / {totalRooms}
          </span>
        </div>
      </div>

      {/* ============ PHẦN IN A4 NGANG — chỉ hiện khi in, y hệt mẫu giấy: 2 khối x 4 cột ============ */}
      <div className="print-only-a4">
        <div className="print-a4-title">{chart.title || 'TASK'}</div>
        {PRINT_BLOCKS.map((block, blockIdx) => {
          const maxRows = Math.max(...block.map((c) => c.length));
          return (
            <table key={blockIdx} className="print-a4-table">
              <thead>
                <tr>
                  {block.map((_, ci) => (
                    <Fragment key={ci}>
                      <th>Room Number</th>
                      <th>NOTE</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxRows }).map((_, rowIdx) => (
                  <tr key={rowIdx}>
                    {block.map((col, ci) => {
                      const maPhong = col[rowIdx];
                      if (!maPhong) return <Fragment key={ci}><td /><td /></Fragment>;
                      const cell = getCell(maPhong);
                      return (
                        <Fragment key={ci}>
                          <td className="print-a4-room">
                            <input type="checkbox" checked={cell.checked} readOnly className="print-a4-checkbox" />
                            {maPhong}
                          </td>
                          <td className="print-a4-note">{cell.note}</td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })}
        <div className="print-a4-total">TOTAL: {totalChecked} / {totalRooms}</div>
      </div>
    </div>
  );
}
