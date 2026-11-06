'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Room, KeyLog, HistoryEntry, InspectionLogRow, Account, Group } from '@/lib/types';
import { getKeyLogs, getTodayHistory, getInspectionLogs, getAssignGroups } from '@/lib/api';
import { stripCodesFromNote, formatDateShort, formatTimeOnly, combineNotes, extractNoteCodes } from '@/lib/roomStyles';
import { buildExtraTasks } from '@/lib/extraTasks';
import { keyToDMY, type DailySnapshot } from '@/lib/dailyArchive';
import { labelNames, displayLabel, PM_MOVE_ACTION } from '@/lib/assignHelpers';
import { trolleyNo } from './TrolleyBadge';

/* =========================================================================
   TỜ BÁO CÁO DAILY REPORT — DÙNG CHUNG cho màn Daily Report trên app VÀ bản in / tải PDF.
   - Lịch sử chìa khóa ghi ngay dưới tên từng nhân viên.
   - "Lịch sử giám sát kiểm phòng" + chữ ký: CHỈ hiện khi in (màn Nhiệm vụ đã có bảng này).
   ========================================================================= */
interface DailyReportPrintProps {
  rooms: Room[];
  /** Người đang đăng nhập — in ở mục "Người lập báo cáo" */
  account?: Account | null;
  /** Bản báo cáo ĐÃ LƯU (Kho báo cáo) — có thì vẽ lại đúng dữ liệu ngày đó, không tải dữ liệu hôm nay */
  snapshot?: DailySnapshot | null;
}

/** Tổng số phút từ danh sách Duration dạng chuỗi (bỏ qua giá trị rỗng/không hợp lệ) */
function sumDuration(rooms: Room[]): number {
  return rooms.reduce((sum, r) => sum + (parseInt(r.Duration, 10) || 0), 0);
}

/** Map HkStatus (tiếng Việt) -> badge chuẩn Tiếng Anh khách sạn (màu theo quy ước Sơ đồ phòng) */
const STATUS_BADGE_EN: Record<string, { label: string; cls: string }> = {
  'Phòng dơ': { label: 'DIRTY', cls: 'bg-red-50 text-red-700 border-red-200' },
  'Phòng đang dọn': { label: 'CLEANING', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  'Phòng sạch': { label: 'CLEAN', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  'Đã kiểm tra': { label: 'INSPECTED', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'Phòng sửa chữa (OOO)': { label: 'OOO', cls: 'bg-slate-100 text-slate-600 border-slate-300' },
};
const CHECKING_BADGE = { label: 'CHECKING', cls: 'bg-purple-50 text-purple-700 border-purple-200' };

function StatusBadge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block font-bold px-1.5 py-[1px] rounded border text-[9.5px] tracking-wide whitespace-nowrap ${cls}`}>{label}</span>;
}

/** "123 FL (Bộ 01)" -> { set: "Bộ 01", floors: "123 FL" } */
function splitKeyLabel(label: string): { set: string; floors: string } {
  const m = /^(.*?)\s*\((.*?)\)\s*$/.exec(label || '');
  return m ? { floors: m[1], set: m[2] } : { floors: label, set: '' };
}

const pad = (n: number) => String(n).padStart(2, '0');

/* Khung mục (tiêu đề in hoa + đường kẻ đậm) — dùng chung cho mọi phần của báo cáo */
function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="flex items-end justify-between gap-2 border-b-2 border-slate-800 pb-1 mb-2.5 break-after-avoid">
        <h2 className="text-[12px] font-extrabold tracking-[0.12em] uppercase text-slate-800">{title}</h2>
        {aside && <div className="text-[10.5px] text-slate-500 text-right">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export default function DailyReportPrint({ rooms: liveRooms, account, snapshot }: DailyReportPrintProps) {
  const [liveKeyLogs, setKeyLogs] = useState<KeyLog[]>([]);
  // Lịch sử TRONG NGÀY của TẤT CẢ phòng — DND/RF (mỗi lần bấm 1 dòng) + nhiệm vụ phụ
  const [liveHistory, setHistory] = useState<HistoryEntry[]>([]);
  const [liveInspections, setInspections] = useState<InspectionLogRow[]>([]);
  const [liveGroups, setGroups] = useState<Group[]>([]);
  const [liveNow, setNow] = useState(() => new Date());

  // Xem bản đã lưu -> dùng dữ liệu của bản đó; không thì dữ liệu trực tiếp hôm nay
  const rooms = snapshot ? snapshot.rooms : liveRooms;
  const keyLogs = snapshot ? snapshot.keyLogs : liveKeyLogs;
  const history = snapshot ? snapshot.history : liveHistory;
  const inspections = snapshot ? snapshot.inspections : liveInspections;
  const groups = snapshot ? snapshot.groups : liveGroups;
  const now = snapshot ? new Date(snapshot.exportedAt) : liveNow;
  const reporter = snapshot ? snapshot.by : account?.hoTen || '';

  useEffect(() => {
    if (snapshot) return;
    const load = () => {
      getKeyLogs().then(setKeyLogs).catch(() => {});
      getTodayHistory().then(setHistory).catch(() => {});
      getInspectionLogs().then(setInspections).catch(() => {});
      getAssignGroups().then(setGroups).catch(() => {});
      setNow(new Date());
    };
    load();
    const timer = setInterval(load, 15000);
    // Cập nhật "Thời gian xuất" đúng lúc bấm tải PDF
    const onBeforePrint = () => setNow(new Date());
    window.addEventListener('beforeprint', onBeforePrint);
    return () => { clearInterval(timer); window.removeEventListener('beforeprint', onBeforePrint); };
  }, [snapshot]);

  // MỖI LẦN treo bảng DND / RF / MKR trong ngày (theo giờ bấm) -> gom đủ mốc giờ HH:mm theo từng phòng.
  // Luôn liệt kê đủ số lần, KỂ CẢ khi phòng đã bỏ DND/RF/MKR — để đối soát khi có sự cố.
  const { dndTimesByRoom, rfTimesByRoom, mkrTimesByRoom, pmMoveByRoom } = useMemo(() => {
    const dnd: Record<string, string[]> = {};
    const rf: Record<string, string[]> = {};
    const mkr: Record<string, string[]> = {};
    const pm: Record<string, string> = {};
    for (const h of history) {
      if (h.hanhDong === PM_MOVE_ACTION) pm[h.maPhong] = `${formatTimeOnly(h.gio)}${h.chiTiet ? ` (${h.chiTiet})` : ''}`;
      const t = formatTimeOnly(h.gio);
      if (!t) continue;
      if (h.hanhDong === 'DND Bật') (dnd[h.maPhong] ||= []).push(t);
      if (h.hanhDong === 'Từ chối (RF)') (rf[h.maPhong] ||= []).push(t);
      if (h.hanhDong === 'MKR Bật') (mkr[h.maPhong] ||= []).push(t);
    }
    return { dndTimesByRoom: dnd, rfTimesByRoom: rf, mkrTimesByRoom: mkr, pmMoveByRoom: pm };
  }, [history]);

  // Ghi chú nhân viên / giám sát — Báo cáo kết hợp ghi chú hiện tại + "hôm qua" (giữ đủ 1 ngày)
  const staffNoteFor = (r: Room) => stripCodesFromNote(r.GhiChuNV) || stripCodesFromNote(r.GhiChuNVHomQua);
  const adminNoteFor = (r: Room) => r.GhiChuAdmin || r.GhiChuAdminHomQua;
  const staffNotedRooms = rooms.filter((r) => staffNoteFor(r));
  const adminNotedRooms = rooms.filter((r) => adminNoteFor(r));

  // Danh sách đầy đủ phòng, sắp theo số phòng tăng dần
  const allRoomsSorted = [...rooms].sort((a, b) => Number(a.MaPhong) - Number(b.MaPhong));
  const todayStr = snapshot ? keyToDMY(snapshot.date) : `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const exportTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const total = rooms.length;
  const doneCount = rooms.filter((r) => r.TaskStatus === 'Hoàn thành').length;
  const dirtyCount = rooms.filter((r) => r.HkStatus === 'Phòng dơ').length;
  const dndCount = rooms.filter((r) => r.TaskStatus === 'DND').length;
  const rfCount = rooms.filter((r) => r.TaskStatus === 'Refused').length;

  // Nhiệm vụ phụ (mỗi nhiệm vụ tính như 01 room)
  const extraTasks = buildExtraTasks(groups, history);

  const byStaff = rooms.filter((r) => r.NhanVienPhuTrach).reduce<Record<string, Room[]>>((acc, r) => {
    (acc[r.NhanVienPhuTrach] = acc[r.NhanVienPhuTrach] || []).push(r);
    return acc;
  }, {});
  extraTasks.forEach((t) => { if (!byStaff[t.groupLabel]) byStaff[t.groupLabel] = []; });
  const staffStats = Object.entries(byStaff).map(([staff, staffRooms]) => {
    const tasks = extraTasks.filter((t) => t.groupLabel === staff);
    const doneRooms = staffRooms.filter((r) => r.TaskStatus === 'Hoàn thành');
    const doneTasks = tasks.filter((t) => t.status === 'done');
    const totalWork = staffRooms.length + tasks.length;
    const done = doneRooms.length + doneTasks.length;
    const minutes = sumDuration(doneRooms) + doneTasks.reduce((s, t) => s + (parseInt(t.minutes, 10) || 0), 0);
    return {
      staff,
      totalWork,
      done,
      pct: totalWork > 0 ? Math.round((done / totalWork) * 100) : 0,
      minutes,
      extraCount: tasks.length,
      trolley: staffRooms.find((r) => r.TrolleyCode)?.TrolleyCode || '',
      vacuum: staffRooms.find((r) => r.VacuumFloor)?.VacuumFloor || '',
    };
  }).sort((a, b) => b.pct - a.pct);

  // Chìa khóa theo từng nhân viên (nhóm "Tâm+Nghị" gồm chìa của cả 2 người)
  const keysForLabel = (label: string) => {
    const names = labelNames(label);
    return keyRows.filter((k) => names.includes(k.nhanVien));
  };
  // Bàn giao chìa khóa — sắp theo Bộ, rồi tầng, rồi giờ nhận
  const keyRows = keyLogs
    .map((l) => ({ ...l, ...splitKeyLabel(l.keyLabel) }))
    .sort((a, b) => (a.set + a.floors).localeCompare(b.set + b.floors) || (a.gioMuon || '').localeCompare(b.gioMuon || ''));

  // Chìa của nhân viên không nằm trong nhóm nào đang phân công -> ghi riêng 1 dòng
  const groupedNames = new Set(staffStats.flatMap((st) => labelNames(st.staff)));
  const unmatchedKeys = keyRows.filter((k) => !groupedNames.has(k.nhanVien));
  // Lịch sử giám sát kiểm phòng — giống màn Nhiệm vụ (dữ liệu trả về mới nhất trước -> đảo lại cũ trước)
  const inspectionRows = [...inspections].reverse();
  // Cột "Giám sát VCI": CHỈ tên giám sát của lượt kiểm ĐẠT gần nhất (chi tiết giờ xem ở Lịch sử bên dưới)
  const vciByRoom: Record<string, InspectionLogRow> = {};
  inspectionRows.forEach((l) => { if (l.endTime && l.status === 'Đã kiểm tra') vciByRoom[l.roomNo] = l; });

  const kpis = [
    { k: 'Tổng số phòng', v: String(total), s: 'Đang quản lý', c: 'text-slate-900' },
    { k: 'Đã dọn', v: String(doneCount), s: 'Hoàn thành', c: 'text-emerald-700' },
    { k: 'Chưa dọn (Dirty)', v: String(dirtyCount), s: 'Cần xử lý', c: 'text-red-700' },
    { k: 'DND / Refused', v: `${dndCount} / ${rfCount}`, s: 'Không làm phiền / Từ chối dọn', c: 'text-purple-700' },
  ];

  return (
    <div className="hk-report">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 9mm 10mm 11mm; @bottom-right { content: 'Trang ' counter(page) ' / ' counter(pages); font: 8px sans-serif; color: #94a3b8; } }
          html, body { background: #fff !important; width: 100% !important; min-width: 0 !important; }
          .hk-report-sheet { width: 100% !important; }
          .hk-report-sheet { box-shadow: none !important; border: 0 !important; padding: 0 !important; max-width: none !important; border-radius: 0 !important; }
          .hk-report table { font-size: 9.5px; }
          .hk-report tr { break-inside: avoid; }
          .hk-report thead { display: table-header-group; }
          .hk-report section { margin-top: 14px !important; }
          .hk-report .overflow-x-auto { overflow: visible !important; margin: 0 !important; padding: 0 !important; }
          .hk-report th, .hk-report td { padding-left: 4px !important; padding-right: 4px !important; }
          .hk-report .min-w-\\[160px\\] { min-width: 0 !important; }
          [style*="linear-gradient"] { background: #fff !important; }
          .hk-report .hk-kpi { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
          .hk-report .hk-staff { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
          .hk-report .min-w-\\[860px\\], .hk-report .min-w-\\[640px\\] { min-width: 0 !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* ============ TỜ BÁO CÁO ============ */}
      <div className="hk-report-sheet mx-auto max-w-[1200px] bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-[0_10px_30px_-14px_rgba(15,23,42,0.3)] px-4 py-5 md:px-8 md:py-7">
        {/* Tiêu đề */}
        <header className="flex flex-wrap items-start justify-between gap-3 border-b-[3px] border-slate-900 pb-3">
          <div>
            <div className="text-[22px] md:text-[26px] font-extrabold tracking-tight leading-none text-slate-900">HK OPERATION</div>
            <div className="mt-1.5 text-[11.5px] md:text-[13px] font-bold tracking-[0.14em] text-slate-600 uppercase">Báo cáo buồng phòng hàng ngày</div>
            <div className="text-[10px] tracking-[0.18em] text-slate-400 uppercase">Housekeeping Daily Report</div>
          </div>
          <table className="text-[11.5px]">
            <tbody>
              <tr><td className="pr-3 text-slate-500 font-semibold text-right">Ngày báo cáo</td><td className="font-bold tabular-nums">{todayStr}</td></tr>
              <tr><td className="pr-3 text-slate-500 font-semibold text-right">Thời gian xuất</td><td className="font-bold tabular-nums">{exportTime}</td></tr>
              <tr><td className="pr-3 text-slate-500 font-semibold text-right">Người lập</td><td className="font-bold">{reporter || '—'}</td></tr>
            </tbody>
          </table>
        </header>

        {/* KPI tổng quan */}
        <div className="hk-kpi mt-4 grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-300 border border-slate-300 rounded-lg overflow-hidden">
          {kpis.map((x) => (
            <div key={x.k} className="bg-white px-3.5 py-2.5">
              <div className="text-[9.5px] font-bold tracking-[0.12em] uppercase text-slate-500">{x.k}</div>
              <div className={`text-[24px] font-extrabold leading-tight tabular-nums ${x.c}`}>{x.v}</div>
              <div className="text-[10px] text-slate-400">{x.s}</div>
            </div>
          ))}
        </div>

        {/* Tiến độ nhân viên */}
        <Section title="Tiến độ nhân viên phụ trách" aside="Mỗi nhiệm vụ phụ được tính như 01 room">
          {staffStats.length === 0 ? (
            <div className="text-[12px] text-slate-400 py-3">Chưa có phòng nào được phân công hôm nay.</div>
          ) : (
            <div className="hk-staff grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-start gap-2">
              {staffStats.map((s) => (
                <div key={s.staff} className="border border-slate-300 rounded-md px-3 py-2 break-inside-avoid">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-[12.5px] truncate">
                      {displayLabel(s.staff)}{s.trolley && s.trolley !== 'PM' ? <span className="text-slate-500 font-semibold"> · Xe {trolleyNo(s.trolley)}</span> : null}
                    </span>
                    <span className="font-extrabold text-[12.5px] tabular-nums">{s.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden my-1.5">
                    <div className="h-full bg-slate-800" style={{ width: `${s.pct}%` }} />
                  </div>
                  <div className="text-[10.5px] text-slate-600 tabular-nums">
                    <b>{s.done}/{s.totalWork} rooms</b> · {s.minutes} phút
                    {s.extraCount > 0 && <> · gồm {s.extraCount} NV phụ</>}
                    {s.vacuum && <> · Hút bụi: {s.vacuum}</>}
                  </div>
                  {/* Lịch sử bộ chìa khóa của nhân viên — dạng Ô BẢNG: Bộ · Tầng · Nhận · Trả */}
                  <KeyTable rows={keysForLabel(s.staff)} showName={s.staff.includes('+')} />
                </div>
              ))}
            </div>
          )}
          {unmatchedKeys.length > 0 && (
            <div className="mt-2 max-w-[520px]">
              <div className="text-[10.5px] font-bold text-slate-600 mb-1">Chìa khóa khác (nhân viên ngoài nhóm phân công)</div>
              <KeyTable rows={unmatchedKeys} showName />
            </div>
          )}
        </Section>

        {/* Ghi chú trong ngày — trải hết bề ngang */}
          <Section title="Ghi chú trong ngày">
            {adminNotedRooms.length === 0 && staffNotedRooms.length === 0 ? (
              <div className="text-[11.5px] text-slate-400">Không có ghi chú.</div>
            ) : (
              <table className="w-full text-[11px]">
                <tbody>
                  {adminNotedRooms.map((r) => (
                    <tr key={`a-${r.MaPhong}`} className="border-b border-slate-100 align-top">
                      <td className="py-1 pr-2 font-bold w-12">{r.MaPhong}</td>
                      <td className="py-1 pr-2 w-[70px]"><StatusBadge label="GIÁM SÁT" cls="bg-amber-50 text-amber-800 border-amber-200" /></td>
                      <td className="py-1">{adminNoteFor(r)}{!r.GhiChuAdmin && <span className="text-slate-400"> (hôm qua)</span>}</td>
                    </tr>
                  ))}
                  {staffNotedRooms.map((r) => (
                    <tr key={`s-${r.MaPhong}`} className="border-b border-slate-100 align-top">
                      <td className="py-1 pr-2 font-bold w-12">{r.MaPhong}</td>
                      <td className="py-1 pr-2 w-[70px]"><StatusBadge label="NHÂN VIÊN" cls="bg-blue-50 text-blue-800 border-blue-200" /></td>
                      <td className="py-1">
                        {staffNoteFor(r)}{!stripCodesFromNote(r.GhiChuNV) && <span className="text-slate-400"> (hôm qua)</span>}
                        {r.NhanVienPhuTrach && <span className="text-slate-400"> — {displayLabel(r.NhanVienPhuTrach)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>


        {/* Bảng dữ liệu chính */}
        <Section title="Chi tiết phòng" aside={`${total} phòng`}>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[860px] text-[11px] border border-slate-300">
              <thead>
                <tr className="bg-slate-900 text-white text-[9.5px] font-bold uppercase tracking-wide">
                  <th className="px-2 py-2 text-left">Số phòng</th>
                  <th className="px-2 py-2 text-left">Loại</th>
                  <th className="px-2 py-2 text-left">Nhân viên</th>
                  <th className="px-2 py-2 text-left">Giám sát VCI</th>
                  <th className="px-2 py-2 text-left">Check-in / Out</th>
                  <th className="px-2 py-2 text-center">TT buổi sáng</th>
                  <th className="px-2 py-2 text-center">TT hiện tại</th>
                  <th className="px-2 py-2 text-center">Giờ làm việc</th>
                  <th className="px-2 py-2 text-center">Két sắt</th>
                  <th className="px-2 py-2 text-left w-[30%]">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {allRoomsSorted.map((r, i) => {
                  const morningBadge = STATUS_BADGE_EN[r.MorningStatus] || STATUS_BADGE_EN['Phòng dơ'];
                  const currentBadge = r.isInspecting ? CHECKING_BADGE : (STATUS_BADGE_EN[r.HkStatus] || STATUS_BADGE_EN['Phòng dơ']);
                  const workingTime = r.StartTime ? `${formatTimeOnly(r.StartTime)} - ${r.EndTime ? formatTimeOnly(r.EndTime) : ''}` : '—';
                  const codes = extractNoteCodes(combineNotes(r.GhiChu, r.GhiChuNV, r.GhiChuAdmin));
                  const dndTimes = dndTimesByRoom[r.MaPhong] || [];
                  const rfTimes = rfTimesByRoom[r.MaPhong] || [];
                  const mkrTimes = mkrTimesByRoom[r.MaPhong] || [];
                  const hasMkrFlag = (r.Flags || '').split(',').map((f) => f.trim()).includes('TrangDiem');
                  // Bảng treo cửa: hiện nếu đã từng bấm trong ngày (kèm số lần + giờ) HOẶC đang có mã/cờ (chưa có giờ)
                  const hangers = [
                    { key: 'DND', times: dndTimes, on: codes.includes('DND'), cls: 'bg-red-50 text-red-700 border-red-200' },
                    { key: 'RF', times: rfTimes, on: codes.includes('RF'), cls: 'bg-purple-50 text-purple-700 border-purple-200' },
                    { key: 'MKR', times: mkrTimes, on: hasMkrFlag, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                  ].filter((h) => h.times.length > 0 || h.on);
                  const otherCodes = codes.filter((c) => c !== 'DND' && c !== 'RF');
                  const staffNote = stripCodesFromNote(r.GhiChuNV);
                  const vci = vciByRoom[r.MaPhong];
                  return (
                    <tr key={r.MaPhong} className={`border-t border-slate-200 align-top ${i % 2 ? 'bg-slate-50/70' : ''}`}>
                      <td className="px-2 py-1.5 font-extrabold">{r.MaPhong}</td>
                      <td className="px-2 py-1.5 text-slate-600">{r.LoaiPhong}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.NhanVienPhuTrach ? displayLabel(r.NhanVienPhuTrach) : '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {vci ? (
                          <b>{vci.giamSat}</b>
                        ) : '—'}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{formatDateShort(r.NgayO) || '—'}</td>
                      <td className="px-2 py-1.5 text-center"><StatusBadge {...morningBadge} /></td>
                      <td className="px-2 py-1.5 text-center"><StatusBadge {...currentBadge} /></td>
                      <td className="px-2 py-1.5 text-center whitespace-nowrap tabular-nums">{workingTime}</td>
                      <td className="px-2 py-1.5 text-center">
                        {r.SafeStatus === 'Đóng' ? <StatusBadge label="LOCKED" cls="bg-sky-50 text-sky-700 border-sky-200" /> : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-slate-700 min-w-[160px] w-[30%]">
                        {hangers.length === 0 && otherCodes.length === 0 && !r.GhiChuAdmin && !staffNote && !pmMoveByRoom[r.MaPhong] && '—'}
                        {pmMoveByRoom[r.MaPhong] && (
                          <div className="mb-0.5"><StatusBadge label={`→ PM SHIFT ${pmMoveByRoom[r.MaPhong]}`} cls="bg-indigo-50 text-indigo-700 border-indigo-200" /></div>
                        )}
                        {(hangers.length > 0 || otherCodes.length > 0) && (
                          <div className="flex flex-wrap gap-1">
                            {hangers.map((h) => (
                              <StatusBadge
                                key={h.key}
                                label={h.times.length > 0 ? `${h.key} ×${h.times.length}: ${h.times.join(', ')}` : h.key}
                                cls={h.cls}
                              />
                            ))}
                            {otherCodes.map((code, j) => <StatusBadge key={j} label={code} cls="bg-slate-50 text-slate-600 border-slate-200" />)}
                          </div>
                        )}
                        {r.GhiChuAdmin && <div className="text-[10.5px] mt-0.5">QL: {r.GhiChuAdmin}</div>}
                        {staffNote && <div className="text-[10.5px] mt-0.5">NV: {staffNote}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Lịch sử giám sát kiểm phòng — CHỈ khi in/tải PDF (trên app đã có ở màn Nhiệm vụ) */}
        <div className="hidden print:block">
        <Section title="Lịch sử giám sát kiểm phòng" aside={`${inspectionRows.length} lượt`}>
          {inspectionRows.length === 0 ? (
            <div className="text-[11.5px] text-slate-400">Chưa có lượt kiểm phòng nào được ghi nhận.</div>
          ) : (
            <table className="w-full text-[11px] border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-[9.5px] font-bold uppercase tracking-wide border-b border-slate-300">
                  <th className="px-2 py-1.5 text-left">Số phòng</th>
                  <th className="px-2 py-1.5 text-left">Bắt đầu kiểm</th>
                  <th className="px-2 py-1.5 text-left">Kiểm xong</th>
                  <th className="px-2 py-1.5 text-left">Tình trạng sau nhả</th>
                  <th className="px-2 py-1.5 text-left">Giám sát</th>
                </tr>
              </thead>
              <tbody>
                {inspectionRows.map((l) => (
                  <tr key={l.id} className="border-t border-slate-200">
                    <td className="px-2 py-1.5 font-extrabold">{l.roomNo}</td>
                    <td className="px-2 py-1.5 tabular-nums">{l.startTime || '-'}</td>
                    <td className="px-2 py-1.5 tabular-nums">{l.endTime || 'Đang kiểm...'}</td>
                    <td className="px-2 py-1.5">{l.status || '-'}</td>
                    <td className="px-2 py-1.5">{l.giamSat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        </div>

        {/* Ký xác nhận + chân trang — CHỈ khi in/tải PDF */}
        <div className="hidden print:block break-inside-avoid">
        <div className="mt-6 grid grid-cols-2 gap-6 text-center text-[11px]">
          <div>
            <div className="font-bold uppercase tracking-wide text-slate-600">Người lập báo cáo</div>
            <div className="h-10" />
            <div className="font-semibold">{reporter}</div>
          </div>
          <div>
            <div className="font-bold uppercase tracking-wide text-slate-600">Quản lý buồng phòng</div>
            <div className="h-10" />
            <div className="text-slate-400">(Ký, ghi rõ họ tên)</div>
          </div>
        </div>
        <footer className="mt-4 pt-2 border-t border-slate-200 flex justify-between gap-2 text-[9.5px] text-slate-400">
          <span>HK Operation — Daily Housekeeping Report</span>
          <span className="tabular-nums">Xuất lúc {exportTime} — {todayStr}</span>
        </footer>
        </div>
      </div>
    </div>
  );
}


/** Ô BẢNG lịch sử nhận / trả chìa khóa — mỗi lượt 1 dòng, cột thẳng hàng */
function KeyTable({ rows, showName }: { rows: { rowIndex: number; set: string; floors: string; nhanVien: string; gioMuon: string; gioTra: string; trangThai: string }[]; showName?: boolean }) {
  if (rows.length === 0) {
    return <div className="mt-2 rounded border border-dashed border-slate-300 px-2 py-1.5 text-center text-[10px] text-slate-400">Chưa nhận chìa khóa</div>;
  }
  return (
    <table className="hk-keys mt-2 w-full border-collapse text-[10px] tabular-nums">
      <thead>
        <tr className="bg-slate-100 text-slate-500">
          <th className="border border-slate-300 px-1.5 py-[3px] text-left font-bold">Bộ</th>
          <th className="border border-slate-300 px-1.5 py-[3px] text-left font-bold">Tầng</th>
          {showName && <th className="border border-slate-300 px-1.5 py-[3px] text-left font-bold">NV</th>}
          <th className="border border-slate-300 px-1.5 py-[3px] text-center font-bold">Nhận</th>
          <th className="border border-slate-300 px-1.5 py-[3px] text-center font-bold">Trả</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((k) => {
          const returned = k.trangThai === 'Đã trả' && k.gioTra;
          return (
            <tr key={k.rowIndex}>
              <td className="border border-slate-300 px-1.5 py-[3px] font-bold whitespace-nowrap">{k.set || '—'}</td>
              <td className="border border-slate-300 px-1.5 py-[3px] text-slate-600">{k.floors || '—'}</td>
              {showName && <td className="border border-slate-300 px-1.5 py-[3px] text-slate-600 whitespace-nowrap">{k.nhanVien}</td>}
              <td className="border border-slate-300 px-1.5 py-[3px] text-center whitespace-nowrap">{formatTimeOnly(k.gioMuon) || '—'}</td>
              <td className="border border-slate-300 px-1.5 py-[3px] text-center whitespace-nowrap">
                {returned ? formatTimeOnly(k.gioTra) : <span className="font-bold text-red-600">Chưa trả</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
