'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, Trash2 } from 'lucide-react';
import type { Room, OverdueHistoryRow, SupplyBoardItem, LinenChangeHistoryRow } from '@/lib/types';
import { SUPPLY_LABELS } from '@/lib/types';
import {
  getOverdueHistory, deleteOverdueHistoryRow, clearOverdueHistory,
  getSuppliesBoard, updateSupplyItem, getLinenChangeHistory,
} from '@/lib/api';

interface NoteBoardScreenProps {
  rooms: Room[];
}

const CATEGORY_LABEL: Record<string, { label: string; cls: string }> = {
  DND: { label: 'DND', cls: 'bg-red-100 text-red-700' },
  RF: { label: 'RF', cls: 'bg-purple-100 text-purple-700' },
};

export default function NoteBoardScreen({ rooms }: NoteBoardScreenProps) {
  const [overdue, setOverdue] = useState<OverdueHistoryRow[]>([]);
  const [supplies, setSupplies] = useState<SupplyBoardItem[]>([]);
  const [linenHistory, setLinenHistory] = useState<LinenChangeHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshAll = () => {
    Promise.all([getOverdueHistory(), getSuppliesBoard(), getLinenChangeHistory()])
      .then(([o, s, l]) => { setOverdue(o); setSupplies(s); setLinenHistory(l); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { refreshAll(); }, []);

  const handleDeleteOverdue = async (id: number) => {
    setOverdue((prev) => prev.filter((o) => o.id !== id));
    await deleteOverdueHistoryRow(id);
  };
  const handleClearOverdue = async () => {
    if (!window.confirm('Xoá TOÀN BỘ lịch sử DND/RF? Không thể hoàn tác.')) return;
    setOverdue([]);
    await clearOverdueHistory();
  };
  const overdueByCategory = (cat: string) => overdue.filter((o) => o.category === cat);

  // Báo cáo lịch thay giường — GỘP cả "hôm qua" (snapshot từ Sheet, ghi lúc Đồng bộ AI) VÀ
  // "hôm nay" (đang chọn trực tiếp trên phòng ngay lúc này, tính trực tiếp từ rooms, real-time).
  const todayDMY = () => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };
  const liveLinenEntries: LinenChangeHistoryRow[] = rooms
    .filter((r) => r.LinenChange === 'Có' || r.LinenChange === 'Không')
    .map((r, i) => ({
      id: -1000 - i, // id âm để không trùng id thật từ Sheet — chỉ dùng làm React key
      roomNo: r.MaPhong,
      roomType: r.LoaiPhong,
      date: todayDMY(),
      staff: r.NhanVienPhuTrach,
      status: r.LinenChange as 'Có' | 'Không',
    }));
  const allLinenHistory = [...liveLinenEntries, ...linenHistory];
  const linenChanged = allLinenHistory.filter((r) => r.status === 'Có');
  const linenNotChanged = allLinenHistory.filter((r) => r.status === 'Không');

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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-800">Lịch DND &amp; RF (hôm qua)</h2>
            <button onClick={handleClearOverdue} className="flex items-center gap-1.5 text-[12px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Xoá tất cả lịch sử
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(['DND', 'RF'] as const).map((cat) => (
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

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Báo cáo lịch thay ga/giường</h2>
          <div className="text-[11px] text-slate-400 mb-3">Gộp cả hôm nay (đang chọn trực tiếp) và hôm qua (giữ thêm 1 ngày) — chỉ mất dữ liệu hôm qua ở lần Đồng bộ AI kế tiếp.</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[12px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 mb-2">
                Báo cáo phòng THAY GIƯỜNG ({linenChanged.length})
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                {linenChanged.length === 0 ? (
                  <div className="text-[12px] text-slate-400 text-center py-6">Chưa có dữ liệu</div>
                ) : (
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase whitespace-nowrap">
                        <th className="px-2.5 py-2 text-left">Phòng</th>
                        <th className="px-2 py-2 text-left">Loại</th>
                        <th className="px-2 py-2 text-left">Ngày</th>
                        <th className="px-2 py-2 text-left">Nhân viên</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linenChanged.map((r) => (
                        <tr key={r.id} className="border-t border-slate-100">
                          <td className="px-2.5 py-1.5 font-bold text-blue-600 whitespace-nowrap">{r.roomNo}</td>
                          <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{r.roomType}</td>
                          <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                            {r.date}{r.date === todayDMY() && <span className="text-emerald-600 font-semibold ml-1">(hôm nay)</span>}
                          </td>
                          <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{r.staff || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div>
              <div className="text-[12px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 mb-2">
                Báo cáo phòng KHÔNG THAY GIƯỜNG ({linenNotChanged.length})
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                {linenNotChanged.length === 0 ? (
                  <div className="text-[12px] text-slate-400 text-center py-6">Chưa có dữ liệu</div>
                ) : (
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase whitespace-nowrap">
                        <th className="px-2.5 py-2 text-left">Phòng</th>
                        <th className="px-2 py-2 text-left">Loại</th>
                        <th className="px-2 py-2 text-left">Ngày</th>
                        <th className="px-2 py-2 text-left">Nhân viên</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linenNotChanged.map((r) => (
                        <tr key={r.id} className="border-t border-slate-100">
                          <td className="px-2.5 py-1.5 font-bold text-slate-700 whitespace-nowrap">{r.roomNo}</td>
                          <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{r.roomType}</td>
                          <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                            {r.date}{r.date === todayDMY() && <span className="text-emerald-600 font-semibold ml-1">(hôm nay)</span>}
                          </td>
                          <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{r.staff || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#1a2e26] rounded-2xl shadow-lg p-5">
          <h2 className="text-center text-white text-xl font-bold tracking-wide mb-5" style={{ fontFamily: 'cursive' }}>
            GHI CHÚ DỊCH VỤ / SPECIAL
          </h2>
          <div className="divide-y divide-white/10">
            {SUPPLY_LABELS.map((label) => {
              const item = supplies.find((s) => s.label === label);
              return (
                <div key={label} className="flex items-center gap-3 py-3">
                  <div className="relative flex-shrink-0">
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-600" />
                    <span className="bg-amber-400 text-slate-900 font-bold px-3 py-1.5 rounded-md shadow text-[12px] whitespace-nowrap inline-block">
                      {label}
                    </span>
                  </div>
                  <input
                    defaultValue={item?.value || ''}
                    onChange={(e) => handleSupplyChange(label, e.target.value)}
                    onBlur={(e) => handleSupplyBlur(label, e.target.value)}
                    placeholder="Viết ghi chú tại đây..."
                    className="flex-1 min-w-0 bg-transparent text-white placeholder-white/30 text-[14px] outline-none border-b border-white/10 focus:border-amber-400 py-1"
                    style={{ fontFamily: 'cursive' }}
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
