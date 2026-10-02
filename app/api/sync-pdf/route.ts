import { NextRequest, NextResponse } from 'next/server';
import { cleanNote } from '@/lib/roomStyles';

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

QUY TẮC VÀNG — TUYỆT ĐỐI KHÔNG TỰ TÍNH TOÁN/SO SÁNH NGÀY THÁNG:
Báo cáo này KHÔNG BAO GIỜ ghi một ngày tháng cụ thể (dạng DD/MM/YYYY) vào đúng ô mà sự kiện đó xảy ra HÔM NAY — thay vào đó ô "Est Time Arrival" sẽ ghi chữ "***ARR***" nếu khách ĐẾN hôm nay, và ô "Est Time Departure" sẽ ghi chữ "***DPT***" nếu khách TRẢ PHÒNG hôm nay. Vì vậy bạn CHỈ CẦN nhận diện có xuất hiện đúng chữ "***ARR***" / "***DPT***" hay không — TUYỆT ĐỐI KHÔNG được tự suy luận "ngày này gần hôm nay nên chắc là Due out/Arrival". Nếu một ô ghi NGÀY THÁNG CỤ THỂ (VD "03/10/2026") thay vì "***ARR***"/"***DPT***", thì dù ngày đó là ngày mai hay chỉ còn vài giờ nữa, nó VẪN KHÔNG PHẢI là sự kiện hôm nay — không được gán Due out/Arrival cho trường hợp này, bất kể ngày đó gần hôm nay thế nào.

Xác định foStatus theo đúng thứ tự các trường hợp sau — BẮT BUỘC kiểm tra LẦN LƯỢT từ 1 đến 5, hễ trường hợp nào khớp trước thì DỪNG LẠI NGAY, không xét tiếp các trường hợp sau (chỉ chọn 1 trong 5 giá trị: "Arrival", "Due out/ARR", "Due out", "Occupied", "Vacant"):

1. Nếu Est Time Arrival = đúng chữ "***ARR***", VÀ cột I/O KHÔNG có "D" (I/O rỗng hoặc chỉ có "A")
   -> foStatus = "Arrival" (khách mới đến hôm nay)
   VD thật trong báo cáo: phòng 202 — I/O "A", Arrival "***ARR***", Departure "04/10/2026" -> Arrival.
2. Nếu Est Time Arrival = đúng chữ "***ARR***", VÀ cột I/O có "AD" (hoặc "A D")
   -> foStatus = "Due out/ARR" (khách cũ trả phòng và khách mới nhận phòng trong cùng ngày — dù ô Departure lúc này lại hiện ngày cụ thể của KHÁCH MỚI, VD "05/10/2026", đó là ngày trả phòng tương lai của khách mới, không phải mốc hôm nay — cứ thấy I/O có "AD" + Arrival "***ARR***" là chốt luôn Due out/ARR)
   VD thật: phòng 302 — I/O "A D", Arrival "***ARR***", Departure "04/10/2026" -> Due out/ARR.
3. Nếu Est Time Departure = đúng chữ "***DPT***" (và KHÔNG rơi vào trường hợp 1, 2 ở trên)
   -> foStatus = "Due out" (khách trả phòng hôm nay, không có khách mới nhận ngay)
   VD thật: phòng 777 — I/O "D", Arrival "25/09/2026" (ngày nhận phòng cũ), Departure "***DPT***" -> Due out.
4. Nếu CẢ Arrival và Departure đều là NGÀY THÁNG CỤ THỂ (không phải "***ARR***"/"***DPT***")
   -> foStatus = "Occupied" — ÁP DỤNG DÙ ngày Departure là ngày mai hay bất kỳ ngày nào sắp tới, miễn KHÔNG phải chữ "***DPT***" thì luôn luôn là Occupied, không bao giờ là Due out.
   VD thật: phòng 206 — Arrival "30/09/2026", Departure "03/10/2026" (ngày cụ thể, không phải ***DPT***) -> Occupied, dù hôm nay có là 02/10 đi nữa.
5. Nếu cả Est Time Arrival và Est Time Departure đều trống/rỗng (không có cả ngày lẫn marker)
   -> foStatus = "Vacant"

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

### C. TRƯỜNG "note" — CHỈ 5 MÃ ĐƯỢC PHÉP (DỊCH VỤ ĐẶC BIỆT + THẺ TREO CỬA)

Trường "note" CHỈ ĐƯỢC PHÉP chứa duy nhất các mã sau, không được chứa bất kỳ nội dung nào khác:
   - "EB" (Extra Bed / giường phụ)
   - "BBC" (Baby Cot / nôi trẻ em)
   - "HON" (Honeymoon / trăng mật)
   - "DND" (Do Not Disturb / thẻ treo cửa không làm phiền)
   - "RF" (Refuse Service / thẻ treo cửa từ chối dọn phòng)
Ghi các mã tìm được vào trường "note", cách nhau bởi dấu phẩy (VD: "EB, HON" hoặc "DND"). Nếu không có mã nào trong 5 mã trên xuất hiện, để note = "".
TUYỆT ĐỐI KHÔNG trích tên khách (Guest), số phòng, mã I/O, hay bất kỳ chữ/số nào khác ngoài 5 mã trên vào trường note. KHÔNG ghi ngày tháng vào trường note — ngày tháng chỉ nằm ở trường "date" riêng.

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

    // Lớp lọc dự phòng: đảm bảo note chỉ còn đúng 5 mã hợp lệ (EB/BBC/HON/DND/RF),
    // loại bỏ mọi rác (tên khách, ngày tháng...) dù AI có lỡ chèn vào.
    rooms = rooms.map((r: any) => ({ ...r, note: cleanNote(r.note) }));

    return NextResponse.json({ rooms });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi không xác định' }, { status: 500 });
  }
}
