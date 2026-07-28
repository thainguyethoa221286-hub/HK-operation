'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, RefreshCw, Trash2 } from 'lucide-react';
import type { Room, WatchlistRoom, OverdueHistoryRow, SupplyBoardItem } from '@/lib/types';
import { SUPPLY_LABELS } from '@/lib/types';
import {
  getWatchlistRooms, addWatchlistRoom, updateWatchlistNote, deleteWatchlistRoom,
  getOverdueHistory, deleteOverdueHistoryRow, clearOverdueHistory,
  getSuppliesBoard, updateSupplyItem,
} from '@/lib/api';
import { stripCodesFromNote } from '@/lib/roomStyles';

interface NoteBoardScreenProps {
  rooms: Room[];
}

const CATEGORY_LABEL: Record<string, { label: string; cls: string }> = {
  ThayGiuong: { label: 'Thay giường', cls: 'bg-blue-100 text-blue-700' },
  DND: { label: 'DND', cls: 'bg-red-100 text-red-700' },
  RF: { label: 'RF', cls: 'bg-purple-100 text-purple-700' },
};

export default function NoteBoardScreen({ rooms }: NoteBoardScreenProps) {
  const [watchlist, setWatchlist] = useState<WatchlistRoom[]>([]);
  const [overdue, setOverdue] = useState<OverdueHistoryRow[]>([]);
  const [supplies, setSupplies] = useState<SupplyBoardItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshAll = () => {
    Promise.all([getWatchlistRooms(), getOverdueHistory(), getSuppliesBoard()])
      .then(([w, o, s]) => { setWatchlist(w); setOverdue(o); setSupplies(s); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { refreshAll(); }, []);

  // ===== Bảng 1 — Thông tin phòng theo dõi =====
  const staffNoteFor = (r: Room) => stripCodesFromNote(r.GhiChuNV) || stripCodesFromNote(r.GhiChuNVHomQua);
  const adminNoteFor = (r: Room) => r.GhiChuAdmin || r.GhiChuAdminHomQua;

  const handleSyncFromReport = async () => {
    const entries: { roomNo: string; note: string }[] = [];
    rooms.forEach((r) => {
      const sNote = staffNoteFor(r);
      const aNote = adminNoteFor(r);
      if (sNote) entries.push({ roomNo: r.MaPhong, note: `NV: ${sNote}` });
      if (aNote) entries.push({ roomNo: r.MaPhong, note: `QL: ${aNote}` });
    });
    if (entries.length === 0) { alert('Không có ghi chú nào trong Báo cáo để đồng bộ.'); return; }
    for (const e of entries) {
      const res = await addWatchlistRoom(e.roomNo, e.note);
      if (res.success && res.row) setWatchlist((prev) => [...prev, res.row!]);
    }
  };

  const handleUpdateExtra = async (id: number, extraNote: string) => {
    setWatchlist((prev) => prev.map((w) => (w.id === id ? { ...w, extraNote } : w)));
    await updateWatchlistNote(id, extraNote);
  };
  const handleDeleteWatch = async (id: number) => {
    setWatchlist((prev) => prev.filter((w) => w.id !== id));
    await deleteWatchlistRoom(id);
  };

  // ===== Bảng 2 — Lịch thay giường & Special =====
  const handleDeleteOverdue = async (id: number) => {
    setOverdue((prev) => prev.filter((o) => o.id !== id));
    await deleteOverdueHistoryRow(id);
  };
  const handleClearOverdue = async () => {
    if (!window.confirm('Xoá TOÀN BỘ lịch sử thay giường/DND/RF? Không thể hoàn tác.')) return;
    setOverdue([]);
    await clearOverdueHistory();
  };
  const overdueByCategory = (cat: string) => overdue.filter((o) => o.category === cat);

  // ===== Bảng 3 — Dụng cụ & vật tư đặc biệt =====
  const handleSupplyChange = (label: string, value: string) => {
    setSupplies((prev) => prev.map((s) => (s.label === label ? { ...s, value } : s)));
  };
  const handleSupplyBlur = async (label: string, value: string) => {
    await updateSupplyItem(label, value);
  };

  if (loading) {
    return <div className="text-sm text-slate-400 text-center py-10">Đang tải...</div>;
  }

  return (
    <div>
      <h1 className="text-[19px] font-bold mb-4 flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-slate-500" /> Note Board
      </h1>

      <div className="space-y-6">
        {/* ===== BẢNG 01 — Thông tin phòng theo dõi ===== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-800">Thông tin phòng theo dõi</h2>
            <button onClick={handleSyncFromReport} className="flex items-center gap-1.5 text-[12px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Đồng bộ từ Báo cáo
            </button>
          </div>
          {watchlist.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-6">Chưa có phòng nào trong danh sách theo dõi.</div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {watchlist.map((w) => (
                <div key={w.id} className="flex items-start gap-3 p-3">
                  <span className="bg-slate-100 text-slate-700 font-extrabold rounded-lg px-2.5 py-1 text-[13px] flex-shrink-0">{w.roomNo}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-slate-600 mb-1.5">{w.shiftNote}</div>
                    <input
                      defaultValue={w.extraNote}
                      onBlur={(e) => handleUpdateExtra(w.id, e.target.value)}
                      placeholder="Ghi chú bổ sung / chỉnh sửa..."
                      className="w-full text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400"
                    />
                  </div>
                  <button onClick={() => handleDeleteWatch(w.id)} className="text-red-500 bg-red-50 rounded-lg p-1.5 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== BẢNG 02 — Lịch thay giường & theo dõi Special ===== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-800">Lịch thay giường &amp; theo dõi Special</h2>
            <button onClick={handleClearOverdue} className="flex items-center gap-1.5 text-[12px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Xoá tất cả lịch sử
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['ThayGiuong', 'DND', 'RF'] as const).map((cat) => (
              <div key={cat} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className={`px-3 py-2 text-[12px] font-bold ${CATEGORY_LABEL[cat].cls}`}>{CATEGORY_LABEL[cat].label}</div>
                {overdueByCategory(cat).length === 0 ? (
                  <div className="text-[12px] text-slate-400 text-center py-4">Trống</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {overdueByCategory(cat).map((o) => (
                      <div key={o.id} className="flex items-center justify-between px-3 py-2">
                        <div>
                          <div className="font-bold text-slate-700 text-[13px]">{o.roomNo}</div>
                          <div className="text-[10px] text-slate-400">{o.dateNoted}</div>
                        </div>
                        <button onClick={() => handleDeleteOverdue(o.id)} className="text-red-500 bg-red-50 rounded-lg p-1">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ===== BẢNG 03 — Dụng cụ & vật tư đặc biệt ===== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-lg font-bold text-slate-800 mb-3">Dụng cụ &amp; vật tư đặc biệt</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SUPPLY_LABELS.map((label) => {
              const item = supplies.find((s) => s.label === label);
              return (
                <div key={label} className="border border-slate-200 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase mb-1.5">{label}</div>
                  <input
                    defaultValue={item?.value || ''}
                    onChange={(e) => handleSupplyChange(label, e.target.value)}
                    onBlur={(e) => handleSupplyBlur(label, e.target.value)}
                    placeholder="Nhập số lượng / số phòng..."
                    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:border-blue-400"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
