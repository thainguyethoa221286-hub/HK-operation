'use client';

import { useEffect, useState } from 'react';
import { Megaphone, Send, Trash2, Shield, Palette, Check } from 'lucide-react';
import type { Account, BroadcastTaskData } from '@/lib/types';
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
            <Megaphone className="w-5 h-5 text-red-600" /> Task chỉ đạo đặc biệt
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

        {/* ===== 2. Ma trận phân quyền — CHỈ Admin thấy/sửa ===== */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-slate-500" /> Ma trận phân quyền
            </h2>
            <div className="text-[11px] text-slate-400 mb-3">
              Bấm vào nút <span className="font-bold text-emerald-600">🟢 Mở</span> / <span className="font-bold text-slate-500">🔴 Đóng</span> để bật/tắt từng module cho từng nhân viên.
              Module đang <span className="font-bold text-red-500">🔴 Đóng</span> sẽ <span className="font-bold">ẩn hoàn toàn</span> khỏi thanh menu của nhân viên đó — không chỉ mờ đi.
              Bấm &quot;Về mặc định&quot; để xoá ghi đè, quay lại đúng quyền chuẩn theo Vai trò.
            </div>
            <div className="overflow-x-auto">
              <table className="text-[12px] border-collapse min-w-[700px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white px-2 py-2 text-left border-b border-slate-200 font-bold text-slate-700">Nhân viên</th>
                    {ALL_MODULE_KEYS.map((mk) => (
                      <th key={mk} className="px-2 py-2 text-center border-b border-slate-200 font-bold text-slate-500 whitespace-nowrap">{MODULE_LABELS[mk]}</th>
                    ))}
                    <th className="px-2 py-2 text-center border-b border-slate-200"></th>
                  </tr>
                </thead>
                <tbody>
                  {staffAccounts.map((acc) => {
                    const custom = acc.modulesAllowed && acc.modulesAllowed.length > 0;
                    const effective = getEffectiveModules(acc);
                    return (
                      <tr key={acc.id} className="border-b border-slate-100">
                        <td className="sticky left-0 bg-white px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">
                          {acc.hoTen} <span className="text-slate-400 font-normal">({acc.vaiTro})</span>
                        </td>
                        {ALL_MODULE_KEYS.map((mk) => {
                          const isOpen = effective.includes(mk);
                          return (
                            <td key={mk} className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleModule(acc, mk)}
                                disabled={savingMatrix === acc.id}
                                className={`text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors disabled:opacity-50 ${
                                  isOpen ? 'bg-emerald-500 text-white font-bold' : 'bg-slate-200 text-slate-500 font-medium'
                                }`}
                              >
                                {isOpen ? '🟢 Mở' : '🔴 Đóng'}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-center whitespace-nowrap">
                          {custom && (
                            <button onClick={() => resetToDefault(acc)} className="text-[10px] font-bold text-blue-600 underline">Về mặc định</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
