'use client';

import { useEffect, useState } from 'react';
import { Megaphone, Send, Trash2, Palette, Check, ChevronDown, ChevronUp, UserCog, Info, Search, RotateCcw, Loader2 } from 'lucide-react';
import type { Account, BroadcastTaskData, Role } from '@/lib/types';
import { ALL_MODULE_KEYS, MODULE_LABELS, getEffectiveModules } from '@/lib/types';
import { listAccounts, updateAccountModules, setBroadcastTask, clearBroadcastTask, getBroadcastTask } from '@/lib/api';

interface SettingsScreenProps {
  account: Account;
}

export const THEME_KEY = 'hk_pro_theme';
export const THEMES: { key: string; label: string; background: string }[] = [
  { key: 'violet', label: 'Thiên Hà Tím', background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 45%, #c7d2fe 100%)' },
  { key: 'nebula', label: 'Tinh Vân Xanh', background: 'linear-gradient(135deg, #dbeafe 0%, #c7d2fe 45%, #ddd6fe 100%)' },
  { key: 'aurora', label: 'Cực Quang', background: 'linear-gradient(135deg, #ccfbf1 0%, #a7f3d0 45%, #bae6fd 100%)' },
  { key: 'sunset', label: 'Hoàng Hôn Vũ Trụ', background: 'linear-gradient(135deg, #fee2e2 0%, #fecdd3 45%, #fed7aa 100%)' },
  { key: 'slate', label: 'Đêm Sao (Mặc định)', background: 'linear-gradient(135deg, #eef2ff 0%, #e2e8f0 45%, #ede9fe 100%)' },
];

export default function SettingsScreen({ account }: SettingsScreenProps) {
  const [staffAccounts, setStaffAccounts] = useState<Account[]>([]);
  const [broadcastContent, setBroadcastContent] = useState('');
  const [activeTask, setActiveTask] = useState<BroadcastTaskData | null>(null);
  const [theme, setTheme] = useState('slate');
  const [savingMatrix, setSavingMatrix] = useState<string | null>(null);
  // Mặc định ĐÓNG — phải bấm nút mới sổ Ma trận phân quyền ra, tránh bấm nhầm làm đổi quyền
  // của nhân viên khi chỉ đang lướt qua màn Cài đặt.
  const [matrixOpen, setMatrixOpen] = useState(false);
  // Ô tìm tên + lọc vai trò của Bảng phân quyền — CHỈ lọc hiển thị, không đổi dữ liệu
  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixRole, setMatrixRole] = useState<'all' | Role>('all');

  const refreshAccounts = () => { listAccounts().then(setStaffAccounts).catch(() => {}); };
  const refreshTask = () => { getBroadcastTask().then(setActiveTask).catch(() => {}); };

  useEffect(() => {
    refreshAccounts();
    refreshTask();
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved) setTheme(saved);
    } catch {}
  }, []);

  // ===== 1. Task chỉ đạo đặc biệt =====
  const handleSendBroadcast = async () => {
    if (!broadcastContent.trim()) return;
    await setBroadcastTask(broadcastContent.trim());
    setBroadcastContent('');
    refreshTask();
  };
  const handleClearBroadcast = async () => {
    if (!window.confirm('Huỷ Task chỉ đạo đang gửi? Toàn bộ nhân viên sẽ hết thấy bảng đỏ ngay.')) return;
    await clearBroadcastTask();
    refreshTask();
  };

  // ===== 2. Ma trận phân quyền =====
  const toggleModule = async (acc: Account, moduleKey: string) => {
    // Lấy đúng trạng thái ĐANG HIỂN THỊ (kể cả khi tài khoản chưa có Ma trận tuỳ chỉnh, đang dùng
    // mặc định theo Vai trò) rồi chỉ đảo NGƯỢC đúng 1 module vừa bấm — các module còn lại giữ nguyên
    // y hệt như đang hiển thị, không bị reset về rỗng.
    const currentEffective = getEffectiveModules(acc);
    const next = currentEffective.includes(moduleKey)
      ? currentEffective.filter((m) => m !== moduleKey)
      : [...currentEffective, moduleKey];
    setStaffAccounts((prev) => prev.map((a) => (a.id === acc.id ? { ...a, modulesAllowed: next } : a)));
    setSavingMatrix(acc.id);
    await updateAccountModules(acc.id, next);
    setSavingMatrix(null);
  };
  const resetToDefault = async (acc: Account) => {
    setStaffAccounts((prev) => prev.map((a) => (a.id === acc.id ? { ...a, modulesAllowed: [] } : a)));
    setSavingMatrix(acc.id);
    await updateAccountModules(acc.id, []);
    setSavingMatrix(null);
  };

  // ===== 3. Theme =====
  const applyTheme = (key: string) => {
    setTheme(key);
    try { localStorage.setItem(THEME_KEY, key); } catch {}
    window.dispatchEvent(new Event('hk-theme-change'));
  };

  const isAdmin = account.vaiTro === 'Admin';

  return (
    <div>
      <h1 className="text-[19px] font-bold mb-4">Cài đặt &amp; Phân quyền</h1>

      <div className="space-y-6">
        {/* ===== 1. Task chỉ đạo đặc biệt ===== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-3">
            <Megaphone className="w-5 h-5 text-red-600" /> TASK CHUNG
          </h2>
          {activeTask?.active ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 mb-3">
              <div className="text-[13px] font-bold text-red-700 mb-1">Đang gửi tới toàn bộ nhân viên:</div>
              <div className="text-[14px] text-slate-800 mb-2">{activeTask.content}</div>
              <div className="text-[12px] text-slate-500 mb-2">
                Đã hoàn thành: {activeTask.completions.length > 0 ? activeTask.completions.join(', ') : 'Chưa ai hoàn thành'}
              </div>
              <button onClick={handleClearBroadcast} className="flex items-center gap-1.5 text-[12px] font-bold text-red-600 bg-white border border-red-200 rounded-lg px-3 py-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Huỷ task này
              </button>
            </div>
          ) : (
            <div className="text-[12px] text-slate-400 mb-3">Chưa có task chỉ đạo nào đang gửi.</div>
          )}
          <textarea
            value={broadcastContent}
            onChange={(e) => setBroadcastContent(e.target.value)}
            placeholder='VD: "Tổng vệ sinh sảnh Tầng 1 trước 14h", "Kiểm tra toàn bộ minibar ca chiều"...'
            rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2"
          />
          <button onClick={handleSendBroadcast} className="flex items-center gap-1.5 bg-red-600 text-white font-bold text-sm rounded-xl px-4 py-2.5">
            <Send className="w-4 h-4" /> Gửi tới toàn bộ nhân viên
          </button>
        </div>

        {/* ===== 2. Bảng phân quyền — CHỈ Admin thấy/sửa, mặc định ĐÓNG để tránh bấm nhầm ===== */}
        {isAdmin && (() => {
          const q = matrixSearch.trim().toLowerCase();
          const visibleAccounts = staffAccounts.filter(
            (acc) => (matrixRole === 'all' || acc.vaiTro === matrixRole) && (!q || (acc.hoTen || '').toLowerCase().includes(q)),
          );
          return (
            <div className="rounded-3xl bg-gradient-to-b from-[#16213a] to-[#0f172a] border border-slate-700/60 shadow-[0_12px_30px_-12px_rgba(15,23,42,0.6)] text-slate-200 overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 p-4">
                <span className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 shadow-inner">
                  <UserCog className="w-5 h-5 text-sky-400" />
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[17px] font-bold text-white leading-tight">Bảng phân quyền</h2>
                  <p className="text-[12px] text-slate-400 truncate">Quản lý quyền truy cập chức năng</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMatrixOpen((v) => !v)}
                  className={`flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 whitespace-nowrap border transition ${
                    matrixOpen
                      ? 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                      : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/25'
                  }`}
                >
                  {matrixOpen ? <>Đóng lại <ChevronUp className="w-3.5 h-3.5" /></> : <>Mở phân quyền <ChevronDown className="w-3.5 h-3.5" /></>}
                </button>
              </div>

              {!matrixOpen && (
                <div className="px-4 pb-4 -mt-1 text-[12px] text-slate-500">Bấm &quot;Mở phân quyền&quot; để xem/sửa quyền từng nhân viên.</div>
              )}

              {matrixOpen && (
                <>
                  {/* Ghi chú */}
                  <div className="mx-4 mb-3 flex items-start gap-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/70 px-3.5 py-3 text-[12.5px] leading-relaxed text-slate-300">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" />
                    <div>
                      Module đang <span className="font-bold text-rose-400">Đóng</span> sẽ ẩn hoàn toàn khỏi thanh menu của nhân viên đó.
                      Bấm vào ô <span className="font-bold text-emerald-400">Mở</span>/<span className="font-bold text-rose-400">Đóng</span> để đổi;
                      bấm <span className="inline-flex items-center gap-0.5 font-bold text-slate-200"><RotateCcw className="w-3 h-3" /> Mặc định</span> để quay về quyền chuẩn theo vai trò.
                    </div>
                  </div>

                  {/* Tìm kiếm + lọc vai trò */}
                  <div className="mx-4 mb-3 flex gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-2 rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2.5 focus-within:border-sky-500/60 transition">
                      <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <input
                        value={matrixSearch}
                        onChange={(e) => setMatrixSearch(e.target.value)}
                        placeholder="Tìm tên nhân viên..."
                        className="flex-1 min-w-0 bg-transparent text-[13px] text-slate-100 placeholder:text-slate-500 outline-none"
                      />
                    </div>
                    <div className="relative">
                      <select
                        value={matrixRole}
                        onChange={(e) => setMatrixRole(e.target.value as 'all' | Role)}
                        className="h-full appearance-none rounded-xl bg-slate-900/70 border border-slate-700 pl-3 pr-8 text-[13px] text-slate-200 outline-none cursor-pointer"
                      >
                        <option value="all">Tất cả vai trò</option>
                        <option value="Admin">Admin</option>
                        <option value="GiamSat">Giám sát</option>
                        <option value="HKStaff">HK Staff</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    </div>
                  </div>

                  {/* Bảng — cột Nhân viên ghim bên trái, các cột module cuộn ngang */}
                  <div className="overflow-x-auto border-t border-slate-700/70">
                    <table className="border-collapse text-[13px] min-w-max w-full">
                      <thead>
                        <tr className="bg-slate-800/70">
                          <th className="sticky left-0 z-10 bg-[#1b2740] px-3.5 py-3 text-left font-bold text-slate-100 border-r border-slate-700/70 min-w-[128px]">
                            Nhân viên
                          </th>
                          {ALL_MODULE_KEYS.map((mk) => (
                            <th key={mk} className="px-2 py-3 text-center font-semibold text-slate-400 leading-tight min-w-[88px]">
                              {MODULE_LABELS[mk]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleAccounts.map((acc) => {
                          const custom = acc.modulesAllowed && acc.modulesAllowed.length > 0;
                          const effective = getEffectiveModules(acc);
                          const saving = savingMatrix === acc.id;
                          const role = ROLE_BADGE[acc.vaiTro] ?? ROLE_BADGE.HKStaff;
                          return (
                            <tr key={acc.id} className="border-t border-slate-700/50 hover:bg-white/[0.02] transition-colors">
                              <td className="sticky left-0 z-10 bg-[#121b30] px-3.5 py-3 border-r border-slate-700/70 align-middle">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-[15px] text-white whitespace-nowrap">{acc.hoTen}</span>
                                  {saving && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
                                </div>
                                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                  <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md border ${role.cls}`}>{role.label}</span>
                                  {custom && (
                                    <button
                                      type="button"
                                      onClick={() => resetToDefault(acc)}
                                      disabled={saving}
                                      title="Xoá tuỳ chỉnh, quay về quyền chuẩn theo vai trò"
                                      className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-sky-300 hover:text-sky-200 disabled:opacity-50"
                                    >
                                      <RotateCcw className="w-3 h-3" /> Mặc định
                                    </button>
                                  )}
                                </div>
                              </td>
                              {ALL_MODULE_KEYS.map((mk) => {
                                const isOpen = effective.includes(mk);
                                return (
                                  <td key={mk} className="px-2 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => toggleModule(acc, mk)}
                                      disabled={saving}
                                      aria-pressed={isOpen}
                                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-bold whitespace-nowrap transition active:scale-95 disabled:opacity-50 ${
                                        isOpen
                                          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/25'
                                          : 'bg-rose-500/10 border-rose-400/30 text-rose-300 hover:bg-rose-500/20'
                                      }`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]' : 'bg-rose-400'}`} />
                                      {isOpen ? 'Mở' : 'Đóng'}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                        {visibleAccounts.length === 0 && (
                          <tr>
                            <td colSpan={ALL_MODULE_KEYS.length + 1} className="px-4 py-8 text-left text-[13px] text-slate-500">
                              Không tìm thấy nhân viên phù hợp.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-2.5 text-[11px] text-slate-500 border-t border-slate-700/50">
                    ← Vuốt ngang bảng để xem các module còn lại
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ===== 3. Giao diện ===== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-3">
            <Palette className="w-5 h-5 text-slate-500" /> Màu nền giao diện (Tông Galaxy)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {THEMES.map((t) => (
              <button
                key={t.key}
                onClick={() => applyTheme(t.key)}
                className={`rounded-xl border-2 p-3 text-left ${theme === t.key ? 'border-emerald-500' : 'border-slate-200'}`}
              >
                <div className="w-full h-10 rounded-lg mb-2 border border-slate-200" style={{ background: t.background }} />
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  {theme === t.key && <Check className="w-3 h-3 text-emerald-600" />} {t.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Nhãn + màu badge vai trò trong Bảng phân quyền (viết đủ tên class cho Tailwind) */
const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  Admin: { label: 'Admin', cls: 'bg-amber-500/10 border-amber-400/50 text-amber-300' },
  GiamSat: { label: 'Giám Sát', cls: 'bg-sky-500/10 border-sky-400/50 text-sky-300' },
  HKStaff: { label: 'HK Staff', cls: 'bg-slate-700/40 border-slate-500/60 text-slate-300' },
};
