'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, Printer, ChevronDown } from 'lucide-react';
import type { TaskChart, TaskChartCell, Room } from '@/lib/types';

/** 55 phòng CỐ ĐỊNH chia theo tầng (777/888/999 thuộc tầng 7/8/9; 102, 104 ghép chung tầng 9) */
const FLOORS: { name: string; rooms: string[] }[] = [
  { name: 'FL 2', rooms: ['202', '204', '206', '208', '210', '212', '214', '216'] },
  { name: 'FL 3', rooms: ['302', '304', '306', '308', '310', '312', '314', '316'] },
  { name: 'FL 4', rooms: ['402', '404', '406', '408', '410', '412', '414', '416'] },
  { name: 'FL 5', rooms: ['502', '504', '506', '508', '510', '512', '514', '516'] },
  { name: 'FL 6', rooms: ['602', '604', '606', '608', '610', '612', '614', '616'] },
  { name: 'FL 7', rooms: ['777', '702', '704', '706', '708'] },
  { name: 'FL 8', rooms: ['888', '802', '804'] },
  { name: 'FL 9 & 1', rooms: ['999', '902', '904', '906', '908', '102', '104'] },
];
const ALL_ROOMS = FLOORS.flatMap((f) => f.rooms);
const TOTAL_ROOMS = ALL_ROOMS.length;

/** Màu tiêu đề tầng theo bảng màu đã chọn của task */
const PALETTE_BG: Record<number, string> = {
  1: 'bg-slate-800',
  2: 'bg-purple-800',
  3: 'bg-zinc-700',
};

/** Chấm tình trạng phòng — cùng quy ước màu với Sơ đồ phòng */
const HK_DOT: Record<string, string> = {
  'Phòng dơ': 'bg-red-500',
  'Phòng đang dọn': 'bg-blue-500',
  'Phòng sạch': 'bg-amber-400',
  'Đã kiểm tra': 'bg-emerald-500',
  'Phòng sửa chữa (OOO)': 'bg-slate-400',
};

type Filter = 'all' | 'todo' | 'done' | 'noted';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'todo', label: 'Chưa làm' },
  { key: 'done', label: 'Đã xong' },
  { key: 'noted', label: 'Có NOTED' },
];

/** Khi IN TASK: ép vừa ĐÚNG 1 trang A4 ngang — 4 cột tầng x 2 hàng, dòng phòng thu gọn,
 *  in đủ mọi phòng (bỏ qua bộ lọc / tìm kiếm / tầng đang thu gọn trên màn hình). */
const PRINT_CSS = `
@media print {
  .task-print-root { border: 0 !important; box-shadow: none !important; border-radius: 0 !important; font-size: 10px; }
  .task-print-root .tp-head { padding: 0 0 8px !important; border-bottom: 2px solid #1e293b !important; }
  .task-print-root .tp-title { font-size: 17px !important; padding: 0 !important; }
  .task-print-root .tp-collapsible, .task-print-root .tp-rows, .task-print-root .tp-floor { display: block !important; }
  .task-print-root .tp-grid { display: grid !important; grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 0 0 !important; }
  .task-print-root .tp-floor { border-radius: 6px !important; }
  .task-print-root .tp-fhead { padding: 5px 8px !important; font-size: 11.5px !important; }
  .task-print-root .tp-row { display: grid !important; min-height: 0 !important; height: 33px !important; grid-template-columns: 18px 40px 1fr auto !important; gap: 4px !important; padding: 0 5px !important; }
  .task-print-root .tp-row input[type="checkbox"] { width: 13px !important; height: 13px !important; }
  .task-print-root .tp-room { font-size: 12.5px !important; }
  .task-print-root .tp-note { font-size: 11px !important; padding: 0 2px !important; border-bottom: 1px dotted #cbd5e1 !important; }
  .task-print-root .tp-note::placeholder { color: transparent !important; }
  .task-print-root .tp-note:placeholder-shown { text-decoration: none !important; }
  .task-print-root .tp-tag { font-size: 7px !important; padding: 0 3px !important; }
  .task-print-root .tp-foot { padding: 6px 0 0 !important; font-size: 11px !important; }
  .task-print-root, .task-print-root * { break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

interface TaskChartCardProps {
  chart: TaskChart;
  cells: TaskChartCell[];
  search: string;
  /** Danh sách phòng thật — dùng cho chấm tình trạng phòng */
  rooms: Room[];
  onDelete: () => void;
  onUpdateMeta: (title: string, palette: number) => void;
  onUpdateCell: (maPhong: string, checked: boolean, note: string) => void;
}

/* ---------- 1 dòng phòng: ô tích + chấm tình trạng + số phòng + ghi chú + nhãn NOTED ---------- */
function RoomRow({
  chartId, maPhong, checked, note, dotCls, hidden, onToggle, onSaveNote,
}: {
  chartId: string; maPhong: string; checked: boolean; note: string; dotCls: string; hidden: boolean;
  onToggle: (v: boolean) => void; onSaveNote: (v: string) => void;
}) {
  const [draft, setDraft] = useState(note);
  const [focused, setFocused] = useState(false);
  // Đồng bộ ghi chú mới từ máy khác (mỗi 15s) — trừ khi đang gõ dở
  useEffect(() => { if (!focused) setDraft(note); }, [note, focused]);
  const hasNote = draft.trim().length > 0;
  const id = `task-${chartId}-${maPhong}`;

  return (
    <div
      className={`tp-row ${hidden ? 'hidden' : 'grid'} grid-cols-[30px_50px_1fr_auto] sm:grid-cols-[28px_46px_1fr_auto] items-center gap-1.5 pl-2 pr-2.5 min-h-[48px] sm:min-h-[40px] border-t border-slate-100 first:border-t-0 hover:bg-slate-50/80`}
    >
      <input
        id={`${id}-cb`}
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="w-5 h-5 sm:w-[18px] sm:h-[18px] mx-auto accent-emerald-600 cursor-pointer"
        aria-label={`Phòng ${maPhong}`}
      />
      <label htmlFor={`${id}-cb`} className="flex items-center gap-1.5 cursor-pointer select-none">
        <i className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls}`} />
        <span className={`tp-room font-extrabold text-[14.5px] sm:text-[13px] tabular-nums ${checked ? 'line-through text-slate-400' : 'text-slate-800'}`}>{maPhong}</span>
      </label>
      <input
        id={`${id}-note`}
        value={draft}
        onFocus={() => setFocused(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setFocused(false); if (draft !== note) onSaveNote(draft); }}
        placeholder="Ghi chú…"
        className={`tp-note min-w-0 w-full bg-transparent outline-none text-[14px] sm:text-[12.5px] px-1 py-2 border-b border-dashed border-transparent focus:border-blue-400 placeholder:text-slate-300 ${
          checked ? 'line-through text-slate-400' : 'text-slate-700'
        }`}
      />
      <span className={`tp-tag text-[9px] font-extrabold tracking-wider text-orange-600 bg-orange-50 border border-orange-200 rounded-md px-1.5 py-0.5 ${hasNote ? '' : 'opacity-0'}`}>
        NOTED
      </span>
    </div>
  );
}

export default function TaskChartCard({ chart, cells, search, rooms, onDelete, onUpdateMeta, onUpdateCell }: TaskChartCardProps) {
  const [titleDraft, setTitleDraft] = useState(chart.title);
  useEffect(() => setTitleDraft(chart.title), [chart.title]);
  const cardRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Trạng thái thu gọn (cả task + từng tầng) — nhớ riêng trên máy này
  const storeKey = `hk_task_collapse_${chart.id}`;
  const [open, setOpen] = useState(true);
  const [closedFloors, setClosedFloors] = useState<Record<number, boolean>>({});
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) || 'null');
      if (saved) { setOpen(saved.open !== false); setClosedFloors(saved.floors || {}); }
    } catch {}
  }, [storeKey]);
  const persist = (o: boolean, f: Record<number, boolean>) => {
    try { localStorage.setItem(storeKey, JSON.stringify({ open: o, floors: f })); } catch {}
  };
  const toggleOpen = () => { const o = !open; setOpen(o); persist(o, closedFloors); };
  const toggleFloor = (fi: number) => { const f = { ...closedFloors, [fi]: !closedFloors[fi] }; setClosedFloors(f); persist(open, f); };

  const cellMap: Record<string, TaskChartCell> = {};
  cells.forEach((c) => { cellMap[c.maPhong] = c; });
  const getCell = (maPhong: string) => cellMap[maPhong] || { chartId: chart.id, maPhong, checked: false, note: '' };

  const statusOf: Record<string, string> = {};
  rooms.forEach((r) => { statusOf[String(r.MaPhong)] = r.HkStatus; });

  const totalChecked = ALL_ROOMS.filter((r) => getCell(r).checked).length;
  const notedCount = ALL_ROOMS.filter((r) => getCell(r).note.trim()).length;
  const counts: Record<Filter, number> = { all: TOTAL_ROOMS, todo: TOTAL_ROOMS - totalChecked, done: totalChecked, noted: notedCount };
  const pct = Math.round((totalChecked / TOTAL_ROOMS) * 100);

  const q = search.trim().toLowerCase();
  // Khi đang in: hiện ĐỦ mọi phòng, bỏ qua bộ lọc / tìm kiếm
  const isVisible = (maPhong: string) => {
    if (printing) return true;
    const c = getCell(maPhong);
    const okFilter = filter === 'all' || (filter === 'todo' && !c.checked) || (filter === 'done' && c.checked) || (filter === 'noted' && !!c.note.trim());
    const okSearch = !q || maPhong.includes(q) || c.note.toLowerCase().includes(q);
    return okFilter && okSearch;
  };

  const floorBg = PALETTE_BG[chart.palette] || PALETTE_BG[1];

  const handlePrint = () => {
    setPrinting(true);
    document.body.classList.add('printing-chart-mode');
    cardRef.current?.classList.add('print-target');
    const styleTag = document.createElement('style');
    styleTag.id = 'print-orientation-landscape';
    styleTag.textContent = '@page { size: A4 landscape; margin: 8mm; }';
    document.head.appendChild(styleTag);
    const cleanup = () => {
      setPrinting(false);
      document.body.classList.remove('printing-chart-mode');
      cardRef.current?.classList.remove('print-target');
      document.getElementById('print-orientation-landscape')?.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    // Đợi React vẽ lại đủ mọi phòng rồi mới mở hộp thoại in
    setTimeout(() => window.print(), 80);
  };

  return (
    <div ref={cardRef} className="task-print-root bg-white rounded-2xl shadow-[0_10px_26px_-18px_rgba(23,32,51,0.45)] border border-slate-200 overflow-hidden">
      <style>{PRINT_CSS}</style>

      {/* ===== Đầu thẻ: thu gọn + tên task + tiến độ + màu + In / Xoá ===== */}
      <div className="tp-head flex flex-wrap items-center gap-x-3.5 gap-y-2.5 px-3 sm:px-4 py-3 border-b border-slate-200">
        <button
          type="button"
          onClick={toggleOpen}
          aria-label={open ? 'Thu gọn task' : 'Mở task'}
          className="no-print w-9 h-9 flex-shrink-0 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => { if (titleDraft !== chart.title) onUpdateMeta(titleDraft.trim() || 'Task mới', chart.palette); }}
          placeholder="Nhập tên task"
          className="tp-title flex-1 basis-[calc(100%-52px)] sm:basis-[220px] min-w-0 text-[17px] sm:text-[18px] font-extrabold text-slate-800 outline-none border-b-2 border-transparent focus:border-blue-400 px-0.5 py-1 bg-transparent"
        />
        <div className="flex items-center gap-2.5 basis-full sm:basis-[220px] sm:flex-none">
          <div className="flex-1 h-2 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
            <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <b className="text-[13px] tabular-nums whitespace-nowrap">{totalChecked}/{TOTAL_ROOMS}</b>
        </div>
        <div className="no-print flex items-center gap-2 flex-wrap basis-full sm:basis-auto">
          <div className="flex items-center gap-1.5 mr-0.5">
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                onClick={() => onUpdateMeta(chart.title, p)}
                className={`w-[22px] h-[22px] rounded-full ${PALETTE_BG[p]} ${chart.palette === p ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                title={`Bảng màu ${p}`}
                aria-label={`Bảng màu ${p}`}
              />
            ))}
          </div>
          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 text-[12px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3 min-h-[36px]"
          >
            <Printer className="w-3.5 h-3.5" /> IN TASK
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 text-[12px] font-extrabold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 min-h-[36px]"
          >
            <Trash2 className="w-3.5 h-3.5" /> XÓA TASK
          </button>
        </div>
      </div>

      {/* Xác nhận xoá ngay trong thẻ — tránh bấm nhầm */}
      {confirmDelete && (
        <div className="no-print flex flex-wrap items-center gap-2 px-4 py-2.5 bg-orange-50 border-b border-orange-200 text-[13px] font-semibold text-orange-800">
          Xoá bảng &quot;{chart.title}&quot;? Toàn bộ tích chọn và ghi chú sẽ mất, không thể hoàn tác.
          <span className="flex gap-2 ml-auto">
            <button onClick={() => { setConfirmDelete(false); onDelete(); }} className="rounded-lg px-3 py-1.5 bg-red-600 text-white font-extrabold text-[12px]">Xoá</button>
            <button onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1.5 bg-white border border-slate-200 text-slate-700 font-extrabold text-[12px]">Huỷ</button>
          </span>
        </div>
      )}

      <div className={`tp-collapsible ${open ? '' : 'hidden'}`}>
        {/* Bộ lọc nhanh */}
        <div className="no-print flex gap-1.5 px-3 sm:px-4 py-2.5 border-b border-slate-200 bg-slate-50 overflow-x-auto scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${
                filter === f.key ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              {f.label} <span className={`tabular-nums ${filter === f.key ? 'text-white' : 'text-slate-800'}`}>{counts[f.key]}</span>
            </button>
          ))}
        </div>

        {/* Lưới tầng — máy tính nhiều cột, điện thoại 1 cột; bản in luôn 4 cột x 2 hàng */}
        <div className="tp-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start gap-3 p-3 sm:p-4">
          {FLOORS.map((f, fi) => {
            const visibleRooms = f.rooms.filter(isVisible);
            const floorDone = f.rooms.filter((r) => getCell(r).checked).length;
            const hideFloor = (q || filter !== 'all') && visibleRooms.length === 0 && !printing;
            const closed = !!closedFloors[fi];
            return (
              <div key={f.name} className={`tp-floor ${hideFloor ? 'hidden' : ''} border border-slate-200 rounded-2xl overflow-hidden bg-white`}>
                <button
                  type="button"
                  onClick={() => toggleFloor(fi)}
                  className={`tp-fhead w-full flex items-center gap-2 px-3 py-2.5 text-white text-left ${floorBg}`}
                >
                  <ChevronDown className={`no-print w-4 h-4 opacity-80 transition-transform ${closed ? '-rotate-90' : ''}`} />
                  <span className="font-extrabold text-[13px] tracking-wide">{f.name}</span>
                  <span className="ml-auto text-[12px] font-bold opacity-90 tabular-nums">{floorDone}/{f.rooms.length}</span>
                </button>
                <div className="no-print h-[3px] bg-slate-200">
                  <div className="h-full bg-emerald-400 transition-all" style={{ width: `${(floorDone / f.rooms.length) * 100}%` }} />
                </div>
                <div className={`tp-rows ${closed && !printing ? 'hidden' : ''}`}>
                  {f.rooms.map((maPhong) => {
                    const cell = getCell(maPhong);
                    return (
                      <RoomRow
                        key={maPhong}
                        chartId={chart.id}
                        maPhong={maPhong}
                        checked={cell.checked}
                        note={cell.note}
                        dotCls={HK_DOT[statusOf[maPhong]] || 'bg-slate-300'}
                        hidden={!isVisible(maPhong)}
                        onToggle={(v) => onUpdateCell(maPhong, v, cell.note)}
                        onSaveNote={(v) => onUpdateCell(maPhong, cell.checked, v)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Chân thẻ */}
        <div className="tp-foot flex flex-wrap items-center justify-between gap-2 px-4 pb-3.5 text-[12.5px] text-slate-500">
          <span className="no-print">Bấm vào tên tầng để thu gọn / mở</span>
          <span className="font-bold text-slate-600">TOTAL: <span className="text-slate-900 tabular-nums">{totalChecked} / {TOTAL_ROOMS}</span></span>
        </div>
      </div>
    </div>
  );
}
