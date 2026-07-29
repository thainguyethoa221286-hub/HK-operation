export type HkStatus =
  | 'Phòng dơ'
  | 'Phòng đang dọn'
  | 'Phòng sạch'
  | 'Đã kiểm tra'
  | 'Phòng sửa chữa (OOO)';

export type FoStatus =
  | 'Occupied'
  | 'Due out'
  | 'Arrival'
  | 'Due out/ARR'
  | 'Vacant';

/* =========================================================
   MODULE NHIỆM VỤ + RBAC
   ========================================================= */
export type Role = 'Admin' | 'GiamSat' | 'HKStaff';

export interface Account {
  id: string;
  hoTen: string;
  vaiTro: Role;
}

export type TaskStatus = 'Chưa dọn' | 'Đang dọn' | 'Hoàn thành' | 'Refused' | 'DND';
export type SafeStatus = 'Chưa kiểm' | 'Mở' | 'Đóng';

export const ROLE_LABELS: Record<Role, string> = {
  Admin: 'Admin',
  GiamSat: 'Giám sát',
  HKStaff: 'Nhân viên HK',
};

/** 1 dòng lịch sử thao tác của 1 phòng trong ngày — lưu ở tab riêng "LichSuDon",
 *  KHÔNG ghi đè, mỗi lần bấm hành động (Bắt đầu/Hoàn thành/Báo dơ lại/DND/RF/Làm lại) thêm 1 dòng mới. */
export interface HistoryEntry {
  ngay: string;
  maPhong: string;
  nhanVien: string;
  hanhDong: string;
  gio: string;
  chiTiet: string;
}

/** ===== LỊCH SỬ KIỂM PHÒNG CỦA GIÁM SÁT/ADMIN ===== */
export interface InspectionLogRow {
  id: number;
  roomNo: string;
  startTime: string; // HH:mm:ss — lúc bấm KIỂM PHÒNG
  endTime: string; // HH:mm:ss — lúc bấm NHẢ PHÒNG
  status: string; // Tình trạng phòng SAU KHI nhả phòng (VD: "Đã kiểm tra")
  giamSat: string; // Tên giám sát/admin (từ account)
}

/** ===== MODULE NOTE BOARD (3 bảng độc lập) ===== */
export interface WatchlistRoom {
  id: number;
  roomNo: string;
  shiftNote: string; // Nội dung gốc lấy từ Báo cáo lúc đồng bộ — không đổi sau đó
  extraNote: string; // Ghi chú bổ sung, tự do chỉnh sửa
}
export interface OverdueHistoryRow {
  id: number;
  category: 'ThayGiuong' | 'DND' | 'RF';
  roomNo: string;
  dateNoted: string; // ngày được ghi nhận (thường là "hôm qua" tính từ lúc Đồng bộ AI chạy)
}
export interface SupplyBoardItem {
  label: string;
  value: string;
}
export const SUPPLY_LABELS = [
  'Extra Bed', 'Extra Bed sẵn', 'Baby cot', 'Tách giường', 'Ghép giường',
  'Bathrobe', 'Blanket', 'Memory', 'Latex', 'Noted',
] as const;

/** ===== MODULE LOST & FOUND (Đồ thất lạc & tìm thấy) ===== */
export interface LostFoundItem {
  id: number; // rowIndex thật trên Sheet
  dateFound: string; // dd/MM/yyyy
  roomNo: string;
  itemDescription: string;
  foundBy: string;
  status: 'Lưu kho' | 'Đã trả';
  notes: string;
}

/** ===== MODULE MAINTENANCE (Sửa chữa / Bảo trì) ===== */
export interface MaintenanceIssue {
  id: number; // rowIndex thật trên Sheet — dùng để update/xoá đúng dòng
  roomNo: string;
  issueDescription: string;
  reportedBy: string;
  reportedDate: string; // dd/MM/yyyy
  status: 'Đang xử lý' | 'Đã xong';
  dueDate: string; // ngày hẹn, rỗng nếu chưa hẹn
}

/** ===== MODULE TASK CHART (Nhiệm vụ định kỳ dạng bảng) ===== */
export interface TaskChart {
  id: string;
  title: string;
  palette: 1 | 2 | 3;
}
export interface TaskChartCell {
  chartId: string;
  maPhong: string;
  checked: boolean;
  note: string;
}
/** Danh sách 55 phòng — MẢNG PHẲNG, sắp xếp tuần tự theo tầng 1 -> 9 (KHÔNG chia cột cứng),
 *  để khi CSS Grid rơi về 1 cột (mobile/in ấn) thứ tự hiển thị luôn đúng 1→9, không bị nhảy tầng. */
export const TASK_CHART_FLOORS: { floor: string; rooms: string[] }[] = [
  { floor: '1', rooms: ['102', '104'] },
  { floor: '2', rooms: ['202', '204', '206', '208', '210', '212', '214', '216'] },
  { floor: '3', rooms: ['302', '304', '306', '308', '310', '312', '314', '316'] },
  { floor: '4', rooms: ['402', '404', '406', '408', '410', '412', '414', '416'] },
  { floor: '5', rooms: ['502', '504', '506', '508', '510', '512', '514', '516'] },
  { floor: '6', rooms: ['602', '604', '606', '608', '610', '612', '614', '616'] },
  { floor: '7', rooms: ['777', '702', '704', '706', '708'] },
  { floor: '8', rooms: ['888', '802', '804'] },
  { floor: '9', rooms: ['999', '902', '904', '906', '908'] },
];

/** 9 bộ chìa khóa cố định của khách sạn — mỗi mã (123/456/789) là 1 chìa MASTER mở được 3 tầng
 *  tương ứng (123 = tầng 1-2-3, 456 = tầng 4-5-6, 789 = tầng 7-8-9), mỗi mã có 3 BỘ giống hệt nhau
 *  (Bộ 01/02/03) để nhiều nhân viên dùng cùng lúc trên cùng cụm tầng đó. */
export const KEY_SETS = [
  '123 FL (Bộ 01)', '456 FL (Bộ 01)', '789 FL (Bộ 01)',
  '123 FL (Bộ 02)', '456 FL (Bộ 02)', '789 FL (Bộ 02)',
  '123 FL (Bộ 03)', '456 FL (Bộ 03)', '789 FL (Bộ 03)',
] as const;

/** 1 lượt giao/nhận 1 bộ chìa — lưu ở tab riêng "GiaoNhanChia".
 *  rowIndex dùng để gọi returnKey() cập nhật đúng dòng khi trả chìa. */
export interface KeyLog {
  rowIndex: number;
  ngay: string;
  nhanVien: string;
  keyLabel: string;
  gioMuon: string;
  gioTra: string;
  trangThai: 'Đang giữ' | 'Đã trả';
}

/** 1 lượt giao/nhận chìa khóa — lưu ở tab riêng "GiaoNhanChia".
 *  rowIndex dùng để gọi returnKey() cập nhật đúng dòng khi trả chìa. */
export interface KeyLog {
  rowIndex: number;
  ngay: string;
  nhanVien: string;
  soPhong: string;
  soLuong: string;
  gioMuon: string;
  gioTra: string;
  trangThai: 'Đang giữ' | 'Đã trả';
}

export interface Room {
  MaPhong: string;
  Tang: string;
  LoaiPhong: string;
  HkStatus: HkStatus;
  /** Ảnh chụp CỐ ĐỊNH của HkStatus tại đúng thời điểm "Đồng bộ AI" chạy mỗi sáng (đọc PDF) —
   *  KHÔNG đổi theo thời gian thực trong ngày, dùng làm mốc so sánh "đầu ca" cho Báo cáo.
   *  HkStatus (bên trên) mới là trạng thái thực tế, đổi liên tục khi nhân viên dọn phòng. */
  MorningStatus: HkStatus;
  FoStatus: FoStatus;
  NgayO: string;
  NhanVienPhuTrach: string;
  GhiChu: string;
  /** Ghi chú thủ công do nhân viên/quản lý tự gõ qua modal — TÁCH RIÊNG khỏi GhiChu (cột AI ghi),
   *  để Đồng bộ AI không bao giờ ghi đè mất ghi chú tay. Cũng là ô "Thêm ghi chú" trong màn Nhiệm vụ. */
  GhiChuNV: string;
  /** Ghi chú RIÊNG cho mục Sửa chữa — tách hẳn khỏi GhiChuNV/GhiChuAdmin, chỉ hiện khi cờ
   *  "Sửa chữa" (SuaChua trong Flags) đang bật. Nội dung này đồng thời đổ sang Module Maintenance. */
  GhiChuSuaChua: string;
  /** Snapshot GhiChuNV/GhiChuAdmin ngay TRƯỚC LẦN Đồng bộ AI gần nhất — CHỈ dùng để hiện trong
   *  Báo cáo (mục "Ghi chú nhân viên/giám sát hôm nay") cho đủ 1 ngày, tuyệt đối KHÔNG dùng ở bất kỳ
   *  nơi nào khác (thẻ phòng, Modal...) vì các nơi đó phải xoá sạch ngay lập tức mỗi lần sync. */
  GhiChuNVHomQua: string;
  GhiChuAdminHomQua: string;
  /** Ghi chú RIÊNG của Admin/Giám sát nhập từ Sơ đồ phòng — TÁCH KHỎI GhiChuNV để phân biệt được
   *  nguồn, hiện nổi bật (nền vàng) bên màn Nhiệm vụ của nhân viên khi có nội dung. */
  GhiChuAdmin: string;
  Flags: string;
  /** Thời điểm bấm "Bắt đầu dọn phòng" (HH:mm:ss). Khi TaskStatus="Refused", trường này
   *  được TÁI SỬ DỤNG để lưu thời điểm bấm Refused (vì phòng bị từ chối thì chưa có giờ bắt đầu dọn thật). */
  StartTime: string;
  /** Thời điểm bấm "Hoàn thành dọn phòng" (HH:mm:ss) */
  EndTime: string;
  /** Số phút dọn phòng thực tế = EndTime - StartTime */
  Duration: string;
  /** Trạng thái nhiệm vụ dọn phòng hiện tại của nhân viên được gán */
  TaskStatus: TaskStatus;
  /** Trạng thái kiểm tra két sắt */
  SafeStatus: SafeStatus;
  /** Có thay giường trong lượt dọn này không — 'Có' hoặc rỗng */
  LinenChange: string;
  /** Mã xe đẩy — TỰ ĐỘNG lấy theo mã nhóm phân công (VD "N1") khi giám sát gán phòng ở tab Phân công */
  TrolleyCode: string;
  /** Tầng đang giữ máy hút bụi trong ca này (VD "5FL") — chọn ở khung Bàn giao thiết bị đầu màn Nhiệm vụ */
  VacuumFloor: string;
  /** Trạng thái tạm thời — KHÔNG lưu vào Sheet, chỉ tồn tại trong phiên làm việc hiện tại */
  isInspecting: boolean;
}

export const VACUUM_FLOORS = ['1FL', '2FL', '3FL', '4FL', '5FL', '6FL', '7FL', '8FL', '9FL'];

export const HK_STATUSES: HkStatus[] = [
  'Phòng dơ',
  'Phòng đang dọn',
  'Phòng sạch',
  'Đã kiểm tra',
  'Phòng sửa chữa (OOO)',
];

export const FO_STATUSES: FoStatus[] = [
  'Occupied',
  'Due out',
  'Arrival',
  'Due out/ARR',
  'Vacant',
];

export const FLAGS = [
  { key: 'CayBac', label: 'Rush', icon: '🔔' },
  { key: 'TrangDiem', label: 'MKR', icon: '🖌' },
  { key: 'DaOut', label: 'Đã out', icon: '🧳' },
  { key: 'SuaChua', label: 'Sửa chữa', icon: '🔧' },
] as const;

export interface Group {
  id: string;
  staffs: string[];
  extraTasks: string[];
}

export const MASTER_STAFF_LIST = ['Nhân', 'Tiến', 'Tâm', 'Hải', 'Hồng', 'Nghị', 'Trúc', 'HK', 'Tôi', 'Đầu'];

export const STAFF_LIST = ['Nhân', 'Tiến', 'Nghị', 'Tâm', 'Hài', 'Hồng', 'Trúc', 'HK'];
