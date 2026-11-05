'use client';

import { useState } from 'react';
import { LogIn, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import type { Account } from '@/lib/types';
import { loginByPassword } from '@/lib/api';

interface LoginScreenProps {
  onLoginSuccess: (account: Account) => void;
}

/* =========================================================================
   TRANG ĐĂNG NHẬP — phong cách khách sạn sang trọng (xám đá / bạch kim).
   CHỈ đổi giao diện; logic đăng nhập (loginByPassword, báo lỗi, trạng thái
   đang kiểm tra) giữ nguyên 100% như bản cũ.
   ========================================================================= */
export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Tăng mỗi lần báo lỗi để chạy lại hiệu ứng "rung" của thẻ đăng nhập
  const [shakeKey, setShakeKey] = useState(0);

  const fail = (msg: string) => {
    setError(msg);
    setShakeKey((k) => k + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      fail('Vui lòng nhập mật khẩu');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await loginByPassword(password);
      if (res.success && res.account) {
        onLoginSuccess(res.account);
      } else {
        fail(res.error || 'Đăng nhập thất bại');
      }
    } catch (err: any) {
      fail(err?.message || 'Lỗi kết nối, thử lại sau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hk-login relative min-h-[100dvh] overflow-hidden bg-[#0b1120] text-slate-200 flex flex-col">
      <style>{LOGIN_CSS}</style>

      {/* ================= NỀN ================= */}
      {/* Lớp gradient xám đá chính */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#334155_0%,#1e293b_35%,#0f172a_70%,#0b1120_100%)]" />
      {/* Hoa văn damask rất mờ */}
      <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: DAMASK_BG, backgroundSize: '64px 64px' }} />
      {/* Quầng sáng bạc trôi chậm — tạo chiều sâu, bớt đơn điệu */}
      <div className="hk-aurora hk-aurora-1" />
      <div className="hk-aurora hk-aurora-2" />
      <div className="hk-aurora hk-aurora-3" />
      {/* Đốm sáng lấp lánh */}
      {SPARKLES.map((s, i) => (
        <span
          key={i}
          className="hk-sparkle"
          style={{ left: s.x, top: s.y, width: s.size, height: s.size, animationDelay: s.delay, animationDuration: s.dur }}
        />
      ))}
      {/* Đường nét kiến trúc toà khách sạn mờ phía dưới */}
      <HotelSkyline className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[760px] max-w-none opacity-[0.07]" />
      {/* Làm tối đáy cho footer dễ đọc */}
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#0b1120] via-[#0b1120]/70 to-transparent" />

      {/* ================= NỘI DUNG ================= */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 pt-10 pb-6">
        {/* ---- Thương hiệu ---- */}
        <div className="flex flex-col items-center text-center hk-rise" style={{ animationDelay: '0.05s' }}>
          <div className="relative w-[96px] h-[96px] mb-5">
            {/* Vòng bạc xoay chậm */}
            <span className="hk-ring absolute inset-0 rounded-full" />
            <span className="absolute inset-[3px] rounded-full bg-gradient-to-b from-slate-800 to-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_30px_rgba(0,0,0,0.5)]" />
            <HotelCrest className="absolute inset-0 m-auto w-[60px] h-[60px] drop-shadow-[0_2px_6px_rgba(226,232,240,0.25)]" />
          </div>

          <h1 className="hk-serif hk-brand text-[46px] sm:text-[54px] leading-none font-semibold tracking-[0.14em] pl-[0.14em]">
            M HOTEL
          </h1>

          <div className="flex items-center gap-3 my-4 w-full max-w-[260px]">
            <span className="flex-1 h-px bg-gradient-to-r from-transparent to-slate-400/60" />
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-slate-300"><path d="M12 2l2.9 6.9L22 9.3l-5.5 4.7L18.2 21 12 17.3 5.8 21l1.7-7L2 9.3l7.1-.4z" /></svg>
            <span className="flex-1 h-px bg-gradient-to-l from-transparent to-slate-400/60" />
          </div>

          <p className="text-[15px] font-semibold tracking-[0.32em] pl-[0.32em] text-slate-100">HK OPERATION</p>
          <p className="mt-1.5 text-[10.5px] font-medium tracking-[0.28em] pl-[0.28em] text-slate-400">
            HOSPITALITY MANAGEMENT SYSTEM
          </p>
        </div>

        {/* ---- Thẻ đăng nhập kính mờ ---- */}
        <div key={shakeKey} className={`w-full max-w-[380px] mt-9 hk-rise ${shakeKey ? 'hk-shake' : ''}`} style={{ animationDelay: shakeKey ? '0s' : '0.2s' }}>
          {/* Viền bạc phản chiếu (gradient border) */}
          <div className="relative rounded-[26px] p-px bg-gradient-to-br from-slate-200/50 via-slate-500/15 to-slate-300/30 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]">
            <div className="relative overflow-hidden rounded-[25px] bg-slate-900/70 backdrop-blur-xl px-6 py-7">
              {/* Ánh phản chiếu kính phía trên */}
              <span className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[140%] h-40 rounded-[100%] bg-white/[0.06]" />

              <div className="relative text-center mb-6">
                <h2 className="hk-serif text-[19px] sm:text-[21px] font-semibold tracking-wide text-slate-50 whitespace-nowrap">
                  M HOTEL <span className="text-slate-500 font-normal">-</span> HK OPERATION
                </h2>
                <p className="mt-1.5 text-[13px] text-slate-400">Vui lòng nhập mật khẩu để đăng nhập</p>
              </div>

              <form onSubmit={handleSubmit} className="relative space-y-4">
                <div className="group relative flex items-center gap-3 rounded-2xl border border-slate-600/60 bg-slate-950/50 px-4 py-3.5 transition-all duration-300 focus-within:border-slate-300/70 focus-within:bg-slate-950/70 focus-within:shadow-[0_0_0_4px_rgba(203,213,225,0.10),0_0_24px_rgba(203,213,225,0.12)]">
                  <Lock className="w-[18px] h-[18px] text-slate-400 group-focus-within:text-slate-200 transition-colors flex-shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                    placeholder="Mật khẩu"
                    autoFocus
                    autoComplete="current-password"
                    className="flex-1 min-w-0 bg-transparent text-[15px] text-slate-100 placeholder:text-slate-500 outline-none tracking-wide"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="-mr-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition"
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-[12.5px] font-medium text-rose-200">
                    <AlertCircle className="w-4 h-4 mt-px flex-shrink-0" /> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="hk-btn group relative w-full overflow-hidden rounded-2xl py-4 text-[15px] font-extrabold tracking-[0.18em] text-slate-900 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-10px_rgba(203,213,225,0.55)] active:translate-y-0 active:scale-[0.985] disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  <span className="hk-btn-shine" />
                  <span className="relative flex items-center justify-center gap-2.5">
                    {loading ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <LogIn className="w-[18px] h-[18px]" strokeWidth={2.5} />}
                    {loading ? 'ĐANG KIỂM TRA...' : 'ĐĂNG NHẬP'}
                  </span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 pb-6 pt-2 text-center hk-rise" style={{ animationDelay: '0.35s' }}>
        <p className="text-[11.5px] tracking-wider text-slate-500">© M Hotel. All rights reserved.</p>
      </footer>
    </div>
  );
}

/* ------------------------- Biểu tượng & trang trí ------------------------- */

/** Huy hiệu khách sạn: vương miện + toà nhà mái vòm cổ điển, nét bạch kim (không dùng icon chìa khoá) */
function HotelCrest({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id="hkPlat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="55%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
      </defs>
      <g stroke="url(#hkPlat)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {/* Vương miện */}
        <path d="M22 15l3.5 4 6.5-6 6.5 6 3.5-4v6H22z" fill="url(#hkPlat)" fillOpacity="0.18" />
        {/* Mái vòm */}
        <path d="M16 31c0-6.5 7.2-10 16-10s16 3.5 16 10" />
        <path d="M14 31h36" />
        {/* Cột */}
        <path d="M19 31v15M25.5 31v15M38.5 31v15M45 31v15" />
        {/* Cửa vòm chính */}
        <path d="M29 46v-7a3 3 0 016 0v7" />
        {/* Bậc thềm */}
        <path d="M14 46h36M11 50h42" />
      </g>
      <text x="32" y="30" textAnchor="middle" fontSize="7" fontWeight="700" fill="url(#hkPlat)" fontFamily="Cormorant Garamond, Georgia, serif">M</text>
    </svg>
  );
}

/** Đường nét mặt tiền khách sạn cao tầng (rất mờ) ở đáy nền */
function HotelSkyline({ className }: { className?: string }) {
  const windows: JSX.Element[] = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 8; c++) {
    windows.push(<rect key={`${r}-${c}`} x={300 + c * 20} y={70 + r * 26} width="9" height="13" rx="1" />);
  }
  return (
    <svg viewBox="0 0 760 360" className={className} fill="none" stroke="#e2e8f0" strokeWidth="1.2" aria-hidden>
      {/* Toà trung tâm */}
      <path d="M290 360V60h180v300" />
      <path d="M280 60h200M300 40h160l-20-22H320z" />
      <g fill="#e2e8f0" stroke="none" opacity="0.6">{windows}</g>
      {/* Sảnh vòm */}
      <path d="M345 360v-40a35 35 0 0170 0v40" />
      {/* Hai cánh thấp hơn */}
      <path d="M110 360V170h180M470 170h180v190" />
      <path d="M100 170h190M470 170h190" />
      {[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4, 5].map((c) => (
        <g key={`w${r}${c}`}>
          <rect x={128 + c * 26} y={190 + r * 30} width="10" height="14" rx="1" />
          <rect x={490 + c * 26} y={190 + r * 30} width="10" height="14" rx="1" />
        </g>
      )))}
      {/* Mặt đất */}
      <path d="M0 359h760" />
    </svg>
  );
}

const DAMASK_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Cg fill='none' stroke='%23e2e8f0' stroke-width='1'%3E%3Cpath d='M32 6c6 8 6 14 0 20-6-6-6-12 0-20zM32 38c6 8 6 14 0 20-6-6-6-12 0-20zM6 32c8-6 14-6 20 0-6 6-12 6-20 0zM38 32c8-6 14-6 20 0-6 6-12 6-20 0z'/%3E%3Ccircle cx='32' cy='32' r='3'/%3E%3C/g%3E%3C/svg%3E\")";

const SPARKLES = [
  { x: '12%', y: '14%', size: 3, delay: '0s', dur: '4.5s' },
  { x: '84%', y: '10%', size: 2, delay: '1.2s', dur: '5s' },
  { x: '72%', y: '28%', size: 3, delay: '2.4s', dur: '4s' },
  { x: '22%', y: '36%', size: 2, delay: '0.8s', dur: '5.5s' },
  { x: '90%', y: '46%', size: 2, delay: '3s', dur: '4.2s' },
  { x: '6%', y: '58%', size: 3, delay: '1.8s', dur: '5s' },
  { x: '60%', y: '6%', size: 2, delay: '2.8s', dur: '6s' },
  { x: '38%', y: '20%', size: 2, delay: '3.6s', dur: '4.8s' },
];

const LOGIN_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&display=swap');
.hk-login .hk-serif { font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, 'Times New Roman', serif; }

/* Chữ M HOTEL: bạch kim + vệt sáng lướt qua */
.hk-login .hk-brand {
  background: linear-gradient(100deg, #94a3b8 0%, #f8fafc 22%, #cbd5e1 40%, #ffffff 50%, #cbd5e1 60%, #f1f5f9 78%, #94a3b8 100%);
  background-size: 250% 100%;
  -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: hkBrandShine 6s ease-in-out infinite;
  filter: drop-shadow(0 4px 18px rgba(203,213,225,0.18));
}
@keyframes hkBrandShine { 0%,100% { background-position: 100% 0; } 50% { background-position: 0% 0; } }

/* Vòng bạc quanh huy hiệu */
.hk-login .hk-ring {
  background: conic-gradient(from 0deg, rgba(226,232,240,0.05), rgba(248,250,252,0.85), rgba(148,163,184,0.15), rgba(226,232,240,0.6), rgba(226,232,240,0.05));
  animation: hkSpin 9s linear infinite;
}
@keyframes hkSpin { to { transform: rotate(360deg); } }

/* Quầng sáng trôi */
.hk-login .hk-aurora { position: absolute; border-radius: 9999px; filter: blur(70px); pointer-events: none; }
.hk-login .hk-aurora-1 { width: 340px; height: 340px; top: -110px; left: -90px; background: rgba(148,163,184,0.28); animation: hkDrift1 16s ease-in-out infinite; }
.hk-login .hk-aurora-2 { width: 300px; height: 300px; top: 30%; right: -120px; background: rgba(100,116,139,0.30); animation: hkDrift2 19s ease-in-out infinite; }
.hk-login .hk-aurora-3 { width: 260px; height: 260px; bottom: 6%; left: 10%; background: rgba(203,213,225,0.12); animation: hkDrift1 22s ease-in-out infinite reverse; }
@keyframes hkDrift1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(60px,40px) scale(1.15); } }
@keyframes hkDrift2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-50px,-30px) scale(1.1); } }

/* Đốm sáng lấp lánh */
.hk-login .hk-sparkle { position: absolute; border-radius: 9999px; background: #f8fafc; box-shadow: 0 0 8px 2px rgba(248,250,252,0.6); opacity: 0; animation-name: hkTwinkle; animation-iteration-count: infinite; animation-timing-function: ease-in-out; pointer-events: none; }
@keyframes hkTwinkle { 0%,100% { opacity: 0; transform: scale(0.6); } 50% { opacity: 0.9; transform: scale(1); } }

/* Nút bạc + vệt sáng */
.hk-login .hk-btn {
  background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 38%, #cbd5e1 62%, #a8b4c4 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -2px 0 rgba(71,85,105,0.25), 0 8px 22px -10px rgba(203,213,225,0.45);
}
.hk-login .hk-btn-shine {
  position: absolute; top: 0; bottom: 0; left: -40%; width: 35%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent);
  transform: skewX(-20deg);
  animation: hkBtnShine 3.6s ease-in-out infinite;
}
@keyframes hkBtnShine { 0% { left: -40%; } 55%,100% { left: 130%; } }

/* Xuất hiện từ dưới lên */
.hk-login .hk-rise { opacity: 0; animation: hkRise 0.8s cubic-bezier(.2,.8,.2,1) forwards; }
@keyframes hkRise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }

/* Rung nhẹ khi sai mật khẩu */
.hk-login .hk-shake { opacity: 1; animation: hkShake 0.45s ease-in-out; }
@keyframes hkShake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(7px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(3px); } }

@media (prefers-reduced-motion: reduce) {
  .hk-login *, .hk-login *::before, .hk-login *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; }
  .hk-login .hk-rise { opacity: 1; }
}
`;
