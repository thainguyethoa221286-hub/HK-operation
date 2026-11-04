'use client';

import { useEffect, useRef, useState } from 'react';
import { LayoutGrid, ClipboardList, ListChecks, FileText, MessageSquare, Settings, LogOut, User, ListTodo, Wrench, PackageSearch, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Room, Account } from '@/lib/types';
import { ROLE_LABELS, getEffectiveModules } from '@/lib/types';
import { fetchRooms, listAccounts, API_URL } from '@/lib/api';
import RoomMapScreen from '@/components/RoomMapScreen';
import AssignScreen from '@/components/AssignScreen';
import TaskScreen from '@/components/TaskScreen';
import TaskChartScreen from '@/components/TaskChartScreen';
import MaintenanceScreen from '@/components/MaintenanceScreen';
import LostFoundScreen from '@/components/LostFoundScreen';
import NoteBoardScreen from '@/components/NoteBoardScreen';
import SettingsScreen, { THEME_KEY, THEMES } from '@/components/SettingsScreen';
import ReportScreen from '@/components/ReportScreen';
import LoginScreen from '@/components/LoginScreen';

type ScreenKey = 'sodo' | 'phancong' | 'nhiemvu' | 'baocao' | 'task' | 'maintenance' | 'lostfound' | 'noteboard' | 'settings';
const STORAGE_KEY = 'hk_pro_rooms';
const ACCOUNT_KEY = 'hk_pro_account';

export default function HomePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [screen, setScreen] = useState<ScreenKey>('sodo');
  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [themeBackground, setThemeBackground] = useState('linear-gradient(135deg, #eef2ff 0%, #e2e8f0 45%, #ede9fe 100%)');
  const [syncError, setSyncError] = useState<string | null>(null);
  // Mục 3 — danh sách nhân viên cho màn Phân công lấy ĐỘNG từ tab TaiKhoan, không hardcode
  const [staffList, setStaffList] = useState<string[]>([]);

  // Mục 6 — chống badge/trạng thái chớp tắt: đánh dấu mốc giờ vừa sửa local gần nhất,
  // polling sẽ tạm bỏ qua 1 vài vòng làm mới ngay sau đó để không lấy về dữ liệu cũ (chưa kịp ghi xong) đè lên.
  const lastLocalEditRef = useRef<number>(0);
  const setRoomsTracked: React.Dispatch<React.SetStateAction<Room[]>> = (value) => {
    lastLocalEditRef.current = Date.now();
    setRooms(value);
  };

  // RBAC — tài khoản đăng nhập, đọc từ localStorage (đăng nhập 1 lần trên thiết bị)
  const [account, setAccount] = useState<Account | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ACCOUNT_KEY);
      if (saved) {
        const acc: Account = JSON.parse(saved);
        setAccount(acc);
        // HK Staff chỉ có quyền vào màn Nhiệm vụ — khoá thẳng ngay từ đầu
        if (acc.vaiTro === 'HKStaff') setScreen('nhiemvu');
      }
    } catch {}
    setCheckingAuth(false);
  }, []);

  const handleLoginSuccess = (acc: Account) => {
    setAccount(acc);
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc));
    if (acc.vaiTro === 'HKStaff') setScreen('nhiemvu');
  };

  const handleLogout = () => {
    localStorage.removeItem(ACCOUNT_KEY);
    setAccount(null);
  };

  useEffect(() => {
    const applyThemeFromStorage = () => {
      try {
        const saved = localStorage.getItem(THEME_KEY);
        const found = THEMES.find((t) => t.key === saved);
        setThemeBackground(found ? found.background : 'linear-gradient(135deg, #eef2ff 0%, #e2e8f0 45%, #ede9fe 100%)');
      } catch {}
    };
    applyThemeFromStorage();
    try {
      const savedCollapsed = localStorage.getItem('hk_pro_sidebar_collapsed');
      if (savedCollapsed === '1') setSidebarCollapsed(true);
    } catch {}
    window.addEventListener('hk-theme-change', applyThemeFromStorage);
    return () => window.removeEventListener('hk-theme-change', applyThemeFromStorage);
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('hk_pro_sidebar_collapsed', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  // Fix 4 — khởi tạo an toàn cho SSR: chỉ đọc localStorage trong useEffect (client-only),
  // tránh lỗi hydration mismatch trên Safari/Chrome Mobile.
  useEffect(() => {
    let cachedRooms: Room[] | null = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) cachedRooms = JSON.parse(saved);
    } catch {}

    if (cachedRooms && cachedRooms.length) {
      setRooms(cachedRooms);
      setLoading(false);
    }

    // Nếu đã cấu hình Google Sheet (API_URL) thì luôn lấy bản mới nhất làm nguồn chính xác;
    // nếu chưa cấu hình thì giữ nguyên dữ liệu đã cache (không ghi đè bằng dữ liệu mẫu).
    fetchRooms().then((data) => {
      if (API_URL) {
        setRooms(data);
        setSyncError(null);
      } else if (!cachedRooms || cachedRooms.length === 0) {
        setRooms(data);
      }
      setLoading(false);
    }).catch((err) => {
      setLoading(false);
      if (API_URL) {
        setSyncError(
          'Không kết nối được Google Sheet: ' + (err?.message || 'lỗi không xác định') +
          '. Đang hiển thị dữ liệu cũ trên trình duyệt này (có thể không khớp Sheet thật).'
        );
      }
    });
  }, []);

  // Đồng bộ real-time giữa các thiết bị (VD: nhân viên bấm Hoàn thành trên điện thoại,
  // màn Sơ đồ phòng của chị trên máy tính cần tự cập nhật mà không phải bấm F5) —
  // tự động lấy lại dữ liệu mới nhất từ Google Sheet mỗi 15 giây.
  const POLL_INTERVAL_MS = 8000;
  const EDIT_PROTECT_MS = 3000; // tạm bỏ qua làm mới trong 3s sau khi vừa sửa, tránh chớp tắt do lấy về dữ liệu chưa kịp ghi xong
  useEffect(() => {
    if (!API_URL) return;
    const timer = setInterval(() => {
      if (Date.now() - lastLocalEditRef.current < EDIT_PROTECT_MS) return;
      fetchRooms().then((data) => {
        setRooms(data);
        setSyncError(null);
      }).catch(() => {
        // Lỗi polling nền thì bỏ qua âm thầm, không làm phiền — vẫn còn dữ liệu cũ để dùng tạm
      });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // Mục 3 — lấy danh sách tên nhân viên (vai trò HKStaff) ĐỘNG từ tab TaiKhoan cho màn Phân công
  useEffect(() => {
    if (!API_URL) return;
    listAccounts().then((accounts) => {
      const names = accounts.filter((a) => a.vaiTro === 'HKStaff').map((a) => a.hoTen).filter(Boolean);
      setStaffList(names);
    }).catch(() => {});
  }, []);

  // Fix 4 — lưu mọi thay đổi vào LocalStorage để không mất khi refresh
  useEffect(() => {
    if (rooms.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
    }
  }, [rooms]);

  if (checkingAuth) return null;
  if (!account) return <LoginScreen onLoginSuccess={handleLoginSuccess} />;

  // Quyền hiệu lực (🟢 Mở) của tài khoản đang đăng nhập — dùng CHUNG 1 nguồn logic với Ma trận
  // phân quyền ở Cài đặt (getEffectiveModules), để menu luôn khớp tuyệt đối với những gì Admin cấu hình.
  const effectiveModules = getEffectiveModules(account);
  const canAccess = (moduleKey: string): boolean => effectiveModules.includes(moduleKey);

  // Module đang 🔴 Đóng phải ẨN HOÀN TOÀN khỏi menu (không hiển thị mờ) — nên lọc bỏ hẳn ở đây,
  // không giữ lại phần tử "key: null" như cách làm cũ nữa.
  const allNavItems: { key: ScreenKey; label: string; icon: any }[] = [
    { key: 'sodo', label: 'Sơ đồ phòng', icon: LayoutGrid },
    { key: 'phancong', label: 'Phân công', icon: ClipboardList },
    { key: 'nhiemvu', label: 'Nhiệm vụ', icon: ListChecks },
    { key: 'baocao', label: 'Daily Report', icon: FileText },
    { key: 'noteboard', label: 'Noted Board', icon: MessageSquare },
    { key: 'task', label: 'Task', icon: ListTodo },
    { key: 'maintenance', label: 'Maintenance', icon: Wrench },
    { key: 'lostfound', label: 'Lost and Found', icon: PackageSearch },
    { key: 'settings', label: 'Cài đặt', icon: Settings },
  ];
  const navItems = allNavItems.filter((item) => canAccess(item.key));

  // Bảng màu pastel riêng cho từng module — tông đậm hơn để thẻ nổi rõ trên nền (viết đủ tên class để Tailwind sinh CSS)
  const PASTEL: Record<ScreenKey, { card: string; iconBox: string; text: string; ring: string; dot: string }> = {
    sodo: { card: 'bg-emerald-100 border-emerald-200', iconBox: 'bg-white text-emerald-600 shadow-sm', text: 'text-emerald-900', ring: 'border-emerald-400 ring-2 ring-emerald-300', dot: 'bg-emerald-500' },
    phancong: { card: 'bg-sky-100 border-sky-200', iconBox: 'bg-white text-sky-600 shadow-sm', text: 'text-sky-900', ring: 'border-sky-400 ring-2 ring-sky-300', dot: 'bg-sky-500' },
    nhiemvu: { card: 'bg-violet-100 border-violet-200', iconBox: 'bg-white text-violet-600 shadow-sm', text: 'text-violet-900', ring: 'border-violet-400 ring-2 ring-violet-300', dot: 'bg-violet-500' },
    baocao: { card: 'bg-amber-100 border-amber-200', iconBox: 'bg-white text-amber-600 shadow-sm', text: 'text-amber-900', ring: 'border-amber-400 ring-2 ring-amber-300', dot: 'bg-amber-500' },
    noteboard: { card: 'bg-rose-100 border-rose-200', iconBox: 'bg-white text-rose-600 shadow-sm', text: 'text-rose-900', ring: 'border-rose-400 ring-2 ring-rose-300', dot: 'bg-rose-500' },
    task: { card: 'bg-indigo-100 border-indigo-200', iconBox: 'bg-white text-indigo-600 shadow-sm', text: 'text-indigo-900', ring: 'border-indigo-400 ring-2 ring-indigo-300', dot: 'bg-indigo-500' },
    maintenance: { card: 'bg-orange-100 border-orange-200', iconBox: 'bg-white text-orange-600 shadow-sm', text: 'text-orange-900', ring: 'border-orange-400 ring-2 ring-orange-300', dot: 'bg-orange-500' },
    lostfound: { card: 'bg-teal-100 border-teal-200', iconBox: 'bg-white text-teal-600 shadow-sm', text: 'text-teal-900', ring: 'border-teal-400 ring-2 ring-teal-300', dot: 'bg-teal-500' },
    settings: { card: 'bg-slate-100 border-slate-200', iconBox: 'bg-white text-slate-600 shadow-sm', text: 'text-slate-900', ring: 'border-slate-400 ring-2 ring-slate-300', dot: 'bg-slate-500' },
  };


  // Nếu màn đang chọn (mặc định 'sodo' lúc mới vào) KHÔNG còn nằm trong quyền hiệu lực —
  // VD Admin vừa đóng đúng module đó cho tài khoản này ở Ma trận phân quyền — tự động rơi về
  // module đầu tiên còn được mở, tránh màn chính bị trắng trơn không hiện gì.
  const effectiveScreen: ScreenKey | undefined = canAccess(screen) ? screen : navItems[0]?.key;

  const initial = (account.hoTen || '?').trim().charAt(0).toUpperCase();

  const SidebarContent = (
    <>
      {/* Logo */}
      <div className={`flex items-center gap-2 font-bold text-slate-800 text-[17px] px-4 pb-4 ${sidebarCollapsed ? 'justify-center px-0' : ''}`}>
        <span className="bg-emerald-500 text-white w-[28px] h-[28px] rounded-xl flex items-center justify-center text-xs flex-shrink-0 shadow-sm">🧹</span>
        {!sidebarCollapsed && 'HK OPERATION'}
      </div>

      {/* Thẻ thông tin User */}
      <div className={`mx-3 mb-4 bg-white border border-slate-200 rounded-2xl shadow-md flex items-center gap-3 ${sidebarCollapsed ? 'justify-center p-2' : 'p-3'}`}>
        <div className="relative w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center flex-shrink-0" title={sidebarCollapsed ? account.hoTen : undefined}>
          {initial || <User className="w-4 h-4" />}
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <b className="block text-[14px] text-slate-800 truncate">{account.hoTen}</b>
            <span className="block text-xs text-slate-400 truncate">{ROLE_LABELS[account.vaiTro] || account.vaiTro}</span>
          </div>
        )}
        {!sidebarCollapsed && (
          <button onClick={handleLogout} title="Đăng xuất" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors flex-shrink-0">
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {!sidebarCollapsed && (
        <div className="px-4 mb-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Danh mục module</div>
      )}

      {/* Các thẻ module pastel */}
      <nav className={`flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto pt-1 pb-4 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
        {navItems.map((item) => {
          const c = PASTEL[item.key];
          const active = item.key === effectiveScreen;
          return (
            <button
              key={item.label}
              title={sidebarCollapsed ? item.label : undefined}
              onClick={() => { setScreen(item.key); setMobileNavOpen(false); }}
              className={`group relative flex items-center gap-3 text-left rounded-2xl border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${c.card} ${
                active ? `${c.ring} shadow-md` : ''
              } ${sidebarCollapsed ? 'justify-center p-2' : 'px-2.5 py-2'}`}
            >
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${c.iconBox}`}>
                <item.icon className="w-[18px] h-[18px]" />
              </span>
              {!sidebarCollapsed && <span className={`flex-1 text-[14px] font-semibold ${c.text}`}>{item.label}</span>}
              {active && (
                <span className={`rounded-full ${c.dot} ${sidebarCollapsed ? 'absolute top-1 right-1 w-2 h-2' : 'w-2.5 h-2.5 mr-1'}`} />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="flex min-h-screen" style={{ background: themeBackground }}>
      {/* Desktop — Sidebar cố định, có nút thu gọn/mở rộng ở góc dưới */}
      <aside className={`hidden md:flex ${sidebarCollapsed ? 'md:w-16' : 'md:w-64'} bg-white border-r border-slate-200 shadow-[2px_0_12px_rgba(15,23,42,0.06)] text-slate-600 flex-shrink-0 flex-col py-4 relative transition-all duration-200 md:sticky md:top-0 md:h-screen`}>
        {SidebarContent}
        <button
          onClick={toggleSidebarCollapsed}
          title={sidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}
          className="absolute -right-3 top-16 z-10 w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center shadow-md hover:text-emerald-600 hover:border-emerald-300 transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* MAIN */}
      <main className="flex-1 w-full px-3 md:px-6 py-4 md:py-5 pb-24 md:pb-5 overflow-x-hidden">
        {/* Mobile — Header đơn giản (không còn Hamburger/Drawer, xem thanh điều hướng ngang ở cuối màn hình) */}
        <div className="md:hidden flex items-center gap-2 mb-3">
          <span className="bg-emerald-500 text-white w-7 h-7 rounded-xl flex items-center justify-center text-xs flex-shrink-0 shadow-sm">🧹</span>
          <span className="font-bold text-[15px]">HK OPERATION</span>
          <LogOut className="w-4 h-4 text-slate-400 ml-auto" onClick={handleLogout} />
        </div>

        {syncError && (
          <div className="mb-4 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            ⚠ {syncError}
          </div>
        )}

        {loading && rooms.length === 0 ? (
          <div className="text-sm text-slate-400 py-10 text-center">Đang tải dữ liệu phòng...</div>
        ) : (
          <>
            {effectiveScreen === 'sodo' && canAccess('sodo') && <RoomMapScreen rooms={rooms} setRooms={setRoomsTracked} staffList={staffList} account={account} />}
            {effectiveScreen === 'phancong' && canAccess('phancong') && <AssignScreen rooms={rooms} setRooms={setRoomsTracked} staffList={staffList} />}
            {effectiveScreen === 'nhiemvu' && canAccess('nhiemvu') && <TaskScreen rooms={rooms} setRooms={setRoomsTracked} account={account} />}
            {effectiveScreen === 'baocao' && canAccess('baocao') && <ReportScreen rooms={rooms} />}
            {effectiveScreen === 'task' && canAccess('task') && <TaskChartScreen />}
            {effectiveScreen === 'maintenance' && canAccess('maintenance') && <MaintenanceScreen />}
            {effectiveScreen === 'lostfound' && canAccess('lostfound') && <LostFoundScreen />}
            {effectiveScreen === 'noteboard' && canAccess('noteboard') && <NoteBoardScreen rooms={rooms} />}
            {effectiveScreen === 'settings' && canAccess('settings') && <SettingsScreen account={account} />}
            {!effectiveScreen && (
              <div className="text-sm text-slate-400 py-10 text-center">
                Tài khoản chưa được cấp quyền vào module nào — liên hệ Admin để được cấp quyền.
              </div>
            )}
          </>
        )}
      </main>

      {/* Mobile — Thanh điều hướng NGANG cuộn được, cố định đáy màn hình, thay cho Sidebar dọc + Drawer */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] overflow-x-auto">
        <div className="flex gap-2 px-3 py-2.5 min-w-max">
          {navItems.map((item) => {
            const c = PASTEL[item.key];
            const active = item.key === effectiveScreen;
            return (
              <button
                key={item.label}
                onClick={() => setScreen(item.key)}
                className={`relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl border shadow-sm text-[10px] font-semibold whitespace-nowrap flex-shrink-0 transition-all duration-200 active:scale-95 ${c.card} ${c.text} ${
                  active ? `${c.ring} shadow-md` : ''
                }`}
              >
                <span className={`w-7 h-7 rounded-xl flex items-center justify-center ${c.iconBox}`}>
                  <item.icon className="w-4 h-4" />
                </span>
                {item.label}
                {active && <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${c.dot}`} />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
