'use client';

import { useEffect, useState } from 'react';
import { Power } from 'lucide-react';

/* =========================================================================
   MÁY CHIẾU cho bảng đen "Ghi chú dịch vụ / Special" (module Noted Board).
   - Bấm ON: máy chiếu treo trần sáng đèn, phát chùm sáng, màn chiếu cuộn xuống -> hiện bảng.
   - Bấm OFF: màn chiếu cuộn lên -> bảng ẩn đi.
   - Ghi nhớ bật/tắt RIÊNG trên từng máy (localStorage).
   ========================================================================= */
const STORE_KEY = 'hk_noteboard_projector';

export default function ProjectorBoard({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    try { setOn(localStorage.getItem(STORE_KEY) === '1'); } catch { /* bỏ qua */ }
  }, []);

  const toggle = () => {
    setOn((v) => {
      const next = !v;
      try { localStorage.setItem(STORE_KEY, next ? '1' : '0'); } catch { /* bỏ qua */ }
      return next;
    });
  };

  return (
    <div className={`nbp ${on ? 'nbp-on' : ''}`}>
      <style>{CSS}</style>

      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] font-extrabold text-slate-700">Bảng ghi chú dịch vụ</div>
        <button type="button" role="switch" aria-checked={on} onClick={toggle} className="flex items-center gap-2.5" aria-label="Bật / tắt máy chiếu">
          <span className="text-xs font-bold text-slate-500">{on ? 'Máy chiếu đang BẬT' : 'Máy chiếu đang TẮT'}</span>
          <span className="nbp-sw">
            <span className="nbp-lbl" style={{ right: 12, color: '#475569' }}>OFF</span>
            <span className="nbp-lbl" style={{ left: 12, color: '#fff' }}>ON</span>
            <span className="nbp-knob"><Power className="w-3.5 h-3.5 text-slate-600" strokeWidth={2.75} /></span>
          </span>
        </button>
      </div>

      {/* Máy chiếu treo trần */}
      <div className="relative flex flex-col items-center pt-7">
        <div className="w-[60%] h-[3px] rounded bg-slate-300 absolute top-0" />
        <div className="nbp-proj">
          <span className="nbp-lens" />
          <span className="nbp-led" />
          <span className="nbp-vent"><i /><i /><i /><i /></span>
        </div>
        <div className="nbp-beam" />
      </div>

      {/* Màn chiếu cuộn */}
      <div className="mt-[64px] px-1 sm:px-4">
        <div className="nbp-roller" />
        {/* Cuộn mượt cả 2 chiều: lưới 0fr -> 1fr (chiều cao tự theo nội dung bảng) */}
        <div className="nbp-screen mx-2 sm:mx-3">
          <div className="nbp-screen-inner">
            <div className="-mt-[4px] rounded-b-xl bg-gradient-to-b from-slate-50 to-white border border-t-0 border-slate-200 shadow-[0_20px_40px_-25px_rgba(15,23,42,.6)] p-2.5 sm:p-3">
              <div className="nbp-content">{children}</div>
            </div>
          </div>
        </div>
        <div className="nbp-pull" />
      </div>

      {!on && <p className="text-center text-xs text-slate-400 mt-4">Bảng đang cuộn lên. Bật ON để chiếu bảng ghi chú.</p>}
    </div>
  );
}

const CSS = `
.nbp-proj{position:relative;width:132px;height:46px;border-radius:14px;background:linear-gradient(180deg,#f8fafc 0%,#d9dee6 55%,#b8bfca 100%);box-shadow:0 10px 18px -10px rgba(15,23,42,.6),inset 0 1px 0 #fff}
.nbp-proj::before{content:"";position:absolute;left:50%;top:-26px;width:6px;height:26px;transform:translateX(-50%);background:linear-gradient(90deg,#94a3b8,#cbd5e1,#94a3b8);border-radius:2px}
.nbp-vent{position:absolute;right:14px;top:14px;display:flex;gap:3px}
.nbp-vent i{width:3px;height:18px;border-radius:2px;background:#9aa3b0}
.nbp-lens{position:absolute;left:18px;top:7px;width:32px;height:32px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#475569 0%,#0f172a 60%,#020617 100%);box-shadow:0 0 0 4px #cbd5e1,inset 0 2px 4px rgba(255,255,255,.25);transition:box-shadow .5s,background .5s}
.nbp-on .nbp-lens{background:radial-gradient(circle at 45% 40%,#fffbe6 0%,#fde68a 35%,#f59e0b 75%,#78350f 100%);box-shadow:0 0 0 4px #cbd5e1,0 0 18px 6px rgba(253,230,138,.85)}
.nbp-led{position:absolute;left:62px;top:19px;width:7px;height:7px;border-radius:50%;background:#64748b;transition:.3s}
.nbp-on .nbp-led{background:#22c55e;box-shadow:0 0 8px 2px rgba(34,197,94,.8)}
.nbp-beam{position:absolute;left:50%;top:40px;width:min(92%,860px);height:70px;transform:translateX(-50%);clip-path:polygon(46% 0,54% 0,100% 100%,0 100%);background:linear-gradient(180deg,rgba(254,243,199,.85),rgba(254,243,199,.05));opacity:0;transition:opacity .45s ease;pointer-events:none;filter:blur(1px)}
.nbp-on .nbp-beam{opacity:1;animation:nbpFlicker 3.5s infinite}
@keyframes nbpFlicker{0%,100%{opacity:.95}48%{opacity:.8}50%{opacity:1}52%{opacity:.85}}
.nbp-roller{height:14px;border-radius:8px;background:linear-gradient(180deg,#e2e8f0,#94a3b8 60%,#64748b);box-shadow:0 3px 6px rgba(15,23,42,.35);position:relative;z-index:2}
.nbp-roller::before,.nbp-roller::after{content:"";position:absolute;top:-2px;width:16px;height:18px;border-radius:5px;background:#475569}
.nbp-roller::before{left:-6px}.nbp-roller::after{right:-6px}
.nbp-screen{display:grid;grid-template-rows:0fr;transition:grid-template-rows .9s cubic-bezier(.3,.9,.3,1)}
.nbp-on .nbp-screen{grid-template-rows:1fr;transition-delay:.25s}
.nbp-screen-inner{min-height:0;overflow:hidden}
.nbp-content{opacity:0;transition:opacity .3s}
.nbp-on .nbp-content{opacity:1;transition:opacity .5s .9s}
.nbp-pull{width:34px;height:10px;border-radius:0 0 8px 8px;background:#334155;margin:-1px auto 0}
.nbp-sw{position:relative;display:inline-block;width:86px;height:38px;border-radius:999px;background:#cbd5e1;transition:.3s;box-shadow:inset 0 2px 5px rgba(15,23,42,.25)}
.nbp-knob{position:absolute;top:4px;left:4px;width:30px;height:30px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(15,23,42,.35);transition:transform .3s;display:flex;align-items:center;justify-content:center}
.nbp-lbl{position:absolute;top:50%;transform:translateY(-50%);font-size:11px;font-weight:900;letter-spacing:.1em}
.nbp-on .nbp-sw{background:linear-gradient(90deg,#16a34a,#22c55e)}
.nbp-on .nbp-knob{transform:translateX(48px)}
.nbp-chalk{font-family:'Patrick Hand','Comic Sans MS',cursive}
@media (prefers-reduced-motion:reduce){.nbp *{transition:none!important;animation:none!important}}
`;
