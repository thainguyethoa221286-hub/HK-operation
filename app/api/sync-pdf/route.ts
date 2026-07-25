import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const AI_SYSTEM_PROMPT = `Bạn là một trợ lý AI chuyên phân tích dữ liệu khách sạn cho hệ thống HK PRO.
Nhiệm vụ của bạn là đọc nội dung file PDF báo cáo trạng thái phòng được tải lên, trích xuất dữ liệu của tất cả các phòng và trả về dạng JSON duy nhất.

RẤT QUAN TRỌNG: Bạn BẮT BUỘC chỉ trả về một mảng JSON thuần túy (JSON Array). KHÔNG kèm theo bất kỳ văn bản giải thích, lời chào hay câu nói nào như "I need to...", KHÔNG bọc trong khối markdown \`\`\`json.

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
]

TUYỆT ĐỐI KHÔNG được hỏi lại, không xin làm rõ, không giải thích lý do — kể cả khi file khó đọc hoặc thiếu thông tin, hãy trích xuất tối đa những gì đọc được và trả về JSON ngay theo đúng định dạng trên. Nếu 1 phòng nào đó không rõ trạng thái, vẫn đưa phòng đó vào mảng với dữ liệu suy đoán hợp lý nhất, tuyệt đối không bỏ sót và không chèn bất kỳ câu chữ nào ngoài mảng JSON.`;

// Hàm hỗ trợ trích xuất mảng JSON an toàn từ phản hồi của AI
function parseSafeJsonArray(text: string): any[] {
  // 1. Thử parse trực tiếp sau khi bóc khối markdown ```json nếu có
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // 2. Nếu lỗi (AI lỡ thêm câu chữ trước/sau), dùng Regex tìm đoạn JSON Array [...] nằm trong văn bản
    const match = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('AI không trả về cấu trúc JSON hợp lệ. Nội dung AI trả lời: ' + cleaned.slice(0, 500));
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server chưa cấu hình ANTHROPIC_API_KEY (Environment Variable trên Vercel)' },
        { status: 500 }
      );
    }

    const { base64Data } = await req.json();
    if (!base64Data) {
      return NextResponse.json({ error: 'Thiếu dữ liệu PDF' }, { status: 400 });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: AI_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
              { type: 'text', text: 'Đọc file báo cáo phòng này và trả về JSON theo đúng quy tắc.' },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: 'Anthropic API lỗi: ' + errText }, { status: response.status });
    }

    const data = await response.json();
    const text = data.content.map((b: any) => b.text || '').join('');

    let rooms;
    try {
      rooms = parseSafeJsonArray(text);
    } catch (parseErr: any) {
      return NextResponse.json({ error: parseErr.message }, { status: 500 });
    }

    return NextResponse.json({ rooms });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi không xác định' }, { status: 500 });
  }
}
