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
  FoStatus: FoStatus;
  NgayO: string;
  NhanVienPhuTrach: string;
  GhiChu: string;
  /** Ghi chú thủ công do nhân viên/quản lý tự gõ qua modal — TÁCH RIÊNG khỏi GhiChu (cột AI ghi),
   *  để Đồng bộ AI không bao giờ ghi đè mất ghi chú tay. Cũng là ô "Thêm ghi chú" trong màn Nhiệm vụ. */
  GhiChuNV: string;
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
