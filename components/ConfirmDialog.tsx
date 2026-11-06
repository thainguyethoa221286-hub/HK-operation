'use client';

import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/* =========================================================
   BẢNG XÁC NHẬN giữa màn hình (thay hộp "trang web cho biết" mặc định của trình duyệt).
   Dùng cho thao tác quan trọng / không hoàn tác được (VD Xoá dữ liệu phân công).
   ========================================================= */
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Các dòng giải thích điều sẽ xảy ra */
  points?: string[];
  /** Dòng cảnh báo cuối (VD "Không thể hoàn tác") */
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open, title, points = [], warning, confirmLabel = 'Đồng ý', cancelLabel = 'Huỷ',
  tone = 'danger', busy, onConfirm, onCancel,
}: ConfirmDialogProps) {
  // Phím Esc để đóng
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  const danger = tone === 'danger';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[3px]" onClick={onCancel}>
      <style>{`@keyframes hkPop{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}`}</style>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[400px] rounded-3xl bg-white shadow-[0_30px_70px_-20px_rgba(15,23,42,0.55)] overflow-hidden"
        style={{ animation: 'hkPop .18s ease-out' }}
      >
        <div className={`h-1.5 ${danger ? 'bg-gradient-to-r from-red-500 via-rose-500 to-orange-400' : 'bg-gradient-to-r from-blue-600 to-sky-400'}`} />
        <button type="button" onClick={onCancel} aria-label="Đóng" className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 pt-6 pb-5 text-center">
          <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-3.5 ${danger ? 'bg-red-50 text-red-600 ring-8 ring-red-50/60' : 'bg-blue-50 text-blue-600 ring-8 ring-blue-50/60'}`}>
            <AlertTriangle className="w-7 h-7" strokeWidth={2.2} />
          </div>
          <h3 className="text-[18px] font-extrabold text-slate-800 leading-snug">{title}</h3>

          {points.length > 0 && (
            <ul className="mt-3.5 text-left rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 space-y-1.5">
              {points.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-slate-600 leading-snug">
                  <span className={`mt-[6px] w-1.5 h-1.5 rounded-full flex-shrink-0 ${danger ? 'bg-red-400' : 'bg-blue-400'}`} />
                  {p}
                </li>
              ))}
            </ul>
          )}

          {warning && (
            <div className={`mt-3 text-[12.5px] font-bold ${danger ? 'text-red-600' : 'text-blue-700'}`}>⚠ {warning}</div>
          )}
        </div>

        <div className="px-6 pb-6 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl py-3 text-[13.5px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl py-3 text-[13.5px] font-extrabold text-white transition active:scale-[.98] disabled:opacity-50 ${
              danger
                ? 'bg-gradient-to-r from-red-600 to-rose-500 shadow-[0_8px_18px_-8px_rgba(220,38,38,0.8)]'
                : 'bg-gradient-to-r from-blue-600 to-sky-500 shadow-[0_8px_18px_-8px_rgba(37,99,235,0.8)]'
            }`}
          >
            {busy ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
