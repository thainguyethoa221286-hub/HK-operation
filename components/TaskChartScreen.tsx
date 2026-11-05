'use client';

import { useEffect, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import type { TaskChart, TaskChartCell, Room } from '@/lib/types';
import { getTaskCharts, createTaskChart, deleteTaskChart, updateTaskChartMeta, updateTaskCell } from '@/lib/api';
import TaskChartCard from './TaskChartCard';

export default function TaskChartScreen({ rooms = [] }: { rooms?: Room[] }) {
  const [charts, setCharts] = useState<TaskChart[]>([]);
  const [cells, setCells] = useState<TaskChartCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newTitle, setNewTitle] = useState('');

  const refresh = () => {
    getTaskCharts().then(({ charts, cells }) => {
      setCharts(charts);
      setCells(cells);
      setLoading(false);
    });
  };

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleAddChart = async () => {
    const title = newTitle.trim() || 'Task mới';
    setNewTitle('');
    const res = await createTaskChart(title);
    if (res.success && res.chart) {
      setCharts((prev) => [...prev, res.chart!]);
    }
  };

  const handleDeleteChart = async (chartId: string) => {
    // Bước xác nhận đã nằm NGAY TRONG thẻ Task (TaskChartCard) — tới đây là đã xác nhận xoá
    setCharts((prev) => prev.filter((c) => c.id !== chartId));
    setCells((prev) => prev.filter((c) => c.chartId !== chartId));
    await deleteTaskChart(chartId);
  };

  const handleUpdateMeta = async (chartId: string, title: string, palette: number) => {
    setCharts((prev) => prev.map((c) => (c.id === chartId ? { ...c, title, palette: palette as 1 | 2 | 3 } : c)));
    await updateTaskChartMeta(chartId, title, palette);
  };

  const handleUpdateCell = async (chartId: string, maPhong: string, checked: boolean, note: string) => {
    setCells((prev) => {
      const idx = prev.findIndex((c) => c.chartId === chartId && c.maPhong === maPhong);
      if (idx === -1) return [...prev, { chartId, maPhong, checked, note }];
      const next = [...prev];
      next[idx] = { chartId, maPhong, checked, note };
      return next;
    });
    await updateTaskCell(chartId, maPhong, checked, note);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[19px] font-bold">Task / Nhiệm vụ</h1>
      </div>

      {/* Hàng thêm task & tìm kiếm */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-5">
        <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-xl px-3.5 min-h-[44px] bg-white">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by room..."
            className="flex-1 text-sm outline-none bg-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Tên task mới..."
            className="text-sm border border-slate-200 rounded-xl px-3.5 min-h-[44px] bg-white outline-none flex-1 min-w-0 sm:w-60"
          />
          <button
            onClick={handleAddChart}
            className="flex items-center gap-1.5 bg-emerald-600 text-white font-extrabold text-[13px] rounded-xl px-4 min-h-[44px] whitespace-nowrap shadow-[0_6px_14px_-8px_rgba(5,150,105,0.8)]"
          >
            <Plus className="w-4 h-4" /> THÊM TASK MỚI
          </button>
        </div>
      </div>

      {/* Chú thích chấm tình trạng phòng + nhãn NOTED */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[12px] text-slate-500 -mt-2 mb-4">
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-red-500" />Phòng dơ</span>
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-blue-500" />Đang dọn</span>
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-amber-400" />Phòng sạch</span>
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-emerald-500" />Đã kiểm tra</span>
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-slate-400" />OOO</span>
        <span className="flex items-center gap-1.5"><b className="text-[9px] font-extrabold tracking-wider text-orange-600 bg-orange-50 border border-orange-200 rounded-md px-1.5 py-0.5">NOTED</b>Có ghi chú</span>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 text-center py-10">Đang tải...</div>
      ) : charts.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-10">Chưa có bảng Task nào — bấm "THÊM TASK MỚI" để tạo bảng đầu tiên.</div>
      ) : (
        <div className="space-y-5">
          {charts.map((chart) => (
            <TaskChartCard
              key={chart.id}
              chart={chart}
              cells={cells.filter((c) => c.chartId === chart.id)}
              search={search}
              rooms={rooms}
              onDelete={() => handleDeleteChart(chart.id)}
              onUpdateMeta={(title, palette) => handleUpdateMeta(chart.id, title, palette)}
              onUpdateCell={(maPhong, checked, note) => handleUpdateCell(chart.id, maPhong, checked, note)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
