'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, Plus, Printer, Search, Edit3, Trash2, X } from 'lucide-react';
import type { LostFoundItem } from '@/lib/types';
import { getLostFoundItems, createLostFoundItem, updateLostFoundItem, deleteLostFoundItem } from '@/lib/api';

type StatusFilter = 'all' | 'Lưu kho' | 'Đã trả';

const emptyForm = { dateFound: '', roomNo: '', itemDescription: '', foundBy: '', status: 'Lưu kho', notes: '' };

/** dd/MM/yyyy -> yyyy-MM-dd (cho input type=date) và ngược lại */
function toInputDate(s: string): string {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
function fromInputDate(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
function todayDMY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function LostFoundScreen() {
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const refresh = () => {
    setLoadError('');
    getLostFoundItems()
      .then((data) => { setItems(data); setLoading(false); })
      .catch((err) => {
        setLoading(false);
        setLoadError(err?.message || 'Không tải được dữ liệu Lost & Found — kiểm tra Code.gs đã Deploy phiên bản mới chưa.');
      });
  };
  useEffect(() => { refresh(); }, []);

  const q = search.trim().toLowerCase();
  const filteredItems = items.filter((it) => {
    if (statusFilter !== 'all' && it.status !== statusFilter) return false;
    if (!q) return true;
    return (
      it.dateFound.toLowerCase().includes(q) ||
      it.roomNo.toLowerCase().includes(q) ||
      it.itemDescription.toLowerCase().includes(q) ||
      it.foundBy.toLowerCase().includes(q)
    );
  });

  const total = items.length;
  const inStock = items.filter((i) => i.status === 'Lưu kho').length;
  const returned = items.filter((i) => i.status === 'Đã trả').length;

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, dateFound: todayDMY() });
    setShowModal(true);
  };
  const openEdit = (it: LostFoundItem) => {
    setEditingId(it.id);
    setForm({ dateFound: it.dateFound, roomNo: it.roomNo, itemDescription: it.itemDescription, foundBy: it.foundBy, status: it.status, notes: it.notes });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.itemDescription.trim()) { alert('Vui lòng nhập tên mặt hàng'); return; }
    if (editingId) {
      setItems((prev) => prev.map((i) => (i.id === editingId ? { ...i, ...form, status: form.status as any } : i)));
      await updateLostFoundItem(editingId, form);
    } else {
      const res = await createLostFoundItem(form);
      if (res.success && res.item) setItems((prev) => [...prev, res.item!]);
    }
    setShowModal(false);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Xoá bản ghi đồ thất lạc này? Không thể hoàn tác.')) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    await deleteLostFoundItem(id);
  };

  const handlePrint = () => {
    document.body.classList.add('printing-chart-mode');
    document.getElementById('lf-print-target')?.classList.add('print-target');
    const cleanup = () => {
      document.body.classList.remove('printing-chart-mode');
      document.getElementById('lf-print-target')?.classList.remove('print-target');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  return (
    <div>
      <h1 className="text-[19px] font-bold mb-4 flex items-center gap-2">
        <ShoppingBag className="w-5 h-5 text-slate-500" /> Đồ thất lạc &amp; tìm thấy
      </h1>

      {/* 3 thẻ thống kê */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Tổng đồ mất</div>
          <div className="text-2xl font-extrabold text-slate-800">{total}</div>
        </div>
        <div className="bg-white rounded-2xl border border-amber-300 shadow-sm p-3.5">
          <div className="text-[10px] font-bold text-amber-500 uppercase">Lưu kho</div>
          <div className="text-2xl font-extrabold text-amber-600">{inStock}</div>
        </div>
        <div className="bg-white rounded-2xl border border-emerald-300 shadow-sm p-3.5">
          <div className="text-[10px] font-bold text-emerald-500 uppercase">Đã trả</div>
          <div className="text-2xl font-extrabold text-emerald-600">{returned}</div>
        </div>
      </div>

      {/* Thanh hành động & filter — ẨN KHI IN */}
      <div className="no-print flex flex-col sm:flex-row gap-2.5 mb-3">
        <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm ngày, phòng, tên mục, người tìm..."
            className="flex-1 text-sm outline-none bg-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openAdd} className="flex items-center gap-1.5 bg-blue-600 text-white font-bold text-sm rounded-xl px-4 py-2.5 whitespace-nowrap">
            <Plus className="w-4 h-4" /> Thêm mới
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 bg-slate-800 text-white font-bold text-sm rounded-xl px-4 py-2.5 whitespace-nowrap">
            <Printer className="w-4 h-4" /> Báo cáo L&amp;F
          </button>
        </div>
      </div>
      <div className="no-print flex items-center gap-2 mb-4">
        {(['all', 'Lưu kho', 'Đã trả'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-[12px] font-bold rounded-lg px-3 py-1.5 border ${
              statusFilter === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            {s === 'all' ? 'Tất cả' : s}
          </button>
        ))}
      </div>

      {/* Bảng danh sách — ẨN KHI IN */}
      <div className="screen-only bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="text-sm text-slate-400 text-center py-10">
            {loadError ? (
              <div>
                <div className="text-red-500 font-semibold mb-2">⚠ {loadError}</div>
                <button onClick={refresh} className="text-[12px] font-bold text-white bg-slate-700 rounded-lg px-3 py-1.5">Thử lại</button>
              </div>
            ) : 'Đang tải...'}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-10">Không có đồ thất lạc nào khớp bộ lọc.</div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase whitespace-nowrap">
                <th className="px-3 py-2.5 text-left">Ngày ghi</th>
                <th className="px-2 py-2.5 text-left">Phòng</th>
                <th className="px-2 py-2.5 text-left">Tên mục để quên</th>
                <th className="px-2 py-2.5 text-left">Người tìm thấy</th>
                <th className="px-2 py-2.5 text-center">Trạng thái</th>
                <th className="px-2 py-2.5 text-left">Ghi chú</th>
                <th className="px-2 py-2.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it) => (
                <tr key={it.id} className="border-t border-slate-100">
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 font-semibold">{it.dateFound}</td>
                  <td className="px-2 py-2.5 font-bold text-blue-600 whitespace-nowrap">{it.roomNo || 'Không có'}</td>
                  <td className="px-2 py-2.5 text-slate-700 min-w-[200px]">{it.itemDescription}</td>
                  <td className="px-2 py-2.5 text-slate-600 whitespace-nowrap">{it.foundBy}</td>
                  <td className="px-2 py-2.5 text-center">
                    <span className={`inline-block font-bold px-2.5 py-1 rounded-full text-[10px] border ${
                      it.status === 'Đã trả' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-amber-500 text-amber-600 bg-amber-50'
                    }`}>
                      {it.status}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-slate-400">{it.notes || '-'}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => openEdit(it)} className="text-blue-600 bg-blue-50 rounded-lg p-1.5"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(it.id)} className="text-red-600 bg-red-50 rounded-lg p-1.5"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bảng in báo cáo — CHỈ hiện khi in */}
      <div id="lf-print-target" className="print-only">
        <h2 className="text-lg font-bold text-slate-800 text-center mb-1">BÁO CÁO ĐỒ THẤT LẠC &amp; TÌM THẤY</h2>
        <div className="text-[12px] text-slate-500 text-center mb-3">
          Tổng: {total} | Lưu kho: {inStock} | Đã trả: {returned}
        </div>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-1.5 text-left">Ngày ghi</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Phòng</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Tên mục để quên</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Người tìm thấy</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Trạng thái</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((it) => (
              <tr key={it.id}>
                <td className="border border-slate-300 px-2 py-1.5">{it.dateFound}</td>
                <td className="border border-slate-300 px-2 py-1.5 font-bold">{it.roomNo || 'Không có'}</td>
                <td className="border border-slate-300 px-2 py-1.5">{it.itemDescription}</td>
                <td className="border border-slate-300 px-2 py-1.5">{it.foundBy}</td>
                <td className="border border-slate-300 px-2 py-1.5">{it.status}</td>
                <td className="border border-slate-300 px-2 py-1.5">{it.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Thêm mới / Chỉnh sửa */}
      {showModal && (
        <div className="fixed inset-0 bg-black/45 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-[420px] rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-[16px] font-bold">Chỉnh sửa dòng Lost &amp; Found</h4>
              <X className="w-[18px] h-[18px] text-slate-500 cursor-pointer" onClick={() => setShowModal(false)} />
            </div>

            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ngày tìm thấy</label>
            <input
              type="date"
              value={toInputDate(form.dateFound)}
              onChange={(e) => setForm({ ...form, dateFound: fromInputDate(e.target.value) })}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm mb-3"
            />

            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phòng</label>
            <input
              value={form.roomNo}
              onChange={(e) => setForm({ ...form, roomNo: e.target.value })}
              placeholder="VD: 888 hoặc Ko có"
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm mb-3"
            />

            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nhân viên tìm thấy</label>
            <input
              value={form.foundBy}
              onChange={(e) => setForm({ ...form, foundBy: e.target.value })}
              placeholder="Tên nhân viên"
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm mb-3"
            />

            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tên mặt hàng</label>
            <textarea
              value={form.itemDescription}
              onChange={(e) => setForm({ ...form, itemDescription: e.target.value })}
              placeholder="Mô tả đồ để quên..."
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm mb-3"
            />

            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trạng thái</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm mb-3 bg-slate-50"
            >
              <option value="Lưu kho">Lưu kho</option>
              <option value="Đã trả">Đã trả</option>
            </select>

            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ghi chú</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ghi chú thêm nếu có..."
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm mb-4"
            />

            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-3 text-[13px] font-bold">
                Huỷ
              </button>
              <button onClick={handleSave} className="flex-1 bg-orange-500 text-white rounded-xl py-3 text-[13px] font-bold">
                Cập nhật
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
