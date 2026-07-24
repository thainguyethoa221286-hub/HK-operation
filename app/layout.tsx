import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HK PRO',
  description: 'Hệ thống quản lý buồng phòng HK PRO',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="bg-slate-100 text-slate-800">{children}</body>
    </html>
  );
}
