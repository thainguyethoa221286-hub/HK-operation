'use client';

import { useState } from 'react';
import { LogIn, Lock, User as UserIcon } from 'lucide-react';
import type { Account } from '@/lib/types';
import { login } from '@/lib/api';

interface LoginScreenProps {
  onLoginSuccess: (account: Account) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !password.trim()) {
      setError('Vui lòng nhập đủ ID và mật khẩu');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await login(id.trim(), password);
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
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-[360px] bg-white rounded-2xl shadow-lg p-6">
        <div className="flex flex-col items-center mb-6">
          <span className="bg-blue-600 w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-2.5">🧹</span>
          <h1 className="text-lg font-bold text-slate-800">HK PRO</h1>
          <p className="text-xs text-slate-400 mt-0.5">Đăng nhập để tiếp tục</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50">
            <UserIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="ID đăng nhập"
              className="flex-1 bg-transparent text-sm outline-none"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50">
            <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu"
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
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Đang kiểm tra...' : 'ĐĂNG NHẬP'}
          </button>
        </form>
      </div>
    </div>
  );
}
