# Student List Manager API (V1)

Base URL: URL `/exec` จาก Apps Script Web App deployment  
Authentication: Google Identity Services ID token (`token`)  
Access control: `EDITOR_EMAILS` Script Property ที่ตรวจสอบบน Backend ทุกคำขอ

> API นี้ออกแบบสำหรับ Frontend ของ Student List Manager V1 การเรียกใช้จากระบบอื่นควรเพิ่มการออก token, การกำหนดสิทธิ์เฉพาะบทบาท และ audit log ก่อนใช้งานจริง

## GET — bootstrap

Frontend เรียกด้วย JSONP เพื่อหลีกเลี่ยงข้อจำกัด CORS ของ Apps Script ContentService

```text
GET /exec?action=bootstrap&token=GOOGLE_ID_TOKEN&callback=callbackName
```

Response:

```json
{
  "ok": true,
  "user": { "email": "teacher@example.com" },
  "students": [
    {
      "id": "UUID",
      "classroomId": "UUID",
      "number": "1",
      "firstName": "สมชาย",
      "lastName": "ใจดี",
      "nickname": "บอล",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "classrooms": [
    { "id": "UUID", "name": "ป.1/1", "createdAt": "...", "updatedAt": "..." }
  ]
}
```

## POST — mutations

ส่ง `application/x-www-form-urlencoded` โดยมี field ชื่อ `payload` ซึ่งเป็น JSON string ผ่าน Fetch แบบ `no-cors` (เบราว์เซอร์อ่าน response ของ POST โดยตรงไม่ได้)

ตัวอย่าง payload:

```json
{
  "action": "createStudent",
  "token": "GOOGLE_ID_TOKEN",
  "nonce": "unique-request-nonce",
  "classroomId": "CLASSROOM_UUID",
  "number": "1",
  "firstName": "สมชาย",
  "lastName": "ใจดี",
  "nickname": "บอล"
}
```

หลังรับ POST แล้ว Backend จะเก็บผลลัพธ์ไว้ชั่วคราวใน Script Cache โดยใช้ `nonce` จากนั้น Frontend เรียก `GET /exec?action=pollResult&token=...&nonce=...&callback=...` เพื่อรับผล การอ่านผลต้องผ่านการยืนยันบัญชีเดิม และผลลัพธ์จะถูกลบออกจาก Cache หลังอ่าน

## Supported actions

| action | required fields | description |
|---|---|---|
| `createStudent` | `classroomId`, `number`, `firstName` | เพิ่มนักเรียน |
| `updateStudent` | `id`, `classroomId`, `number`, `firstName` | แก้ไขนักเรียน |
| `deleteStudent` | `id` | ลบนักเรียน |
| `createClassroom` | `name` | เพิ่มห้องเรียน |
| `updateClassroom` | `id`, `name` | เปลี่ยนชื่อห้องเรียน |
| `deleteClassroom` | `id` | ลบห้องเรียนที่ไม่มีนักเรียนเท่านั้น |
| `importStudents` | `students[]` | นำเข้าหลายรายการ สูงสุด 500 รายการ/ครั้ง |
| `pollResult` (GET) | `nonce` | อ่านผลลัพธ์ POST ของคำขอเดียวกัน (ระบบใช้ภายใน) |

ทุก action ต้องมี `token` ที่ผ่านการยืนยัน และทุก mutation จะตอบกลับรูปแบบ `{ "ok": true, ... }` หรือ `{ "ok": false, "message": "..." }`
