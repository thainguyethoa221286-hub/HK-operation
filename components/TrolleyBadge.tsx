/* =========================================================
   XE ĐẨY (TROLLEY) — biểu tượng xe dọn phòng + số xe (01, 02, 03, 04...)
   Số xe lấy theo mã nhóm phân công: N1 -> 01, N2 -> 02... (TrolleyCode được gán tự động
   khi giám sát gán phòng ở màn Phân công). Ca chiều (PM Shift) hiện "PM".
   ========================================================= */

/** "N1" -> "01", "N12" -> "12", "PM" -> "PM" */
export function trolleyNo(code: string): string {
  if (!code) return '';
  if (code === 'PM') return 'PM';
  const digits = code.replace(/\D/g, '');
  return digits ? digits.padStart(2, '0') : code;
}

/** Biểu tượng xe đẩy dọn phòng (khung kệ + tay đẩy + 2 bánh) */
export function TrolleyIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 22" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* tay đẩy */}
      <path d="M2 3h2.5v12" />
      {/* thân xe 2 tầng kệ */}
      <rect x="6.5" y="5" width="14.5" height="11" rx="1.5" />
      <path d="M6.5 10.5h14.5" />
      {/* đồ trên kệ (khăn / chai) */}
      <path d="M9.5 5V3.2M13 5V2.6M16.5 5V3.4" />
      {/* bánh xe */}
      <circle cx="9.5" cy="19" r="1.8" />
      <circle cx="18" cy="19" r="1.8" />
    </svg>
  );
}

/** Huy hiệu XE + SỐ XE — dùng ở màn Phân công (đầu mỗi nhóm) và màn Nhiệm vụ (cạnh tên nhân viên) */
export default function TrolleyBadge({ code, size = 'sm' }: { code: string; size?: 'sm' | 'md' }) {
  const no = trolleyNo(code);
  if (!no) return null;
  const md = size === 'md';
  return (
    <span
      title={`Xe đẩy số ${no}`}
      className={`inline-flex items-center gap-1 rounded-md border font-extrabold tabular-nums leading-none flex-shrink-0 bg-amber-50 text-amber-800 border-amber-300 ${
        md ? 'text-[12px] px-2 py-1' : 'text-[11px] px-1.5 py-[3px]'
      }`}
    >
      <TrolleyIcon className={md ? 'w-[18px] h-[16px]' : 'w-[15px] h-[13px]'} />
      {no}
    </span>
  );
}
