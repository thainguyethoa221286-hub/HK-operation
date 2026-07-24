'use client';

import { useEffect, useState } from 'react';
import { LayoutGrid, ClipboardList, ListChecks, FileText, MessageSquare, Settings, LogOut, User } from 'lucide-react';
import type { Room } from '@/lib/types';
import { fetchRooms } from '@/lib/api';
import RoomMapScreen from '@/components/RoomMapScreen';
import AssignScreen from '@/components/AssignScreen';

type ScreenKey = 'sodo' | 'phancong';

export default function HomePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [screen, setScreen] = useState<ScreenKey>('sodo');

  useEffect(() => {
    fetchRooms().then(setRooms);
  }, []);

  const navItems: { key: ScreenKey | null; label: string; icon: any }[] = [
    { key: 'sodo', label: 'Đơn vị phòng', icon: LayoutGrid },
    { key: 'phancong', label: 'Phân công', icon: ClipboardList },
    { key: null, label: 'Nhiệm vụ', icon: ListChecks },
    { key: null, label: 'Báo cáo', icon: FileText },
    { key: null, label: 'Bảng thiếc', icon: MessageSquare },
    { key: null, label: 'Cài đặt', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen">
      {/* SIDEBAR */}
      <aside className="w-[220px] bg-navy text-slate-300 flex-shrink-0 flex flex-col py-4">
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
              onClick={() => item.key && setScreen(item.key)}
              className={`flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg text-sm ${
                item.key === screen ? 'bg-blue-600 text-white' : item.key ? 'text-slate-300 hover:bg-white/5' : 'text-slate-400 opacity-40'
              }`}
            >
              <item.icon className="w-4 h-4" /> {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* MAIN */}
      <main className="flex-1 px-6 py-5 overflow-x-auto">
        {screen === 'sodo' && <RoomMapScreen rooms={rooms} setRooms={setRooms} />}
        {screen === 'phancong' && <AssignScreen rooms={rooms} setRooms={setRooms} />}
      </main>
    </div>
  );
}
