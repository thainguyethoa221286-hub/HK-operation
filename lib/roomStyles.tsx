import type { ReactNode } from 'react';
import { PlaneLanding, PlaneTakeoff, BedDouble, Bell, PenTool, Wrench, BedSingle, Baby, Wine, Home, DoorOpen, Sparkles, CalendarRange, CalendarHeart, Star } from 'lucide-react';
import type { HkStatus, FoStatus } from './types';

/* =========================================================
   MỤC 2 — QUY TẮC MÀU SẮC THẺ PHÒNG (dựa trên HK Status)
   Viền đầy đủ (border-2) + nền đổi theo từng trạng thái.
   ========================================================= */
export const HK_STYLE: Record<HkStatus, { border: string; bg: string }> = {
  'Phòng dơ': { border: 'border-red-500', bg: 'bg-white' },
  'Phòng đang dọn': { border: 'border-blue-500', bg: 'bg-blue-100' },
  'Phòng sạch': { border: 'border-amber-400', bg: 'bg-white' },
  'Đã kiểm tra': { border: 'border-emerald-500', bg: 'bg-white' },
  'Phòng sửa chữa (OOO)': { border: 'border-slate-400', bg: 'bg-white' },
};

/** Khi Admin/Giám sát bấm [KIỂM PHÒNG] — ưu tiên cao nhất, đè lên mọi màu trạng thái khác.
 *  Khi bấm [NHẢ PHÒNG]/[HOÀN THÀNH] để kiểm xong, trả lại đúng màu "Đã kiểm tra" (xanh lá, nền trắng). */
export const INSPECTING_STYLE = { border: 'border-purple-500', bg: 'bg-purple-100' };

/** Nhãn chữ ngắn gọn cho trạng thái khách (FoStatus) — dùng cạnh icon ở chân thẻ phòng */
export const FO_STATUS_LABEL: Record<FoStatus, string> = {
  Occupied: 'Occupied',
  'Due out': 'Due out',
  Arrival: 'Arrival',
  'Due out/ARR': 'Back to Back',
  Vacant: 'Vacant',
};

/**
 * Trả về class border + background cho 1 phòng.
 * "Đang kiểm phòng" (tím) ưu tiên cao nhất, đè lên mọi trạng thái HK Status khác.
 */
export function getRoomCardStyle(hkStatus: HkStatus, isInspecting: boolean) {
  if (isInspecting) return INSPECTING_STYLE;
  return HK_STYLE[hkStatus] ?? HK_STYLE['Phòng dơ'];
}

/* =========================================================
   MỤC 1 — QUY TẮC ICON THEO FO STATUS (Lucide React)
   ========================================================= */
export function FoStatusIcon({ status }: { status: FoStatus }) {
  const cls = 'w-[18px] h-[18px] text-slate-700 stroke-[2.25]';
  switch (status) {
    case 'Arrival':
      return <PlaneLanding className={cls} />;
    case 'Due out':
      return <PlaneTakeoff className={cls} />;
    case 'Due out/ARR':
      // Khách ra & vào trong ngày — kết hợp cả 2 icon máy bay
      return (
        <span className="flex items-center -space-x-0.5">
          <PlaneTakeoff className={cls} />
          <PlaneLanding className={cls} />
        </span>
      );
    case 'Occupied':
      return <BedDouble className={cls} />;
    case 'Vacant':
      return <Home className={cls} />;
    default:
      return null;
  }
}


/* =========================================================
   MỤC 3 — ICON HUY HIỆU THEO NÚT ĐIỀU PHỐI (Flags)
   ========================================================= */
export function FlagBadgeIcons({ flags }: { flags: string }) {
  const list = (flags || '').split(',').map((f) => f.trim()).filter(Boolean);
  if (!list.includes('SuaChua')) return null;
  return (
    <div className="flex items-center gap-1">
      <Wrench className="w-3.5 h-3.5 text-slate-600" aria-label="Sửa chữa" />
    </div>
  );
}

/** Badge NỔI BẬT cho cờ Rush (khẩn cấp, đón khách gấp) và MKR (khách yêu cầu dọn) —
 *  tách riêng khỏi FlagBadgeIcons (icon nhỏ) vì cần thu hút sự chú ý mạnh của nhân viên ca trực. */
export function PriorityFlagBadges({ flags }: { flags: string }) {
  const list = (flags || '').split(',').map((f) => f.trim()).filter(Boolean);
  const hasRush = list.includes('CayBac');
  const hasMkr = list.includes('TrangDiem');
  if (!hasRush && !hasMkr) return null;
  return (
    <div className="flex items-center gap-1">
      {hasRush && (
        <span className="bg-orange-600 text-white font-extrabold px-1.5 py-[2px] rounded text-[8px] animate-pulse">
          RUSH
        </span>
      )}
      {hasMkr && (
        <span className="bg-blue-600 text-white font-bold px-1.5 py-[2px] rounded text-[8px] flex items-center gap-0.5">
          <Sparkles className="w-2.5 h-2.5" /> MKR
        </span>
      )}
    </div>
  );
}

/* =========================================================
   NOTE CLEANER — lớp lọc dự phòng, chỉ giữ lại đúng 5 mã hợp lệ
   (EB, BBC, HON, DND, RF) trong ghi chú, loại bỏ mọi rác khác
   (tên khách, ngày tháng, số phòng...) dù AI có lỡ chèn vào.
   Dùng chung cho cả Frontend (RoomCard/AssignScreen) và Backend
   (route.ts sync-pdf) làm lớp phòng vệ cuối cùng.
   ========================================================= */
/** Gộp ghi chú AI (GhiChu) + ghi chú tay nhân viên (GhiChuNV) thành 1 chuỗi
 *  để quét mã DND/RF/EB/BBC/HON từ cả 2 nguồn — dùng cho mọi nơi hiện badge trên thẻ phòng. */
export function combineNotes(ghiChu?: string | null, ghiChuNV?: string | null, ghiChuAdmin?: string | null): string {
  return [ghiChu, ghiChuNV, ghiChuAdmin].filter(Boolean).join(' ');
}

export const ALLOWED_NOTE_CODES = ['EB', 'BBC', 'HON', 'DND', 'RF', 'LSG', 'BC'] as const;

export function cleanNote(rawNote?: string | null): string {
  if (!rawNote) return '';
  const foundCodes = ALLOWED_NOTE_CODES.filter((code) =>
    new RegExp(`\\b${code}\\b`, 'i').test(rawNote)
  );
  return foundCodes.join(', ');
}

/** Gắn thêm 1 mã (VD "DND") vào chuỗi ghi chú nếu chưa có, giữ nguyên phần chữ khác trong ghi chú */
export function addNoteCode(note: string, code: string): string {
  if (new RegExp(`\\b${code}\\b`, 'i').test(note || '')) return note || '';
  return note ? `${note}, ${code}` : code;
}

/** Gỡ 1 mã (VD "DND") khỏi chuỗi ghi chú, giữ nguyên phần chữ khác trong ghi chú */
export function removeNoteCode(note: string, code: string): string {
  return (note || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s.toUpperCase() !== code.toUpperCase())
    .join(', ');
}

/** Tách phần CHỮ TỰ DO khỏi các mã hệ thống (EB/BBC/HON/DND/RF) trong ghi chú —
 *  dùng để ô "Thêm ghi chú" trong Task Card chỉ hiện/sửa phần chữ tự do,
 *  không hiện trôi nổi các mã đã có badge riêng ở header thẻ phòng. */
export function stripCodesFromNote(note: string): string {
  return (note || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !ALLOWED_NOTE_CODES.some((code) => code.toUpperCase() === s.toUpperCase()))
    .join(', ');
}

/** Lấy riêng các mã hệ thống (EB/BBC/HON/DND/RF/LSG) đang có trong ghi chú, dạng mảng chuỗi hoa.
 *  SỬA LỖI: trước đây chỉ split(',') rồi so khớp CHÍNH XÁC từng mảnh — nên khi ReportScreen gọi
 *  combineNotes(GhiChu, GhiChuNV, GhiChuAdmin) (nối 3 trường bằng DẤU CÁCH, không phải dấu phẩy),
 *  một chuỗi như "RF LSG" (RF từ GhiChuNV + LSG từ GhiChuAdmin ghép lại) không khớp "RF" hay "LSG"
 *  chính xác nữa -> badge RF biến mất khỏi Báo cáo dù nhân viên đã bấm RF (trường hợp phòng 206: có
 *  thêm ghi chú Giám sát "LSG" khiến chuỗi gộp không còn tách rời bằng dấu phẩy). Nay dùng regex
 *  \b...\b (giống cleanNote) để nhận diện từng mã ĐỘC LẬP VỊ TRÍ trong toàn chuỗi, không phụ thuộc
 *  dấu phân cách. */
export function extractNoteCodes(note: string): string[] {
  if (!note) return [];
  return ALLOWED_NOTE_CODES.filter((code) => new RegExp(`\\b${code}\\b`, 'i').test(note));
}

/* =========================================================
   MỤC 3 — NHẬN DIỆN DND / RF (Refuse) TRONG GHI CHÚ
   Dựa trên cleanNote() để tránh bắt nhầm chuỗi con (VD "SUPERB" chứa "EB")
   ========================================================= */
export function hasDndOrRf(note: string): { dnd: boolean; rf: boolean } {
  if (!note) return { dnd: false, rf: false };
  const codes = cleanNote(note);
  return {
    dnd: /\bDND\b/i.test(codes),
    rf: /\bRF\b/i.test(codes),
  };
}

/** Badge thẻ treo DND (đỏ) / RF (tím đậm) — dùng inline trực tiếp trong RoomCard/AssignScreen,
 *  hàm này giữ lại để tái sử dụng nếu cần render rời (không có móc treo). */
/** Thẻ treo cửa (Door Hanger) cho DND/RF trên góc thẻ phòng — mô phỏng bảng treo thực tế
 *  ở tay cầm cửa: có 1 lỗ tròn nhỏ phía trên (chỗ xỏ vào tay nắm cửa) + thân thẻ màu đậm bên dưới. */
export function DoorHangerTag({ label, colorCls }: { label: string; colorCls: string }) {
  return (
    <div className="relative inline-flex flex-col items-center flex-shrink-0">
      <div className="w-[7px] h-[7px] rounded-full bg-white border border-slate-300 z-10 -mb-[3px]" />
      <div className={`px-1.5 pt-[5px] pb-[2px] rounded-[3px] text-[8px] font-extrabold text-white shadow-sm leading-none ${colorCls}`}>
        {label}
      </div>
    </div>
  );
}

export function DndRfBadge({ note }: { note: string }) {
  const { dnd, rf } = hasDndOrRf(note);
  if (!dnd && !rf) return null;
  return (
    <div className="flex items-center gap-1">
      {dnd && <span className="bg-red-600 text-white font-extrabold px-1.5 py-[1px] rounded-sm text-[9px]">DND</span>}
      {rf && <span className="bg-purple-800 text-white font-extrabold px-1.5 py-[1px] rounded-sm text-[9px]">RF</span>}
    </div>
  );
}

/* =========================================================
   MỤC 5 — LSG (LONG STAY GUEST): khách lưu trú dài hạn.
   Nhân viên có thể TỰ gõ mã "LSG" vào ghi chú (giống EB/BBC/HON) để gắn icon ngay.
   NGOÀI RA, hệ thống TỰ ĐỘNG tính LSG khi số đêm lưu trú (từ NgayO, dạng "DD/MM-DD/MM")
   LỚN HƠN 6 đêm — không cần nhân viên tự gõ, dù ghi chú đang trống.
   ========================================================= */
/** Tính số đêm lưu trú từ NgayO (dạng "DD/MM-DD/MM"). Trả về null nếu NgayO chỉ có 1 mốc ngày
 *  (chưa biết ngày trả phòng) hoặc rỗng/không đọc được — khi đó KHÔNG thể tự động tính LSG. */
export function calcStayNights(ngayO?: string | null): number | null {
  if (!ngayO) return null;
  const parts = String(ngayO).trim().split('-').map((p) => p.trim());
  if (parts.length !== 2) return null;
  const parseDDMM = (s: string): { d: number; m: number } | null => {
    const m = s.match(/^(\d{2})\/(\d{2})$/);
    return m ? { d: Number(m[1]), m: Number(m[2]) } : null;
  };
  const arr = parseDDMM(parts[0]);
  const dep = parseDDMM(parts[1]);
  if (!arr || !dep) return null;
  const year = new Date().getFullYear();
  const arrDate = new Date(year, arr.m - 1, arr.d);
  let depDate = new Date(year, dep.m - 1, dep.d);
  // Vắt qua năm mới (VD Arrival 28/12, Departure 03/01) -> cộng thêm 1 năm cho Departure
  if (depDate.getTime() < arrDate.getTime()) depDate = new Date(year + 1, dep.m - 1, dep.d);
  const nights = Math.round((depDate.getTime() - arrDate.getTime()) / 86400000);
  return nights >= 0 ? nights : null;
}

/** true nếu phòng được tính là LSG — do nhân viên tự gõ mã "LSG" trong ghi chú, HOẶC tự động
 *  (mặc định) khi số đêm lưu trú tính từ NgayO lớn hơn 6 đêm. */
export function isLongStay(note: string, ngayO?: string | null): boolean {
  if (/\bLSG\b/i.test(cleanNote(note))) return true;
  const nights = calcStayNights(ngayO);
  return nights !== null && nights > 6;
}

/** Lấy ngày Check-in (vế đầu của NgayO, dạng "DD/MM") ra Date thật — dùng làm mốc tính "số ngày đã
 *  ở" và "ngày thay ga kế tiếp". Nếu ngày tính ra ở quá xa trong TƯƠNG LAI (>60 ngày, do vắt qua
 *  năm cũ/mới) thì tự lùi về năm trước. */
function parseArrivalDate(ngayO?: string | null): Date | null {
  if (!ngayO) return null;
  const first = String(ngayO).trim().split('-')[0].trim();
  const m = first.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const now = new Date();
  const date = new Date(now.getFullYear(), Number(m[2]) - 1, Number(m[1]));
  if (date.getTime() - now.getTime() > 60 * 86400000) date.setFullYear(date.getFullYear() - 1);
  return date;
}

/** Lấy ngày Check-out (vế sau của NgayO, dạng "DD/MM-DD/MM") ra Date thật — dùng để kiểm tra
 *  "khách trả phòng NGÀY MAI thì bỏ qua lịch thay ga hôm nay". Trả về null nếu NgayO chỉ có 1 mốc
 *  ngày (chưa biết ngày trả phòng) hoặc không đọc được. */
function parseDepartureDate(ngayO?: string | null): Date | null {
  if (!ngayO) return null;
  const parts = String(ngayO).trim().split('-').map((p) => p.trim());
  if (parts.length !== 2) return null;
  const m = parts[1].match(/^(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const arr = parseArrivalDate(ngayO);
  if (!arr) return null;
  const now = new Date();
  let date = new Date(now.getFullYear(), Number(m[2]) - 1, Number(m[1]));
  // Vắt qua năm mới (VD Check-in 28/12, Check-out 03/01) -> cộng thêm 1 năm cho ngày Check-out
  if (date.getTime() < arr.getTime()) date = new Date(now.getFullYear() + 1, Number(m[2]) - 1, Number(m[1]));
  return date;
}

/** Số ngày khách ĐÃ Ở tính tới hôm nay (không tính theo giờ, chỉ tính theo ngày lịch) — dùng hiện
 *  trong Tooltip badge LSG. Trả về null nếu không đọc được ngày Check-in từ NgayO. */
export function calcDaysStayed(ngayO?: string | null): number | null {
  const arr = parseArrivalDate(ngayO);
  if (!arr) return null;
  const now = new Date();
  const a = new Date(arr.getFullYear(), arr.getMonth(), arr.getDate()).getTime();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((t - a) / 86400000);
  return days >= 0 ? days : 0;
}

/** Quy tắc Chẵn/Lẻ CHO 1 NGÀY CỤ THỂ — true nếu `date` là ngày thay ga đúng chu kỳ, so với parity
 *  (chẵn/lẻ) của ngày Check-in.
 *
 *  XỬ LÝ RIÊNG tháng có 31 ngày: ngày 31 và ngày 01 tháng sau là 2 ngày LẺ liên tiếp (chỉ cách
 *  nhau đúng 1 ngày thật, không phải 2) — nếu cứ áp "ngày lẻ" máy móc sẽ thay ga 2 ngày liên tục,
 *  sai chu kỳ 2 ngày/lần. Nên khi khách Check-in ngày LẺ và hôm nay là ngày 01, mà tháng TRƯỚC có
 *  31 ngày (tức hôm qua là 31 — đã tính 1 lượt thay rồi) -> CHỦ ĐỘNG BỎ QUA ngày 01 này, dời lượt
 *  thay kế tiếp sang ngày 03 (đúng như yêu cầu). Khách Check-in ngày CHẴN không rơi vào trường hợp
 *  này (ngày chẵn lớn nhất trong tháng 31 ngày là 30, không liền kề ngày 01 tháng sau). */
function isLinenChangeDayByDate(date: Date, checkInIsEven: boolean): boolean {
  const day = date.getDate();
  const matchesParity = (day % 2 === 0) === checkInIsEven;
  if (!matchesParity) return false;
  if (day === 1 && !checkInIsEven) {
    const lastDayOfPrevMonth = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
    if (lastDayOfPrevMonth === 31) return false; // tháng trước có 31 ngày -> bỏ qua ngày 01, dời sang 03
  }
  return true;
}

/** Mục LSG — Lịch thay ga giường kế tiếp theo QUY TẮC CHẴN/LẺ: khách Check-in ngày CHẴN -> chỉ
 *  thay ga vào các ngày CHẴN trong tháng; Check-in ngày LẺ -> chỉ thay ga vào các ngày LẺ (có trừ
 *  hao đúng 1 lượt ở mốc 31->01 như isLinenChangeDayByDate mô tả). Trả về ngày GẦN NHẤT (có thể là
 *  hôm nay) khớp đúng chu kỳ đó, dạng "DD/MM". null nếu không tính được. */
export function calcNextLinenChangeDate(ngayO?: string | null): string | null {
  const arr = parseArrivalDate(ngayO);
  if (!arr) return null;
  const arrivalIsEven = arr.getDate() % 2 === 0;
  const today = new Date();
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = 0; i < 35; i++) {
    const check = new Date(cursor.getTime());
    check.setDate(check.getDate() + i);
    if (isLinenChangeDayByDate(check, arrivalIsEven)) {
      return `${String(check.getDate()).padStart(2, '0')}/${String(check.getMonth() + 1).padStart(2, '0')}`;
    }
  }
  return null;
}

/** Mục MỚI — Báo lịch Thay ga giường TỰ ĐỘNG ngay HÔM NAY cho 1 phòng cụ thể (icon ngôi sao kế
 *  bên số phòng).
 *
 *  ĐIỀU KIỆN TIÊN QUYẾT: chỉ áp dụng phòng đang Occupied (khách đang ở trong phòng) — phòng
 *  Vacant/Arrival/Due out/Due out-ARR/OOO KHÔNG BAO GIỜ hiện icon này, dù rơi đúng ngày chẵn/lẻ,
 *  vì không có khách đang ở để thay ga. Dựa theo ngày Check-in (vế đầu NgayO) so parity chẵn/lẻ
 *  với hôm nay, có xử lý đúng mốc 31->01 (xem isLinenChangeDayByDate).
 *
 *  BỎ QUA nếu khách trả phòng NGÀY MAI (chỉ còn 1 đêm nữa là Check-out) — thay ga hôm nay là thừa
 *  vì mai khách đã trả phòng, bộ phận buồng phòng sẽ dọn tổng vệ sinh lại từ đầu sau khi khách out.
 *  VD: Check-in 01, Check-out 04 -> theo chu kỳ lẻ thì ngày 03 đến lịch thay, nhưng 03 là NGÀY MAI
 *  của Check-out (04) -> BỎ QUA, không hiện icon ngôi sao ở ngày 03 nữa. */
export function checkLinenChange(room: { FoStatus: string; NgayO?: string | null }): boolean {
  if (room.FoStatus !== 'Occupied') return false;
  const arr = parseArrivalDate(room.NgayO);
  if (!arr) return false;
  const today = new Date();
  if (!isLinenChangeDayByDate(today, arr.getDate() % 2 === 0)) return false;

  const dep = parseDepartureDate(room.NgayO);
  if (dep) {
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
    const depDay = new Date(dep.getFullYear(), dep.getMonth(), dep.getDate()).getTime();
    if (depDay === tomorrow) return false;
  }
  return true;
}

/** Tooltip nổi khi hover — dùng chung cho ghim Ghi chú đặc biệt (Pin) và badge LSG trên Thẻ phòng. */
export function HoverTip({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <span className="relative inline-flex group/tip flex-shrink-0">
      {children}
      {/* Hiện XUỐNG DƯỚI + z-50 — tránh bị mép thẻ phòng phía trên che mất khi icon nằm sát đỉnh thẻ */}
      <span className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 w-48 rounded-lg bg-white border border-slate-300 shadow-xl p-2.5 text-xs font-semibold text-slate-700 opacity-0 group-hover/tip:opacity-100 transition-opacity text-center leading-snug">
        {tip}
      </span>
    </span>
  );
}

/** Badge NỔI BẬT riêng cho LSG (Long Stay Guest) trên Thẻ phòng — tách khỏi NoteIcons (icon nhỏ
 *  EB/BBC/HON) vì cần to, có chữ "LSG" và Tooltip chi tiết số ngày đã ở + lịch thay ga kế tiếp. */
export function LsgBadge({ note, ngayO }: { note: string; ngayO?: string | null }) {
  if (!isLongStay(note, ngayO)) return null;
  const daysStayed = calcDaysStayed(ngayO);
  const nextLinen = calcNextLinenChangeDate(ngayO);
  const tip = `Khách Long Stay - Số ngày đã ở: ${daysStayed ?? '—'} ngày | Lịch thay ga giường tiếp theo: ${nextLinen || '—'}`;
  return (
    <HoverTip tip={tip}>
      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 cursor-default whitespace-nowrap">
        <CalendarHeart className="w-3 h-3" /> LSG
      </span>
    </HoverTip>
  );
}

/* =========================================================
   MỤC MỚI — BÁO LỊCH THAY GA GIƯỜNG (STAR LINEN CHANGE INDICATOR)
   Icon đặt KẾ BÊN SỐ PHÒNG khi hôm nay đúng lịch thay ga, CHỈ áp dụng phòng Occupied (xem
   checkLinenChange() ở trên). Dùng icon Star (ngôi sao vàng) từ lucide-react, tô màu
   text-amber-400 fill-amber-400 — thay thế hoàn toàn icon cái gối tự vẽ trước đây.
   ========================================================= */

/** Badge ĐẦY ĐỦ (nền + icon sao vàng + Tooltip) — dùng ở Thẻ công việc nhân viên (RoomTaskCard) và
 *  Khung Pop-up Chi tiết (RoomModal/RoomTaskModal), nơi có đủ chỗ và Tooltip không bị che. */
export function LinenChangeBadge({ room }: { room: { FoStatus: string; NgayO?: string | null } }) {
  if (!checkLinenChange(room)) return null;
  const checkInShort = formatDateShort(room.NgayO);
  return (
    <HoverTip tip={`Hôm nay đến lịch thay ga/gối (Check-in ngày: ${checkInShort || '—'})`}>
      <span className="bg-indigo-100 text-indigo-700 p-1 rounded-md text-xs inline-flex items-center gap-1 font-semibold border border-indigo-200">
        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
      </span>
    </HoverTip>
  );
}

/** Icon NHỎ GỌN, KHÔNG Tooltip — dùng riêng ở Sơ đồ chính (RoomCard), nơi không được phép hiện
 *  chữ Tooltip đè lên thẻ phòng (theo yêu cầu trước đó). */
export function LinenChangeIcon({ room }: { room: { FoStatus: string; NgayO?: string | null } }) {
  if (!checkLinenChange(room)) return null;
  return (
    <span
      className="bg-indigo-100 text-indigo-700 p-1 rounded-md inline-flex items-center border border-indigo-200"
      aria-label="Hôm nay đến lịch thay ga giường"
    >
      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
    </span>
  );
}

export function NoteIcons({ note, ngayO, hideLsg }: { note: string; ngayO?: string | null; hideLsg?: boolean }) {
  const codes = cleanNote(note);
  const cls = 'w-3.5 h-3.5';
  const hasEB = /\bEB\b/i.test(codes);
  const hasBBC = /\bBBC\b/i.test(codes);
  const hasHON = /\bHON\b/i.test(codes);
  const hasLSG = !hideLsg && isLongStay(note, ngayO);
  if (!hasEB && !hasBBC && !hasHON && !hasLSG) return null;
  return (
    <div className="flex items-center gap-1">
      {hasEB && <BedSingle className={`${cls} text-indigo-600`} aria-label="Extra Bed" />}
      {hasBBC && <Baby className={`${cls} text-pink-500`} aria-label="Baby Cot" />}
      {hasHON && <Wine className={`${cls} text-rose-600`} aria-label="Honeymoon" />}
      {hasLSG && <CalendarRange className={`${cls} text-teal-600`} aria-label="Long Stay Guest" />}
    </div>
  );
}

/* =========================================================
   FIX HIỂN THỊ NGÀY — chuẩn hoá mọi định dạng ngày về DD/MM
   hoặc DD/MM-DD/MM, bất kể backend trả về ISO dài hay đã ngắn sẵn.
   ========================================================= */
export function formatDateShort(dateInput?: string | null): string {
  if (!dateInput) return '';
  const str = String(dateInput).trim();
  if (!str) return '';

  // Khoảng ngày dạng "23/07-27/07" hoặc "23/07-DPT" — xử lý từng vế
  if (str.includes('-') && !str.match(/^\d{4}-\d{2}-\d{2}/)) {
    const parts = str.split('-');
    return parts.map((p) => formatSingleDate(p.trim())).join('-');
  }

  return formatSingleDate(str);
}

function formatSingleDate(str: string): string {
  if (!str) return str;
  // Đã là dạng ngắn "24/07" hoặc mã trạng thái như "DPT", "ARR" -> giữ nguyên
  if (/^\d{2}\/\d{2}$/.test(str) || /^[A-ZÀ-Ỹ]+$/.test(str)) return str;

  try {
    const date = new Date(str);
    if (isNaN(date.getTime())) return str;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  } catch {
    return str;
  }
}

/* =========================================================
   MODULE NHIỆM VỤ — style badge TaskStatus + tiện ích tính giờ
   ========================================================= */
export const TASK_STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  'Chưa dọn': { label: 'Chưa dọn', cls: 'bg-slate-100 text-slate-600' },
  'Đang dọn': { label: 'Đang dọn', cls: 'bg-blue-100 text-blue-700' },
  'Hoàn thành': { label: 'Hoàn thành', cls: 'bg-green-100 text-green-700' },
  'Refused': { label: 'PHÒNG KHÔNG LÀM', cls: 'bg-red-100 text-red-700' },
  'DND': { label: 'DND', cls: 'bg-red-100 text-red-700' },
};

/** Giờ hiện tại dạng HH:mm:ss — dùng để ghi StartTime/EndTime khi bấm nút trong module Nhiệm vụ */
export function nowTimeStr(): string {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}

/** CHỈ LẤY GIỜ THỰC dạng HH:mm để hiển thị — chống chịu cả 2 dạng dữ liệu:
 *  - Chuỗi giờ thuần "08:00:58" (dữ liệu đúng chuẩn) -> cắt lấy "08:00"
 *  - Chuỗi ISO hỏng do Google Sheets tự chuyển "1899-12-30T08:00:58.000Z"
 *    (dữ liệu cũ trước khi có fix setNumberFormat ở Code.gs) -> parse ra đúng giờ:phút thật */
export function formatTimeOnly(timeStr?: string | null): string {
  if (!timeStr) return '';
  const str = String(timeStr).trim();
  if (!str) return '';
  // Đã đúng chuẩn "HH:mm" hoặc "HH:mm:ss" -> cắt lấy 5 ký tự đầu
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) return str.slice(0, 5);
  try {
    const date = new Date(str);
    if (isNaN(date.getTime())) return str;
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return str;
  }
}

/** Chuẩn hoá 1 giá trị giờ (chuỗi "HH:mm:ss" chuẩn HOẶC chuỗi ISO hỏng) về dạng "HH:mm:ss" sạch,
 *  dùng nội bộ cho diffMinutes/elapsedSecondsSince — không dùng để hiển thị (dùng formatTimeOnly cho hiển thị). */
function normalizeTimeStr(raw?: string | null): string {
  if (!raw) return '00:00:00';
  const str = String(raw).trim();
  const plain = str.match(/^(\d{2}):(\d{2})(:(\d{2}))?$/);
  if (plain) return `${plain[1]}:${plain[2]}:${plain[4] || '00'}`;
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
  }
  return '00:00:00';
}

/** Số phút chênh lệch giữa 2 mốc giờ (chấp nhận cả "HH:mm:ss" chuẩn lẫn chuỗi ISO hỏng) — làm tròn xuống, tối thiểu 0 */
export function diffMinutes(startTimeStr: string, endTimeStr: string): number {
  const toSeconds = (s: string) => {
    const [h, m, sec] = normalizeTimeStr(s).split(':').map(Number);
    return (h || 0) * 3600 + (m || 0) * 60 + (sec || 0);
  };
  const diff = toSeconds(endTimeStr) - toSeconds(startTimeStr);
  return Math.max(0, Math.floor(diff / 60));
}

/** Số giây đã trôi qua kể từ startTimeStr (chấp nhận cả "HH:mm:ss" chuẩn lẫn chuỗi ISO hỏng) tới hiện tại —
 *  dùng cho đồng hồ đếm giờ sống trên card */
export function elapsedSecondsSince(startTimeStr: string): number {
  if (!startTimeStr) return 0;
  const [h, m, s] = normalizeTimeStr(startTimeStr).split(':').map(Number);
  const start = new Date();
  start.setHours(h || 0, m || 0, s || 0, 0);
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
  return Math.max(0, diff);
}

/** Định dạng số giây thành "mm:ss" cho đồng hồ đếm giờ trên card */
export function formatElapsed(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
