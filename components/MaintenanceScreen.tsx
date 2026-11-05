'use client';

import { useEffect, useRef, useState } from 'react';
import { Wrench, Printer, Plus, CalendarClock, Trash2, Check, Clock, MoreHorizontal, Pencil, X } from 'lucide-react';
import type { MaintenanceIssue } from '@/lib/types';
import { getMaintenanceIssues, createMaintenanceIssue, updateMaintenanceIssue, deleteMaintenanceIssue } from '@/lib/api';

/** "dd/MM/yyyy" -> Date (00:00) */
function parseDMY(s: string): Date | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  // Dự phòng cho dữ liệu cũ (Sheets có thể đã tự đổi ngày thành dạng khác)
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}
function formatDMY(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
/** Hiện ngày gọn "DD/MM/YYYY" cho MỌI dạng dữ liệu */
function formatReportedDate(s: string): string {
  const d = parseDMY(s);
  return d ? formatDMY(d) : s;
}
function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** "yyyy-MM-dd" (ô chọn ngày) -> Date theo giờ địa phương */
function fromInputDate(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

type QuickFilter = 'today' | 'week' | 'month' | 'range';
const FILTERS: { key: QuickFilter; label: string; short?: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'week', label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
  { key: 'range', label: 'Tổng hợp khoảng ngày', short: 'Khoảng ngày' },
];

export default function MaintenanceScreen() {
  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<QuickFilter>('today');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  const [menuId, setMenuId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [schedulingId, setSchedulingId] = useState<number | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newRoom, setNewRoom] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newReporter, setNewReporter] = useState('');
  const [saving, setSaving] = useState(false);

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
        setLoadError(err?.message || 'Không tải được dữ liệu Maintenance.');
      });
  };
  useEffect(() => { refresh(); }, []);

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfWeek = new Date(todayStart);
  startOfWeek.setDate(todayStart.getDate() - ((todayStart.getDay() + 6) % 7)); // Thứ 2 đầu tuần

  const filteredIssues = issues.filter((it) => {
    const d = parseDMY(it.reportedDate);
    if (!d) return false;
    if (filter === 'today') return formatDMY(d) === formatDMY(today);
    if (filter === 'week') return d >= startOfWeek && d <= today;
    if (filter === 'month') return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    if (filter === 'range') {
      const from = fromInputDate(rangeFrom);
      const to = fromInputDate(rangeTo);
      if (!from || !to) return true;
      return d >= from && d <= to;
    }
    return true;
  });

  const total = filteredIssues.length;
  const done = filteredIssues.filter((i) => i.status === 'Đã xong').length;
  const pending = total - done;
  const scheduled = filteredIssues.filter((i) => i.status !== 'Đã xong' && i.dueDate).length;
  const donePct = total ? Math.round((done / total) * 100) : 0;

  const rangeLabel = filter === 'range' && fromInputDate(rangeFrom) && fromInputDate(rangeTo)
    ? `${formatDMY(fromInputDate(rangeFrom)!)} - ${formatDMY(fromInputDate(rangeTo)!)}`
    : '';
  const listTitle =
    filter === 'today' ? `Chi tiết ngày ${formatDMY(today)}`
    : filter === 'week' ? 'Chi tiết tuần này'
    : filter === 'month' ? `Chi tiết tháng ${today.getMonth() + 1}/${today.getFullYear()}`
    : rangeLabel ? `Chi tiết ${rangeLabel}` : 'Chi tiết khoảng ngày đã chọn';
  const reportTitle =
    filter === 'range' && rangeLabel ? `Báo cáo sửa chữa ${rangeLabel}`
    : filter === 'week' ? `Báo cáo sửa chữa tuần ${formatDMY(startOfWeek)} - ${formatDMY(today)}`
    : filter === 'month' ? `Báo cáo sửa chữa tháng ${today.getMonth() + 1}/${today.getFullYear()}`
    : `Báo cáo sửa chữa ngày ${formatDMY(today)}`;

  const pickFilter = (f: QuickFilter) => {
    setFilter(f);
    if (f === 'range' && !rangeFrom && !rangeTo) {
      const from = new Date(todayStart);
      from.setDate(from.getDate() - 6);
      setRangeFrom(toInputDate(from));
      setRangeTo(toInputDate(todayStart));
    }
  };

  const handleAdd = async () => {
    if (!newRoom.trim() || !newDesc.trim() || saving) return;
    setSaving(true);
    const res = await createMaintenanceIssue(newRoom.trim(), newDesc.trim(), newReporter.trim() || 'Chưa rõ');
    setSaving(false);
    if (res.success && res.issue) {
      setIssues((prev) => [res.issue!, ...prev]);
      setNewRoom(''); setNewDesc(''); setNewReporter(''); setShowAddForm(false);
    }
  };

  const toggleStatus = async (issue: MaintenanceIssue) => {
    const newStatus = issue.status === 'Đã xong' ? 'Đang xử lý' : 'Đã xong';
    setIssues((prev) => prev.map((i) => (i.id === issue.id ? { ...i, status: newStatus } : i)));
    await updateMaintenanceIssue(issue.id, { status: newStatus });
  };

  // Sửa trực tiếp — gõ ngay vào ô "Lỗi của phòng", lưu khi rời khỏi ô (onBlur)
  const handleDescriptionChange = (id: number, value: string) => {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, issueDescription: value } : i)));
  };
  const handleDescriptionBlur = async (id: number, value: string) => {
    await updateMaintenanceIssue(id, { issueDescription: value });
  };

  const openSchedule = (issue: MaintenanceIssue) => {
    const d = issue.dueDate ? parseDMY(issue.dueDate) : null;
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduleDraft(toInputDate(d || tomorrow));
    setSchedulingId(issue.id);
    setMenuId(null);
  };
  const confirmSchedule = async (id: number) => {
    const d = fromInputDate(scheduleDraft);
    const dueDate = d ? formatDMY(d) : '';
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
    setMenuId(null);
    setConfirmDeleteId(null);
    setIssues((prev) => prev.filter((i) => i.id !== id));
    await deleteMaintenanceIssue(id);
  };

  const handlePrint = () => {
    setMenuId(null);
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

  /* ---------- Các mảnh giao diện dùng chung cho bảng (laptop) và thẻ (điện thoại) ---------- */
  const StatusBadge = (issue: MaintenanceIssue) => {
    if (issue.status === 'Đã xong')
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Đã xong
        </span>
      );
    if (issue.dueDate)
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Hẹn lịch sửa · {formatReportedDate(issue.dueDate).slice(0, 5)}
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 text-orange-700 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> Đang xử lý
      </span>
    );
  };

  const DoneSwitch = (issue: MaintenanceIssue) => {
    const on = issue.status === 'Đã xong';
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => toggleStatus(issue)}
        title={on ? 'Mở lại sự cố' : 'Đánh dấu đã xong'}
        className={`relative inline-block w-[38px] h-[22px] rounded-full transition-colors flex-shrink-0 ${on ? 'bg-emerald-500' : 'bg-slate-200'}`}
      >
        <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
      </button>
    );
  };

  const DescInput = (issue: MaintenanceIssue, big?: boolean) => (
    <input
      value={issue.issueDescription}
      onChange={(e) => handleDescriptionChange(issue.id, e.target.value)}
      onBlur={(e) => handleDescriptionBlur(issue.id, e.target.value)}
      title="Bấm để sửa nội dung"
      className={`w-full border border-transparent hover:border-slate-200 focus:border-blue-300 rounded-lg px-2 py-1.5 -ml-2 bg-transparent focus:bg-white outline-none transition-colors font-semibold ${big ? 'text-[14px]' : 'text-[13.5px]'} ${
        issue.status === 'Đã xong' ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-800'
      }`}
    />
  );

  const ScheduleBox = (issue: MaintenanceIssue) =>
    schedulingId !== issue.id ? null : (
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <input
          type="date"
          value={scheduleDraft}
          onChange={(e) => setScheduleDraft(e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white"
        />
        <button onClick={() => confirmSchedule(issue.id)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-white bg-blue-600">
          Lưu hẹn
        </button>
        {issue.dueDate && (
          <button onClick={() => cancelSchedule(issue.id)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 border border-slate-200 bg-white">
            Bỏ hẹn
          </button>
        )}
        <button onClick={() => setSchedulingId(null)} className="text-xs text-slate-500 px-1">Đóng</button>
      </div>
    );

  const ActionMenu = (issue: MaintenanceIssue) => (
    <div className="relative inline-block">
      <button
        onClick={() => { setMenuId(menuId === issue.id ? null : issue.id); setConfirmDeleteId(null); }}
        aria-label="Thao tác"
        className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 bg-white"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {menuId === issue.id && (
        <div className="absolute right-0 top-full mt-1 z-30 w-48 rounded-xl bg-white border border-slate-200 shadow-xl p-1 text-left">
          <button onClick={() => openSchedule(issue)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <CalendarClock className="w-3.5 h-3.5 text-blue-600" /> {issue.dueDate ? 'Đổi lịch hẹn' : 'Hẹn lịch sửa'}
          </button>
          <button
            onClick={() => {
              setMenuId(null);
              setTimeout(() => {
                const all = Array.from(document.querySelectorAll<HTMLInputElement>(`[data-desc="${issue.id}"] input`));
                all.find((x) => x.offsetParent !== null)?.focus();
              }, 0);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="w-3.5 h-3.5 text-slate-500" /> Sửa nội dung
          </button>
          {confirmDeleteId === issue.id ? (
            <button onClick={() => handleDelete(issue.id)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-white bg-red-600">
              <Trash2 className="w-3.5 h-3.5" /> Bấm lần nữa để xoá
            </button>
          ) : (
            <button onClick={() => setConfirmDeleteId(issue.id)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" /> Xoá sự cố
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Lớp trong suốt: bấm ra ngoài để đóng menu Thao tác */}
      {menuId !== null && <div className="fixed inset-0 z-20" onClick={() => { setMenuId(null); setConfirmDeleteId(null); }} />}

      <div className="screen-only">
        {/* Tiêu đề */}
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="text-[10.5px] font-bold tracking-[0.14em] text-slate-400 uppercase">M Hotel Saigon · Kỹ thuật</div>
            <h1 className="text-[20px] font-extrabold tracking-tight flex items-center gap-2">
              <Wrench className="w-5 h-5 text-slate-500" /> Maintenance
            </h1>
          </div>
          <div className="text-xs text-slate-500 tabular-nums">Hôm nay {formatDMY(today)}</div>
        </div>

        {/* 3 thẻ tổng */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-4">
          <div className="rounded-2xl bg-white border border-blue-100 p-3 sm:p-4 shadow-[0_6px_18px_-12px_rgba(37,99,235,.5)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-extrabold tracking-[0.12em] text-blue-600">TỔNG</span>
              <span className="hidden sm:flex w-8 h-8 rounded-xl bg-blue-50 text-blue-600 items-center justify-center"><Wrench className="w-4 h-4" /></span>
            </div>
            <div className="text-[28px] sm:text-[34px] font-extrabold text-blue-700 leading-none mt-1.5 tabular-nums">{total}</div>
            <div className="text-[10.5px] sm:text-xs text-slate-500 mt-1">sự cố</div>
          </div>
          <div className="rounded-2xl bg-white border border-emerald-100 p-3 sm:p-4 shadow-[0_6px_18px_-12px_rgba(16,185,129,.5)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-extrabold tracking-[0.12em] text-emerald-600">XONG</span>
              <span className="hidden sm:flex w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 items-center justify-center"><Check className="w-4 h-4" strokeWidth={3} /></span>
            </div>
            <div className="text-[28px] sm:text-[34px] font-extrabold text-emerald-600 leading-none mt-1.5 tabular-nums">{done}</div>
            <div className="mt-2 h-1.5 rounded-full bg-emerald-50 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${donePct}%` }} />
            </div>
          </div>
          <div className="rounded-2xl bg-white border border-orange-100 p-3 sm:p-4 shadow-[0_6px_18px_-12px_rgba(249,115,22,.5)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-extrabold tracking-[0.12em] text-orange-600 whitespace-nowrap">ĐANG XỬ LÝ</span>
              <span className="hidden sm:flex w-8 h-8 rounded-xl bg-orange-50 text-orange-600 items-center justify-center"><Clock className="w-4 h-4" /></span>
            </div>
            <div className="text-[28px] sm:text-[34px] font-extrabold text-orange-600 leading-none mt-1.5 tabular-nums">{pending}</div>
            <div className="text-[10.5px] sm:text-xs text-slate-500 mt-1">{scheduled} hẹn lịch</div>
          </div>
        </div>

        {/* Thanh lọc + hành động */}
        <div className="rounded-2xl bg-white border border-slate-200/80 p-2.5 sm:p-3 mb-3 flex flex-col lg:flex-row lg:items-center gap-2.5">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 max-w-full overflow-x-auto">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => pickFilter(f.key)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${filter === f.key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {f.short ? (<><span className="sm:hidden">{f.short}</span><span className="hidden sm:inline">{f.label}</span></>) : f.label}
                </button>
              ))}
            </div>
            {filter === 'range' && (
              <div className="flex items-center gap-1.5">
                <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white" />
                <span className="text-slate-400 text-xs">→</span>
                <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            <button
              onClick={() => setShowAddForm((s) => !s)}
              className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-blue-600 to-sky-500 shadow-[0_6px_14px_-6px_rgba(37,99,235,.7)] active:scale-[.98] whitespace-nowrap"
            >
              {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} Thêm sự cố
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" /> In báo cáo ngày
            </button>
          </div>
        </div>

        {/* Form thêm sự cố */}
        {showAddForm && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
            className="rounded-2xl bg-blue-50/70 border border-blue-200 p-3 mb-3 grid grid-cols-2 sm:grid-cols-[110px_1fr_160px_auto] gap-2 items-end"
          >
            <label className="text-[11px] font-bold text-slate-600">
              Số phòng
              <input value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="VD 605" className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm bg-white font-normal" />
            </label>
            <label className="text-[11px] font-bold text-slate-600 col-span-2 sm:col-span-1 order-3 sm:order-none">
              Lỗi của phòng
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Mô tả lỗi..." className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm bg-white font-normal" />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              Người báo
              <input value={newReporter} onChange={(e) => setNewReporter(e.target.value)} placeholder="Tên" className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm bg-white font-normal" />
            </label>
            <div className="flex gap-2 col-span-2 sm:col-span-1 order-4 sm:order-none">
              <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 border border-slate-200 bg-white">Huỷ</button>
              <button type="submit" disabled={saving || !newRoom.trim() || !newDesc.trim()} className="flex-1 rounded-lg px-3 py-2 text-xs font-extrabold text-white bg-blue-600 disabled:opacity-50">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </form>
        )}

        <div className="flex items-center justify-between mb-2 px-1 gap-2">
          <div className="text-[13px] font-bold text-slate-700">{listTitle}</div>
          <div className="hidden sm:block text-[11px] text-slate-400">Bấm vào nội dung lỗi để sửa</div>
        </div>

        {loading || loadError ? (
          <div className="rounded-2xl bg-white border border-slate-200 text-sm text-slate-400 text-center py-10">
            {loadError ? (
              <div>
                <div className="text-red-500 font-semibold mb-2">⚠ {loadError}</div>
                <button onClick={refresh} className="text-[12px] font-bold text-white bg-slate-700 rounded-lg px-3 py-1.5">Thử lại</button>
              </div>
            ) : 'Đang tải...'}
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="rounded-2xl bg-white border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
            Không có sự cố nào trong khoảng thời gian này.
          </div>
        ) : (
          <>
            {/* LAPTOP: bảng */}
            <div className="hidden md:block rounded-2xl bg-white border border-slate-200/80 shadow-[0_10px_30px_-22px_rgba(15,23,42,.5)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-[10.5px] font-extrabold tracking-[0.1em] text-slate-500 uppercase border-b border-slate-200/80">
                    <th className="px-4 py-3 text-left w-[110px] rounded-tl-2xl">Số phòng</th>
                    <th className="px-3 py-3 text-left">Lỗi của phòng</th>
                    <th className="px-3 py-3 text-left w-[150px]">Thời gian</th>
                    <th className="px-3 py-3 text-center w-[170px]">Trạng thái</th>
                    <th className="px-3 py-3 text-center w-[70px]">Xong</th>
                    <th className="px-3 py-3 text-center w-[96px] whitespace-nowrap rounded-tr-2xl">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIssues.map((issue, ix) => {
                    const isDone = issue.status === 'Đã xong';
                    return (
                      <tr key={issue.id} className={`${ix ? 'border-t border-slate-100' : ''} ${isDone ? 'bg-slate-50/40' : ''} hover:bg-blue-50/30 align-top`}>
                        <td className="px-4 py-3">
                          <div className={`text-[17px] font-extrabold tabular-nums ${isDone ? 'text-slate-400' : 'text-slate-900'}`}>{issue.roomNo}</div>
                        </td>
                        <td className="px-3 py-2.5 min-w-[180px]" data-desc={issue.id}>
                          {DescInput(issue)}
                          {ScheduleBox(issue)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-[13px] font-bold text-slate-700 tabular-nums">{formatReportedDate(issue.reportedDate)}</div>
                          <div className="text-[11.5px] text-slate-500 mt-0.5">Báo: {issue.reportedBy}</div>
                        </td>
                        <td className="px-3 py-3 text-center">{StatusBadge(issue)}</td>
                        <td className="px-3 py-3 text-center">{DoneSwitch(issue)}</td>
                        <td className="px-3 py-2.5 text-center">{ActionMenu(issue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ĐIỆN THOẠI: thẻ */}
            <div className="md:hidden flex flex-col gap-2.5">
              {filteredIssues.map((issue) => {
                const isDone = issue.status === 'Đã xong';
                const tone = isDone ? 'border-l-emerald-500' : issue.dueDate ? 'border-l-blue-500' : 'border-l-orange-500';
                return (
                  <div key={issue.id} className={`relative rounded-2xl bg-white border border-slate-200/80 border-l-4 ${tone} p-3.5 shadow-[0_8px_20px_-16px_rgba(15,23,42,.6)]`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className={`text-[22px] font-extrabold tabular-nums leading-none ${isDone ? 'text-slate-400' : 'text-slate-900'}`}>{issue.roomNo}</span>
                        <span className="text-[11px] text-slate-400 tabular-nums">{formatReportedDate(issue.reportedDate)}</span>
                      </div>
                      {ActionMenu(issue)}
                    </div>
                    <div className="mt-1.5 pl-2" data-desc={issue.id}>
                      {DescInput(issue, true)}
                      {ScheduleBox(issue)}
                    </div>
                    <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        {StatusBadge(issue)}
                        <span className="text-[11px] text-slate-500">Báo: {issue.reportedBy}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 flex-shrink-0">
                        Xong {DoneSwitch(issue)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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
                <td className="border border-slate-300 px-2 py-1.5">
                  {issue.status === 'Đã xong' ? 'Đã xong' : issue.dueDate ? `Hẹn sửa ${formatReportedDate(issue.dueDate)}` : 'Đang xử lý'}
                </td>
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
