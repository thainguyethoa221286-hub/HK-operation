'use client';

import { useEffect, useState } from 'react';
import { LayoutGrid, ClipboardList, ListChecks, FileText, MessageSquare, Settings, LogOut, User, Menu, X } from 'lucide-react';
import type { Room } from '@/lib/types';
import { fetchRooms, API_URL } from '@/lib/api';
import RoomMapScreen from '@/components/RoomMapScreen';
import AssignScreen from '@/components/AssignScreen';

type ScreenKey = 'sodo' | 'phancong';
const STORAGE_KEY = 'hk_pro_rooms';

export default function HomePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [screen, setScreen] = useState<ScreenKey>('sodo');
  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
      } else if (!cachedRooms || cachedRooms.length === 0) {
        setRooms(data);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Fix 4 — lưu mọi thay đổi vào LocalStorage để không mất khi refresh
  useEffect(() => {
    if (rooms.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
    }
  }, [rooms]);

  const navItems: { key: ScreenKey | null; label: string; icon: any }[] = [
    { key: 'sodo', label: 'Sơ đồ phòng', icon: LayoutGrid },
    { key: 'phancong', label: 'Phân công', icon: ClipboardList },
    { key: null, label: 'Nhiệm vụ', icon: ListChecks },
    { key: null, label: 'Báo cáo', icon: FileText },
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
        <div className="flex-1 text-xs">
          <b className="block text-[13px] text-white">Hoa</b>Admin
        </div>
        <LogOut className="w-4 h-4 opacity-60" />
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

        {loading && rooms.length === 0 ? (
          <div className="text-sm text-slate-400 py-10 text-center">Đang tải dữ liệu phòng...</div>
        ) : (
          <>
            {screen === 'sodo' && <RoomMapScreen rooms={rooms} setRooms={setRooms} />}
            {screen === 'phancong' && <AssignScreen rooms={rooms} setRooms={setRooms} />}
          </>
        )}
      </main>
    </div>
  );
}
