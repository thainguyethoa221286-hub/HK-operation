import type { Room } from './types';
import { SAMPLE_ROOMS } from './sampleData';

// Dán URL Apps Script /exec vào đây (dùng chung backend Code.gs với bản HTML trước đó)
export const API_URL = 'https://script.google.com/macros/s/AKfycbzl3d32rhwekoEpknl3PdcsFXvcZ38ftARDDMjAiSf-MVbLBhqYFf-Vi4AMJLMFy5hkKQ/exec';

function jsonp<T = any>(action: string, params: Record<string, string>, timeoutMs = 8000): Promise<T | null> {
  return new Promise((resolve, reject) => {
    if (!API_URL) { resolve(null); return; }
    const cbName = 'cb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    let settled = false;

    const cleanup = () => {
      delete (window as any)[cbName];
      script.remove();
      clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Hết thời gian chờ phản hồi từ Google Sheet (kiểm tra lại quyền truy cập Apps Script hoặc URL)'));
    }, timeoutMs);

    (window as any)[cbName] = (data: T) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data);
    };

    const qs = new URLSearchParams({ action, callback: cbName, ...params }).toString();
    const script = document.createElement('script');
    script.src = API_URL + '?' + qs;
    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Không tải được script từ Apps Script (network error)'));
    };
    document.body.appendChild(script);
  });
}

export async function fetchRooms(): Promise<Room[]> {
  if (!API_URL) return SAMPLE_ROOMS;
  const r = await jsonp<{ success: boolean; rooms?: any[]; error?: string }>('getRooms', {});
  console.log('[HK PRO] Phản hồi getRooms từ Apps Script:', r);
  if (!r) {
    throw new Error('Không nhận được phản hồi từ Apps Script (r = null)');
  }
  if (!r.success || !r.rooms) {
    throw new Error('Apps Script báo lỗi: ' + (r.error || 'không có trường "rooms" trong phản hồi'));
  }
  // Ép toàn bộ trường về dạng chữ — Google Sheets có thể tự lưu ô toàn số (vd MaPhong)
  // thành kiểu Number, phá vỡ mọi hàm xử lý chuỗi (.includes, .toUpperCase...) ở phía sau.
  return r.rooms.map((row) => ({
    ...row,
    MaPhong: String(row.MaPhong ?? ''),
    Tang: String(row.Tang ?? ''),
    LoaiPhong: String(row.LoaiPhong ?? ''),
    HkStatus: String(row.HkStatus ?? ''),
    FoStatus: String(row.FoStatus ?? ''),
    NgayO: String(row.NgayO ?? ''),
    NhanVienPhuTrach: String(row.NhanVienPhuTrach ?? ''),
    GhiChu: String(row.GhiChu ?? ''),
    Flags: String(row.Flags ?? ''),
    isInspecting: false,
  })) as Room[];
}

export async function updateRoomField(maPhong: string, field: string, value: string) {
  if (!API_URL) return;
  await jsonp('updateRoom', { maPhong, field, value });
}

export async function bulkUpdateFromAI(chunk: any[]): Promise<{ success: boolean; updated?: number; notFound?: string[]; error?: string } | null> {
  if (!API_URL) return { success: true, updated: chunk.length };
  const result = await jsonp<{ success: boolean; updated?: number; notFound?: string[]; error?: string }>(
    'bulkUpdateFromAI',
    { data: JSON.stringify(chunk) }
  );
  return result;
}

export const AI_SYSTEM_PROMPT = `Bạn là một trợ lý AI chuyên phân tích dữ liệu khách sạn cho hệ thống HK PRO.
Nhiệm vụ của bạn là đọc nội dung file PDF báo cáo trạng thái phòng được tải lên, trích xuất dữ liệu của tất cả các phòng và trả về dạng JSON duy nhất.

---

### QUY TẮC MÁP DỮ LIỆU (MAPPING RULES)

1. Trạng thái Housekeeping (hkStatus) - BẮT BUỘC chọn 1 trong 5 giá trị sau:
   - "Phòng dơ" (Tương ứng: Dirty, DI, Uncleaned, Bẩn)
   - "Phòng đang dọn" (Tương ứng: Cleaning, In Progress, Đang dọn)
   - "Phòng sạch" (Tương ứng: Inspecting, Touch up, Cần kiểm tra)
   - "Đã kiểm tra" (Tương ứng: Clean, Inspected, CI, Sạch)
   - "Phòng sửa chữa (OOO)" (Tương ứng: Out of Order, OOO, Repair, Maintenance, Hỏng)

2. Trạng thái Front Office / Lễ tân (foStatus) - BẮT BUỘC chọn 1 trong 5 giá trị sau:
   - "Occupied" (Tương ứng: OCC, Có khách, In-house, Chiếm lĩnh)
   - "Due out" (Tương ứng: Expected Departure, ED, Check-out, Dep, Sắp out)
   - "Arrival" (Tương ứng: Expected Arrival, EA, Check-in, Arr, Sắp đến)
   - "Due out/ARR" (Tương ứng: Day Use, DU, Use-in-day)
   - "Vacant" (Tương ứng: VAC, Ready, Phòng trống)

3. Định dạng Số phòng (id):
   - Giữ nguyên số phòng dạng chuỗi text (Ví dụ: "102", "204", "777", "888", "999").
   - Xác định Tầng (floor) dựa trên số đầu tiên của phòng (Ví dụ: Phòng "102" -> floor: 1, Phòng "902" -> floor: 9).

---

### YÊU CẦU ĐẦU RA (OUTPUT FORMAT)

RẤT QUAN TRỌNG: Chỉ trả về một mảng JSON thuần túy (JSON Array). KHÔNG kèm theo lời mở đầu, lời giải thích, KHÔNG bọc trong khối code markdown (như \`\`\`json ... \`\`\`).

Cấu trúc JSON mẫu:
[
  { "id": "102", "floor": 1, "hkStatus": "Phòng dơ", "foStatus": "Occupied", "note": "Check-out 12:00" },
  { "id": "202", "floor": 2, "hkStatus": "Đã kiểm tra", "foStatus": "Vacant", "note": "" }
]`;

export async function readPdfWithAI(file: File): Promise<any[]> {
  const base64Data: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(',')[1]);
    r.onerror = () => rej(new Error('Read failed'));
    r.readAsDataURL(file);
  });

  // Gọi qua API route của chính app (server-side) — tránh lỗi CORS và giữ kín API key
  const response = await fetch('/api/sync-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Đồng bộ AI thất bại');
  }
  return data.rooms;
}
