'use client';

import { useEffect, useState } from 'react';
import { LayoutGrid, ClipboardList, ListChecks, FileText, MessageSquare, Settings, LogOut, User, Menu, X } from 'lucide-react';
import type { Room, Account } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';
import { fetchRooms, listAccounts, API_URL } from '@/lib/api';
import RoomMapScreen from '@/components/RoomMapScreen';
import AssignScreen from '@/components/AssignScreen';
import TaskScreen from '@/components/TaskScreen';
import ReportScreen from '@/components/ReportScreen';
import LoginScreen from '@/components/LoginScreen';

type ScreenKey = 'sodo' | 'phancong' | 'nhiemvu' | 'baocao';
const STORAGE_KEY = 'hk_pro_rooms';
const ACCOUNT_KEY = 'hk_pro_account';

export default function HomePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [screen, setScreen] = useState<ScreenKey>('sodo');
  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  // Mục 3 — danh sách nhân viên cho màn Phân công lấy ĐỘNG từ tab TaiKhoan, không hardcode
  const [staffList, setStaffList] = useState<string[]>([]);

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
  const POLL_INTERVAL_MS = 15000;
  useEffect(() => {
    if (!API_URL) return;
    const timer = setInterval(() => {
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

  const isStaff = account.vaiTro === 'HKStaff';

  // HK Staff chỉ được vào "Nhiệm vụ" — Sơ đồ phòng/Phân công là công cụ quản lý
  const navItems: { key: ScreenKey | null; label: string; icon: any }[] = [
    { key: isStaff ? null : 'sodo', label: 'Sơ đồ phòng', icon: LayoutGrid },
    { key: isStaff ? null : 'phancong', label: 'Phân công', icon: ClipboardList },
    { key: 'nhiemvu', label: 'Nhiệm vụ', icon: ListChecks },
    { key: isStaff ? null : 'baocao', label: 'Báo cáo', icon: FileText },
    { key: null, label: 'Bảng thiếc', icon: MessageSquare },
    { key: null, label: 'Cài đặt', icon: Settings },
  ];

  const SidebarContent = (
    <>
      <div className="flex items-center gap-2 font-bold text-white text-[17px] px-4 pb-4">
        <span className="bg-blue-600 w-[26px] h-[26px] rounded-lg flex items-center justify-center text-xs">🧹</span>
        HK PRO
      </div>
      <div className="flex items-center gap-2.5 px-4 py-3 border-t border-b border-white/10 mb-2.5">
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
          <User className="w-4 h-4" />
        </div>
        <div className="flex-1 text-xs min-w-0">
          <b className="block text-[13px] text-white truncate">{account.hoTen}</b>
          {ROLE_LABELS[account.vaiTro] || account.vaiTro}
        </div>
        <LogOut className="w-4 h-4 opacity-60 cursor-pointer" onClick={handleLogout} />
      </div>
      <nav className="flex flex-col gap-0.5 px-2.5">
        {navItems.map((item) => (
          <button
            key={item.label}
            disabled={!item.key}
            onClick={() => { if (item.key) { setScreen(item.key); setMobileNavOpen(false); } }}
            className={`flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg text-sm ${
              item.key === screen ? 'bg-blue-600 text-white' : item.key ? 'text-slate-300 hover:bg-white/5' : 'text-slate-400 opacity-40'
            }`}
          >
            <item.icon className="w-4 h-4" /> {item.label}
          </button>
        ))}
      </nav>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Fix 5 — Sidebar cố định trên desktop, ẩn trên mobile */}
      <aside className="hidden md:flex md:w-64 bg-navy text-slate-300 flex-shrink-0 flex-col py-4">
        {SidebarContent}
      </aside>

      {/* Fix 5 — Drawer trượt cho mobile, mở bằng nút Hamburger */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-navy text-slate-300 flex flex-col py-4">
            <div className="flex justify-end px-3 mb-1">
              <X className="w-5 h-5 text-white cursor-pointer" onClick={() => setMobileNavOpen(false)} />
            </div>
            {SidebarContent}
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileNavOpen(false)} />
        </div>
      )}

      {/* MAIN */}
      <main className="flex-1 w-full px-3 md:px-6 py-4 md:py-5 overflow-x-hidden">
        {/* Fix 5 — Header mobile với nút Hamburger */}
        <div className="md:hidden flex items-center gap-3 mb-3">
          <button onClick={() => setMobileNavOpen(true)} className="w-9 h-9 rounded-lg bg-navy text-white flex items-center justify-center">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-[15px]">HK PRO</span>
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
            {screen === 'sodo' && !isStaff && <RoomMapScreen rooms={rooms} setRooms={setRooms} />}
            {screen === 'phancong' && !isStaff && <AssignScreen rooms={rooms} setRooms={setRooms} staffList={staffList} />}
            {screen === 'nhiemvu' && <TaskScreen rooms={rooms} setRooms={setRooms} account={account} />}
            {screen === 'baocao' && !isStaff && <ReportScreen rooms={rooms} />}
          </>
        )}
      </main>
    </div>
  );
}
