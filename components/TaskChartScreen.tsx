'use client';

import { useEffect, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import type { TaskChart, TaskChartCell } from '@/lib/types';
import { getTaskCharts, createTaskChart, deleteTaskChart, updateTaskChartMeta, updateTaskCell } from '@/lib/api';
import TaskChartCard from './TaskChartCard';

export default function TaskChartScreen() {
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
    if (!window.confirm('Xoá bảng Task này? Toàn bộ ghi chú/tích chọn trong bảng sẽ mất, không thể hoàn tác.')) return;
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
        <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white">
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
            className="text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white outline-none flex-1 sm:w-56"
          />
          <button
            onClick={handleAddChart}
            className="flex items-center gap-1.5 bg-emerald-600 text-white font-bold text-sm rounded-xl px-4 py-2.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> THÊM TASK MỚI
          </button>
        </div>
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
