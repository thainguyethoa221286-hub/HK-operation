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

  const SidebarContent = (
    <>
      <div className={`flex items-center gap-2 font-bold text-white text-[17px] px-4 pb-4 ${sidebarCollapsed ? 'justify-center px-0' : ''}`}>
        <span className="bg-emerald-600 w-[26px] h-[26px] rounded-lg flex items-center justify-center text-xs flex-shrink-0">🧹</span>
        {!sidebarCollapsed && 'HK OPERATION'}
      </div>
      <div className={`flex items-center gap-2.5 px-4 py-3 border-t border-b border-white/10 mb-2.5 ${sidebarCollapsed ? 'justify-center px-0' : ''}`}>
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex-1 text-xs min-w-0">
            <b className="block text-[13px] text-white truncate">{account.hoTen}</b>
            {ROLE_LABELS[account.vaiTro] || account.vaiTro}
          </div>
        )}
        {!sidebarCollapsed && <LogOut className="w-4 h-4 opacity-60 cursor-pointer flex-shrink-0" onClick={handleLogout} />}
      </div>
      <nav className="flex flex-col gap-0.5 px-2.5">
        {navItems.map((item) => (
          <button
            key={item.label}
            title={sidebarCollapsed ? item.label : undefined}
            onClick={() => { setScreen(item.key); setMobileNavOpen(false); }}
            className={`flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg text-sm ${sidebarCollapsed ? 'justify-center px-0' : ''} ${
              item.key === screen ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" /> {!sidebarCollapsed && item.label}
          </button>
        ))}
      </nav>
    </>
  );

  return (
    <div className="flex min-h-screen" style={{ background: themeBackground }}>
      {/* Desktop — Sidebar cố định, có nút thu gọn/mở rộng ở góc dưới */}
      <aside className={`hidden md:flex ${sidebarCollapsed ? 'md:w-16' : 'md:w-64'} bg-[#054a36] text-slate-300 flex-shrink-0 flex-col py-4 relative transition-all duration-200`}>
        {SidebarContent}
        <button
          onClick={toggleSidebarCollapsed}
          title={sidebarCollapsed ? 'Mở rộng' : 'Thu gọn'}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md hover:bg-emerald-500"
        >
          {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* MAIN */}
      <main className="flex-1 w-full px-3 md:px-6 py-4 md:py-5 pb-20 md:pb-5 overflow-x-hidden">
        {/* Mobile — Header đơn giản (không còn Hamburger/Drawer, xem thanh điều hướng ngang ở cuối màn hình) */}
        <div className="md:hidden flex items-center gap-2 mb-3">
          <span className="bg-emerald-600 w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0">🧹</span>
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
            {screen === 'sodo' && canAccess('sodo') && <RoomMapScreen rooms={rooms} setRooms={setRoomsTracked} staffList={staffList} account={account} />}
            {screen === 'phancong' && canAccess('phancong') && <AssignScreen rooms={rooms} setRooms={setRoomsTracked} staffList={staffList} />}
            {screen === 'nhiemvu' && canAccess('nhiemvu') && <TaskScreen rooms={rooms} setRooms={setRoomsTracked} account={account} />}
            {screen === 'baocao' && canAccess('baocao') && <ReportScreen rooms={rooms} />}
            {screen === 'task' && canAccess('task') && <TaskChartScreen />}
            {screen === 'maintenance' && canAccess('maintenance') && <MaintenanceScreen />}
            {screen === 'lostfound' && canAccess('lostfound') && <LostFoundScreen />}
            {screen === 'noteboard' && canAccess('noteboard') && <NoteBoardScreen rooms={rooms} />}
            {screen === 'settings' && canAccess('settings') && <SettingsScreen account={account} />}
          </>
        )}
      </main>

      {/* Mobile — Thanh điều hướng NGANG cuộn được, cố định đáy màn hình, thay cho Sidebar dọc + Drawer */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#054a36] border-t border-white/10 overflow-x-auto">
        <div className="flex gap-1 px-2 py-2 min-w-max">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setScreen(item.key)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap flex-shrink-0 ${
                item.key === screen ? 'bg-emerald-600 text-white' : 'text-slate-300'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
