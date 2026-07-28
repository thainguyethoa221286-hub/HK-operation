'use client';

import { useEffect, useRef, useState, Fragment } from 'react';
import { Wrench, Printer, Plus, Edit3, CalendarClock, Trash2, ChevronDown } from 'lucide-react';
import type { MaintenanceIssue } from '@/lib/types';
import { getMaintenanceIssues, createMaintenanceIssue, updateMaintenanceIssue, deleteMaintenanceIssue } from '@/lib/api';

/** "dd/MM/yyyy" -> Date (00:00) */
function parseDMY(s: string): Date | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  // Dự phòng cho dữ liệu cũ (trước khi Code.gs ép Plain text) — Sheets có thể đã tự đổi ngày
  // thành dạng khác (VD "Tue Jul 28 2026...") khiến không khớp regex trên, thử parse trực tiếp.
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}
function formatDMY(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
/** Hiện ngày gọn "DD/MM/YYYY" cho MỌI dạng dữ liệu — kể cả dòng cũ bị Sheets tự đổi thành chuỗi
 *  Date dài dòng (VD "Tue Jul 28 2026 00:00:00 GMT+0700..."). Không có dữ liệu giờ phút thật nên
 *  chỉ hiện ngày, không hiện HH:mm. */
function formatReportedDate(s: string): string {
  const d = parseDMY(s);
  return d ? formatDMY(d) : s;
}
function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type QuickFilter = 'today' | 'week' | 'month' | 'range';

export default function MaintenanceScreen() {
  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<QuickFilter>('today');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [showRangePicker, setShowRangePicker] = useState(false);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [schedulingId, setSchedulingId] = useState<number | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newRoom, setNewRoom] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newReporter, setNewReporter] = useState('');

  const printRef = useRef<HTMLDivElement>(null);

  const [loadError, setLoadError] = useState('');
  const refresh = () => {
    setLoadError('');
    getMaintenanceIssues()
      .then((data) => {
        setIssues(data);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        setLoadError(err?.message || 'Không tải được dữ liệu Maintenance — kiểm tra lại Code.gs đã Deploy phiên bản mới chưa.');
      });
  };
  useEffect(() => { refresh(); }, []);

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Thứ 2 đầu tuần

  const filteredIssues = issues.filter((it) => {
    const d = parseDMY(it.reportedDate);
    if (!d) return false;
    if (filter === 'today') return formatDMY(d) === formatDMY(today);
    if (filter === 'week') return d >= startOfWeek && d <= today;
    if (filter === 'month') return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    if (filter === 'range') {
      if (!rangeFrom || !rangeTo) return true;
      const from = new Date(rangeFrom);
      const to = new Date(rangeTo);
      return d >= from && d <= to;
    }
    return true;
  });

  const total = filteredIssues.length;
  const done = filteredIssues.filter((i) => i.status === 'Đã xong').length;
  const pending = total - done;

  const reportTitle = filter === 'range' && rangeFrom && rangeTo
    ? `Báo cáo sửa chữa ${formatDMY(new Date(rangeFrom))} - ${formatDMY(new Date(rangeTo))}`
    : `Báo cáo sửa chữa ngày ${formatDMY(today)}`;

  const handleAdd = async () => {
    if (!newRoom.trim() || !newDesc.trim()) return;
    const res = await createMaintenanceIssue(newRoom.trim(), newDesc.trim(), newReporter.trim() || 'Chưa rõ');
    if (res.success && res.issue) {
      setIssues((prev) => [...prev, res.issue!]);
      setNewRoom(''); setNewDesc(''); setNewReporter(''); setShowAddForm(false);
    }
  };

  const toggleStatus = async (issue: MaintenanceIssue) => {
    const newStatus = issue.status === 'Đã xong' ? 'Đang xử lý' : 'Đã xong';
    setIssues((prev) => prev.map((i) => (i.id === issue.id ? { ...i, status: newStatus } : i)));
    await updateMaintenanceIssue(issue.id, { status: newStatus });
  };

  const saveEdit = async (id: number) => {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, issueDescription: editDraft } : i)));
    setEditingId(null);
    await updateMaintenanceIssue(id, { issueDescription: editDraft });
  };

  const confirmSchedule = async (id: number) => {
    const dueDate = scheduleDraft ? formatDMY(new Date(scheduleDraft)) : '';
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, dueDate } : i)));
    setSchedulingId(null);
    await updateMaintenanceIssue(id, { dueDate });
  };
  const cancelSchedule = async (id: number) => {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, dueDate: '' } : i)));
    setSchedulingId(null);
    await updateMaintenanceIssue(id, { dueDate: '' });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Xoá ghi nhận sửa chữa này? Không thể hoàn tác.')) return;
    setIssues((prev) => prev.filter((i) => i.id !== id));
    await deleteMaintenanceIssue(id);
  };

  const handlePrint = () => {
    document.body.classList.add('printing-chart-mode');
    printRef.current?.classList.add('print-target');
    const cleanup = () => {
      document.body.classList.remove('printing-chart-mode');
      printRef.current?.classList.remove('print-target');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  return (
    <div>
      <h1 className="text-[19px] font-bold mb-4 flex items-center gap-2">
        <Wrench className="w-5 h-5 text-slate-500" /> Maintenance
      </h1>

      {/* 3 thẻ thống kê */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Tổng</div>
          <div className="text-2xl font-extrabold text-slate-800">{total}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5">
          <div className="text-[10px] font-bold text-emerald-500 uppercase">Xong</div>
          <div className="text-2xl font-extrabold text-emerald-600">{done}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5">
          <div className="text-[10px] font-bold text-amber-500 uppercase">Đang xử lý</div>
          <div className="text-2xl font-extrabold text-amber-600">{pending}</div>
        </div>
      </div>

      {/* Bộ lọc thời gian */}
      <div className="no-print flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="relative flex-1">
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value as QuickFilter); setShowRangePicker(false); }}
            className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            <option value="today">📅 Hôm nay</option>
            <option value="week">Tuần này</option>
            <option value="month">Tháng này</option>
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <button
          onClick={() => { setFilter('range'); setShowRangePicker((s) => !s); }}
          className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700"
        >
          Tổng hợp khoảng ngày
        </button>
      </div>
      {showRangePicker && (
        <div className="no-print flex items-center gap-2 mb-4 bg-white border border-slate-200 rounded-xl p-3">
          <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
          <span className="text-slate-400 text-sm">đến</span>
          <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
        </div>
      )}

      {/* Tiêu đề danh sách + In + Thêm mới */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-[15px] font-bold text-slate-800">
          Chi tiết {filter === 'range' ? 'khoảng ngày đã chọn' : `ngày ${formatDMY(today)}`}
        </h2>
        <div className="no-print flex items-center gap-2">
          <button onClick={() => setShowAddForm((s) => !s)} className="flex items-center gap-1 text-[12px] font-bold text-white bg-emerald-600 rounded-lg px-3 py-1.5">
            <Plus className="w-3.5 h-3.5" /> Thêm sự cố
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1 text-[13px] font-bold text-purple-700">
            <Printer className="w-4 h-4" /> In báo cáo ngày
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="no-print bg-white border border-slate-200 rounded-xl p-3.5 mb-4 space-y-2">
          <div className="flex gap-2">
            <input value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="Số phòng" className="w-24 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" />
            <input value={newReporter} onChange={(e) => setNewReporter(e.target.value)} placeholder="Người báo" className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" />
          </div>
          <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Nội dung sự cố..." rows={2} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" />
          <button onClick={handleAdd} className="bg-emerald-600 text-white text-sm font-bold rounded-lg px-4 py-2">Lưu sự cố</button>
        </div>
      )}

      {/* Bảng danh sách sự cố — ẨN KHI IN */}
      <div className="screen-only bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="text-sm text-slate-400 text-center py-10">
            {loadError ? (
              <div>
                <div className="text-red-500 font-semibold mb-2">⚠ {loadError}</div>
                <button onClick={refresh} className="text-[12px] font-bold text-white bg-slate-700 rounded-lg px-3 py-1.5">Thử lại</button>
              </div>
            ) : 'Đang tải...'}
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-10">Không có sự cố nào trong khoảng thời gian này.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase whitespace-nowrap">
                <th className="px-3 py-2.5 text-left">Số phòng</th>
                <th className="px-2 py-2.5 text-left">Lỗi của phòng</th>
                <th className="px-2 py-2.5 text-left">Thời gian</th>
                <th className="px-2 py-2.5 text-center">Trạng thái</th>
                <th className="px-2 py-2.5 text-center">Xong</th>
                <th className="px-2 py-2.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.map((issue) => {
                const isDone = issue.status === 'Đã xong';
                const rowExpanded = expandedId === issue.id || editingId === issue.id || schedulingId === issue.id;
                return (
                  <Fragment key={issue.id}>
                    <tr className="border-t border-slate-200 align-top">
                      <td className="px-3 py-2.5 font-extrabold text-slate-800 whitespace-nowrap">{issue.roomNo}</td>
                      <td className="px-2 py-2.5 text-slate-700 min-w-[160px]">{issue.issueDescription}</td>
                      <td className="px-2 py-2.5 text-slate-500 whitespace-nowrap">
                        <div>{formatReportedDate(issue.reportedDate)}</div>
                        <div className="text-[10px] text-slate-400">👤 {issue.reportedBy}</div>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={`inline-block text-[10px] font-bold rounded-full px-2.5 py-1 whitespace-nowrap ${
                          isDone ? 'bg-emerald-100 text-emerald-700' : issue.dueDate ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {isDone ? 'Đã xong' : issue.dueDate ? 'Hẹn lịch sửa' : 'Đang xử lý'}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          onClick={() => toggleStatus(issue)}
                          className={`text-[11px] font-bold rounded-lg px-2.5 py-1.5 border whitespace-nowrap ${isDone ? 'text-slate-500 border-slate-200 bg-white' : 'text-emerald-700 border-emerald-200 bg-emerald-50'}`}
                        >
                          {isDone ? 'Mở lại' : 'Xong'}
                        </button>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)} className="text-slate-400 font-bold px-2 hover:text-slate-700">•••</button>
                      </td>
                    </tr>

                    {rowExpanded && (
                      <tr className="bg-slate-50/60 border-t border-slate-100">
                        <td colSpan={6} className="px-3 py-3">
                          {expandedId === issue.id && editingId !== issue.id && schedulingId !== issue.id && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setEditingId(issue.id); setEditDraft(issue.issueDescription); }}
                                className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-bold text-blue-700 bg-white border border-slate-200 rounded-lg py-2"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Sửa
                              </button>
                              <button
                                onClick={() => { setSchedulingId(issue.id); setScheduleDraft(''); }}
                                className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-bold text-orange-600 bg-white border border-slate-200 rounded-lg py-2"
                              >
                                <CalendarClock className="w-3.5 h-3.5" /> Hẹn
                              </button>
                              <button
                                onClick={() => handleDelete(issue.id)}
                                className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-bold text-red-600 bg-white border border-red-200 rounded-lg py-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Xóa
                              </button>
                            </div>
                          )}

                          {editingId === issue.id && (
                            <div>
                              <textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] bg-white" />
                              <div className="flex gap-2 mt-1.5">
                                <button onClick={() => saveEdit(issue.id)} className="text-[12px] font-bold text-white bg-blue-600 rounded-lg px-3 py-1.5">Lưu</button>
                                <button onClick={() => setEditingId(null)} className="text-[12px] font-bold text-slate-500 bg-slate-100 rounded-lg px-3 py-1.5">Huỷ</button>
                              </div>
                            </div>
                          )}

                          {schedulingId === issue.id && (
                            <div>
                              <div className="text-[11px] font-bold text-slate-500 uppercase mb-1.5">Chọn ngày hẹn</div>
                              <input type="date" value={scheduleDraft} onChange={(e) => setScheduleDraft(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm mb-2 bg-white" />
                              <div className="flex gap-2">
                                <button onClick={() => confirmSchedule(issue.id)} className="flex-1 text-[12px] font-bold text-white bg-orange-500 rounded-lg py-2">XÁC NHẬN</button>
                                <button onClick={() => cancelSchedule(issue.id)} className="flex-1 text-[12px] font-bold text-slate-600 bg-slate-200 rounded-lg py-2">BỎ HẸN</button>
                              </div>
                            </div>
                          )}

                          {issue.dueDate && !schedulingId && (
                            <div className="text-[11px] text-blue-600 font-semibold mt-1">📅 Hẹn: {formatReportedDate(issue.dueDate)}</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bảng in báo cáo — CHỈ hiện khi in, khổ dọc A4 chuẩn */}
      <div ref={printRef} className="print-only">
        <h2 className="text-lg font-bold text-blue-700 text-center mb-1">{reportTitle}</h2>
        <div className="text-[12px] text-slate-500 text-center mb-3">
          Tổng số: {total} | Đã xong: {done} | Đang xử lý: {pending}
        </div>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-1.5 text-left">Phòng</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Nội dung sửa chữa</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Người báo</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Ngày</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {filteredIssues.map((issue) => (
              <tr key={issue.id}>
                <td className="border border-slate-300 px-2 py-1.5 font-bold">{issue.roomNo}</td>
                <td className="border border-slate-300 px-2 py-1.5">{issue.issueDescription}</td>
                <td className="border border-slate-300 px-2 py-1.5">{issue.reportedBy}</td>
                <td className="border border-slate-300 px-2 py-1.5">{formatReportedDate(issue.reportedDate)}</td>
                <td className="border border-slate-300 px-2 py-1.5">{issue.status}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-3 gap-4 mt-16 text-center text-[12px]">
          <div>
            <div className="font-bold mb-8">Người lập biểu</div>
            <div className="text-slate-400">(Ký và ghi rõ họ tên)</div>
          </div>
          <div>
            <div className="font-bold mb-8">Quản lý</div>
            <div className="text-slate-400">(Ký và ghi rõ họ tên)</div>
          </div>
          <div>
            <div className="font-bold mb-8">Kĩ thuật</div>
            <div className="text-slate-400">(Ký và ghi rõ họ tên)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
