import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const AI_SYSTEM_PROMPT = `Bạn là một trợ lý AI chuyên phân tích báo cáo phòng khách sạn (dạng PMS/ezFolio) cho hệ thống HK PRO.
Nhiệm vụ: đọc file PDF báo cáo trạng thái phòng, trích xuất dữ liệu TỪNG PHÒNG và trả về một mảng JSON duy nhất.

RẤT QUAN TRỌNG: Bạn BẮT BUỘC chỉ trả về một mảng JSON thuần túy (JSON Array). KHÔNG kèm theo bất kỳ văn bản giải thích, lời chào hay câu nói nào như "I need to...", KHÔNG bọc trong khối markdown \`\`\`json.

---

### A. QUY TẮC NHẬN DIỆN TRẠNG THÁI KHÁCH (foStatus) VÀ TRẠNG THÁI PHÒNG (hkStatus)

Dựa vào các cột trong báo cáo: cột "I/O" (Change Status), "Room Status", "Est Time Arrival", "Est Time Departure".

QUAN TRỌNG: foStatus và hkStatus là 2 trục ĐỘC LẬP với nhau:
- foStatus xác định theo cột I/O + Est Time Arrival/Departure (xem quy tắc bên dưới).
- hkStatus xác định RIÊNG theo giá trị thực tế của cột "Room Status" (Dirty/Clean/Inspected/...) qua bảng quy đổi bên dưới — dù foStatus là gì thì hkStatus vẫn đọc đúng theo Room Status thật ghi trong báo cáo, KHÔNG mặc định là "Dirty".

Lưu ý khi đọc cột I/O: do PDF trích xuất văn bản đôi khi bị chèn khoảng trắng thừa, chữ "AD" có thể hiện thành "A D" (có dấu cách ở giữa) — hãy coi "A D" và "AD" là MỘT (cùng nghĩa "AD").

Xác định foStatus theo đúng thứ tự các trường hợp sau (chỉ chọn 1 trong 5 giá trị: "Occupied", "Due out", "Arrival", "Due out/ARR", "Vacant"):

1. Nếu cột I/O có chữ "A" (và KHÔNG phải "AD"/"A D"), Est Time Arrival = "***ARR***"
   -> foStatus = "Arrival" (phòng chờ khách mới đến hôm nay)
2. Nếu cột I/O có chữ "AD" (hoặc "A D"), Est Time Arrival = "***ARR***"
   -> foStatus = "Due out/ARR" (khách cũ trả phòng và khách mới nhận phòng trong cùng ngày)
3. Nếu cột I/O trống, có đầy đủ ngày Arrival & Departure cụ thể (VD: 24/7/26 đến 26/7/26, đang ở giữa khoảng đó, KHÔNG phải "***ARR***")
   -> foStatus = "Occupied"
4. Nếu cột I/O trống, cả Est Time Arrival và Est Time Departure đều trống/rỗng
   -> foStatus = "Vacant"
5. Nếu ngày ở cột "Est Time Departure" TRÙNG với ngày hôm nay (xem ngày hôm nay ở tin nhắn kèm theo), và cột I/O KHÔNG có chữ "A" hoặc "AD"
   -> foStatus = "Due out"

Quy đổi hkStatus theo giá trị thực tế của cột "Room Status" (chỉ chọn 1 trong 5 giá trị sau):
   - "Dirty" -> "Phòng dơ"
   - "Cleaning" / "In Progress" -> "Phòng đang dọn"
   - "Clean" / "Touch up" -> "Phòng sạch"
   - "Inspected" -> "Đã kiểm tra"
   - "OOO" / "Out of Order" / "Repair" -> "Phòng sửa chữa (OOO)"

Định dạng số phòng (id): giữ nguyên dạng chuỗi text (VD "102", "777", "999"). Xác định floor theo chữ số đầu tiên (VD "902" -> floor: 9).

---

### B. TRƯỜNG "date" — NGÀY CHECK-IN / CHECK-OUT (BẮT BUỘC PHẢI CÓ, TRỪ PHÒNG VACANT)

Với MỌI phòng có thông tin Est Time Arrival và/hoặc Est Time Departure, BẮT BUỘC điền trường "date" riêng (không gộp vào note):
   - Nếu có cả ngày Arrival cụ thể VÀ ngày Departure cụ thể -> "date": "DD/MM-DD/MM" (VD: "24/07-26/07").
   - Nếu Est Time Arrival = "***ARR***" (khách đến hôm nay) và có ngày Departure cụ thể -> "date": "{ngày hôm nay}-DD/MM" (dùng ngày hôm nay cho vế đầu, VD hôm nay 25/07 và Departure 28/07 -> "date": "25/07-28/07").
   - Nếu chỉ có 1 trong 2 ngày -> "date" chỉ ghi ngày đó, dạng "DD/MM".
   - Nếu phòng Vacant (không có cả Arrival lẫn Departure) -> "date": "".
CHỈ dùng định dạng ngày ngắn DD/MM hoặc DD/MM-DD/MM. TUYỆT ĐỐI KHÔNG dùng định dạng ISO dài (VD: 2026-07-24T17:00:00.000Z) và KHÔNG kèm năm.

---

### C. TRƯỜNG "note" — DỊCH VỤ ĐẶC BIỆT

Chỉ trích các mã dịch vụ đặc biệt nếu có xuất hiện trong báo cáo (cột Special Service / Notices):
   - "EB" (Extra Bed / giường phụ)
   - "BBC" (Baby Cot / nôi trẻ em)
   - "HON" (Honeymoon / trăng mật)
Ghi các mã tìm được vào trường "note", cách nhau bởi dấu phẩy (VD: "EB, HON"). Nếu không có mã nào, để note = "".
TUYỆT ĐỐI KHÔNG trích tên khách vào trường note hay bất kỳ trường nào khác. KHÔNG ghi ngày tháng vào trường note — ngày tháng chỉ nằm ở trường "date" riêng.

---

### YÊU CẦU ĐẦU RA (OUTPUT FORMAT)

Cấu trúc JSON mẫu:
[
  { "id": "102", "floor": 1, "hkStatus": "Phòng dơ", "foStatus": "Arrival", "date": "25/07-28/07", "note": "" },
  { "id": "104", "floor": 1, "hkStatus": "Phòng dơ", "foStatus": "Occupied", "date": "24/07-26/07", "note": "" },
  { "id": "202", "floor": 2, "hkStatus": "Đã kiểm tra", "foStatus": "Vacant", "date": "", "note": "" },
  { "id": "306", "floor": 3, "hkStatus": "Phòng dơ", "foStatus": "Arrival", "date": "25/07-28/07", "note": "EB" }
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

    const today = new Date();
    const todayStr = String(today.getDate()).padStart(2, '0') + '/' + String(today.getMonth() + 1).padStart(2, '0') + '/' + today.getFullYear();

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
              { type: 'text', text: `Hôm nay là ngày ${todayStr}. Đọc file báo cáo phòng này và trả về JSON theo đúng quy tắc.` },
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
