'use client';

import { useState } from 'react';
import { LogIn, Lock, Sparkles } from 'lucide-react';
import type { Account } from '@/lib/types';
import { loginByPassword } from '@/lib/api';

interface LoginScreenProps {
  onLoginSuccess: (account: Account) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Vui lòng nhập mật khẩu');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await loginByPassword(password);
      if (res.success && res.account) {
        onLoginSuccess(res.account);
      } else {
        setError(res.error || 'Đăng nhập thất bại');
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi kết nối, thử lại sau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 px-4 relative overflow-hidden">
      {/* Vòng tròn trang trí mờ phía sau, tạo chiều sâu thay vì nền phẳng đơn điệu */}
      <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-emerald-400/20 blur-3xl" />

      <div className="relative w-full max-w-[380px] bg-white rounded-3xl shadow-2xl p-8">
        <div className="flex flex-col items-center mb-7">
          <span className="bg-gradient-to-br from-emerald-500 to-emerald-700 w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-900/20 mb-3.5">
            <Sparkles className="w-8 h-8 text-white" />
          </span>
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">HK OPERATION</h1>
          <p className="text-[13px] text-slate-400 mt-1">Nhập mật khẩu để đăng nhập</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="flex items-center gap-2.5 border-2 border-slate-100 focus-within:border-emerald-400 rounded-xl px-3.5 py-3 bg-slate-50 transition-colors">
            <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu"
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>

          {error && (
            <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              ⚠ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl py-3.5 text-sm font-bold disabled:opacity-50 shadow-lg shadow-emerald-900/20 transition-all"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Đang kiểm tra...' : 'ĐĂNG NHẬP'}
          </button>
        </form>
      </div>
    </div>
  );
}
