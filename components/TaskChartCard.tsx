'use client';

import { useEffect, useRef, useState, Fragment } from 'react';
import { Trash2, Printer, Building2 } from 'lucide-react';
import type { TaskChart, TaskChartCell } from '@/lib/types';

/** Cấu trúc CỐ ĐỊNH 2 khối x 4 cột — dùng chung cho cả màn hình lẫn bản in, y hệt mẫu chị chốt.
 *  Khối 1: tầng 2,3,4,5. Khối 2: tầng 6,7,8, và tầng 9+1 GỘP chung 1 cột cuối. */
const CHART_BLOCKS: string[][][] = [
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
const TOTAL_ROOMS = CHART_BLOCKS.flat(2).length;

/** Tầng của 1 phòng — 777/888/999 tính theo tầng 7/8/9 */
function getFloor(maPhong: string): string {
  if (maPhong === '777') return '7';
  if (maPhong === '888') return '8';
  if (maPhong === '999') return '9';
  return maPhong[0];
}

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

  const totalChecked = cells.filter((c) => c.checked).length;

  const q = search.trim().toLowerCase();
  const matchesSearch = (maPhong: string) => {
    if (!q) return true;
    const cell = getCell(maPhong);
    return maPhong.toLowerCase().includes(q) || cell.note.toLowerCase().includes(q);
  };

  const headerCls = PALETTES[chart.palette] || PALETTES[1];

  // In riêng ĐÚNG bảng Task này — ẩn mọi thứ khác trên trang, chỉ hiện card này ở khổ ngang
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
    <div ref={cardRef} className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Tiêu đề Task + điều khiển cùng 1 hàng */}
      <div className="p-4 flex flex-wrap items-center gap-3">
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => { if (titleDraft !== chart.title) onUpdateMeta(titleDraft.trim() || 'Task mới', chart.palette); }}
          placeholder="[ NHẬP TÊN TASKS / CHART TITLE ]"
          className="flex-1 min-w-[160px] text-xl font-bold text-slate-800 outline-none border-b-2 border-transparent focus:border-blue-400 px-1 py-1"
        />
        <div className="no-print flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                onClick={() => onUpdateMeta(chart.title, p)}
                className={`w-6 h-6 rounded-full ${PALETTE_SWATCH[p]} ${chart.palette === p ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
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
      </div>

      {/* 2 khối x 4 cột — mỗi khối có hàng tiêu đề [ROOM|NOTE] x4 riêng, cấu trúc GIỮ NGUYÊN như chị chốt */}
      <div className="px-4 pb-4 space-y-4">
        {CHART_BLOCKS.map((block, blockIdx) => {
          const maxRows = Math.max(...block.map((c) => c.length));
          return (
            <div key={blockIdx} className="border border-slate-300 rounded-xl overflow-hidden">
              {/* Header chính — nền xám đen cao cấp, lặp 4 lần ROOM|NOTE */}
              <div className={`grid grid-cols-4 ${headerCls}`}>
                {block.map((_, ci) => (
                  <div key={ci} className="flex border-r border-white/10 last:border-r-0">
                    <div className="w-16 flex-shrink-0 px-2 py-2.5 text-[11px] font-bold text-center border-r border-white/15">ROOM</div>
                    <div className="flex-1 px-2 py-2.5 text-[11px] font-bold text-center">NOTE</div>
                  </div>
                ))}
              </div>

              {/* Các dòng phòng — track tầng riêng cho từng cột để chèn thẻ Tầng đúng vị trí */}
              {Array.from({ length: maxRows }).map((_, rowIdx) => {
                const floorsThisRow = block.map((col) => (col[rowIdx] ? getFloor(col[rowIdx]) : null));
                const prevFloorsRow = rowIdx > 0 ? block.map((col) => (col[rowIdx - 1] ? getFloor(col[rowIdx - 1]) : null)) : block.map(() => null);
                const anyFloorChange = floorsThisRow.some((f, ci) => f && f !== prevFloorsRow[ci]);

                return (
                  <Fragment key={rowIdx}>
                    {anyFloorChange && (
                      <div className="grid grid-cols-4 bg-slate-50/60 border-t border-slate-200">
                        {block.map((col, ci) => {
                          const floor = floorsThisRow[ci];
                          const changed = floor && floor !== prevFloorsRow[ci];
                          return (
                            <div key={ci} className="px-1.5 py-1 border-r border-slate-100 last:border-r-0">
                              {changed && (
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200 rounded-lg py-0.5 px-2">
                                  <Building2 className="w-2.5 h-2.5" /> TẦNG {floor}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="grid grid-cols-4 border-t border-slate-200">
                      {block.map((col, ci) => {
                        const maPhong = col[rowIdx];
                        if (!maPhong) return <div key={ci} className="border-r border-slate-100 last:border-r-0" />;
                        const cell = getCell(maPhong);
                        const visible = matchesSearch(maPhong);
                        return (
                          <div
                            key={ci}
                            className={`flex border-r border-slate-100 last:border-r-0 hover:bg-slate-50/80 ${visible ? '' : 'opacity-20'}`}
                          >
                            <div className="w-16 flex-shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-r border-slate-100">
                              <input
                                type="checkbox"
                                checked={cell.checked}
                                onChange={(e) => onUpdateCell(maPhong, e.target.checked, cell.note)}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                              />
                              <span className={`font-semibold text-slate-700 text-[12px] ${cell.checked ? 'line-through opacity-50' : ''}`}>
                                {maPhong}
                              </span>
                            </div>
                            <input
                              defaultValue={cell.note}
                              onBlur={(e) => onUpdateCell(maPhong, cell.checked, e.target.value)}
                              placeholder="—"
                              className={`flex-1 min-w-0 text-[12px] outline-none bg-transparent px-2 py-1.5 border-b border-dashed border-slate-200 focus:border-blue-400 ${
                                cell.checked ? 'line-through opacity-50 text-slate-400' : 'text-slate-600'
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer tổng kết */}
      <div className="px-4 pb-4 text-right">
        <span className="font-bold text-slate-600 text-[13px]">
          TOTAL: {totalChecked} / {TOTAL_ROOMS}
        </span>
      </div>
    </div>
  );
}
