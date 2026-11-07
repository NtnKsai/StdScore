# Student List Manager

ระบบจัดการรายชื่อนักเรียนสำหรับ **โรงเรียนวัดแคทราย(บุญประชาสรรค์)**  
ผู้พัฒนา: **NtnKsai**

รุ่นเริ่มต้น (V1) ใช้ GitHub Pages สำหรับเผยแพร่หน้าเว็บ, Google Apps Script เป็น API และ Google Sheets เป็นฐานข้อมูลกลาง พร้อม Google Sign-In และตรวจสอบอีเมลผู้มีสิทธิ์ที่ฝั่ง Backend

## ความสามารถใน V1

- เข้าสู่ระบบด้วยบัญชี Google
- จำกัดบัญชีที่ใช้งานได้ด้วยรายการ `EDITOR_EMAILS` ใน Script Properties
- เพิ่ม / แก้ไข / ลบนักเรียน
- เพิ่ม / แก้ไข / ลบห้องเรียน (ไม่อนุญาตให้ลบห้องที่ยังมีนักเรียน)
- กรองรายชื่อห้องเดียวหรือหลายห้องพร้อมกัน
- เลือกคอลัมน์ที่จะแสดง: เลขที่, ชื่อ, นามสกุล, ชื่อเล่น และห้องเรียน
- ค้นหาและแบ่งหน้า
- นำเข้ารายชื่อ CSV, ดาวน์โหลด CSV, คัดลอก และพิมพ์รายชื่อ
- API ฝั่ง Apps Script สำหรับต่อยอดระบบอื่น

## โครงสร้างไฟล์

```text
Student-List-Manager/
├── index.html          # หน้าเว็บ
├── style.css           # รูปแบบหน้าจอและ Responsive
├── app.js              # การทำงานฝั่งเว็บไซต์
├── config.js           # ค่า Client ID และ URL ของ Apps Script (เป็นค่าที่เปิดเผยได้)
├── Code.gs             # API และการเชื่อม Google Sheets
├── appsscript.json     # Manifest และ OAuth scopes
├── README.md           # คู่มือนี้
├── API.md              # รายละเอียด API
└── .nojekyll           # ป้องกัน GitHub Pages ประมวลผลชื่อไฟล์บางชนิด
```

---

# ส่วน A — เตรียม Google Sheets และ Apps Script

## 1. สร้าง Google Sheets

1. เข้าสู่ Google Drive ด้วยบัญชี Google ที่จะเป็นเจ้าของระบบ
2. สร้าง Google Sheets ใหม่ ตั้งชื่อ เช่น `Student List Manager DB`
3. เก็บไฟล์นี้ไว้ในบัญชีผู้ดูแล และ **อย่าตั้งการแชร์เป็น Anyone with the link**
4. เปิดเมนู **ส่วนขยาย (Extensions) → Apps Script** เพื่อสร้าง Apps Script ที่ผูกกับชีตนี้

## 2. ใส่โค้ด Apps Script

1. ใน Apps Script เปิดไฟล์ `Code.gs` ลบโค้ดเดิม แล้ววางโค้ดจากไฟล์ `Code.gs` ที่อยู่ในชุดนี้
2. เปิด Project Settings (ไอคอนรูปเฟือง)
3. เปิดตัวเลือก **Show `appsscript.json` manifest file in editor**
4. เปิดไฟล์ `appsscript.json` แล้วแทนที่ด้วยไฟล์ `appsscript.json` ในชุดนี้
5. กด Save
6. กลับไปที่ไฟล์ `Code.gs` เลือกฟังก์ชัน `setupDatabase` แล้วกด Run
7. อนุญาตสิทธิ์ให้สคริปต์เข้าถึง Google Sheets ตามขั้นตอนของ Google
8. กลับไปที่ Google Sheets ควรเห็นชีต `Students`, `Classrooms` และ `Settings` พร้อมหัวตาราง

> ให้รัน `setupDatabase()` เพียงครั้งแรกเท่านั้น ฟังก์ชันนี้จะสร้างชีตและบันทึก Spreadsheet ID ลง Script Properties อัตโนมัติ

## 3. สร้าง Google OAuth Client ID สำหรับ Google Sign-In

1. เข้า [Google Cloud Console](https://console.cloud.google.com/)
2. เลือกหรือสร้าง Google Cloud Project
3. ตั้งค่า OAuth consent screen / Google Auth Platform ให้เรียบร้อย หากแอปอยู่ในสถานะ Testing ให้เพิ่มบัญชี Google ของผู้ทดสอบเป็น Test users
4. ไปที่ Clients แล้วสร้าง OAuth Client ID ประเภท **Web application**
5. ใน Authorized JavaScript origins ให้เพิ่ม Origin ของ GitHub Pages เช่น `https://USERNAME.github.io` (ใช้ชื่อบัญชี GitHub ของผู้เผยแพร่จริง)
6. ระหว่างทดสอบบนเครื่อง เพิ่ม `http://localhost:8000` ได้ด้วย
7. คัดลอก Client ID ที่ลงท้ายด้วย `apps.googleusercontent.com` เก็บไว้

ข้อสำคัญ: Authorized JavaScript origins ต้องเป็น Origin เท่านั้น ไม่ต้องใส่ path ของ Repository เช่น `/student-list-manager/`

## 4. ตั้งค่า Script Properties (ห้ามข้าม)

กลับไป Apps Script → Project Settings → Script Properties → Add script property แล้วเพิ่ม 3 รายการนี้

| Property | Value |
|---|---|
| `SPREADSHEET_ID` | ถูกตั้งให้อัตโนมัติเมื่อรัน `setupDatabase()` หากไม่มี ให้คัดลอก ID จาก URL Google Sheets มาใส่ |
| `GOOGLE_CLIENT_ID` | Web Client ID จาก Google Cloud Console |
| `EDITOR_EMAILS` | อีเมล Google ที่อนุญาตให้ใช้ระบบ คั่นหลายบัญชีด้วยเครื่องหมายจุลภาค |

ตัวอย่าง `EDITOR_EMAILS`:

```text
teacher@example.com,admin@example.com
```

ให้ใช้อีเมลเต็มของบัญชี Google ที่จะเข้าสู่ระบบ ไม่ใช่ชื่อที่แสดง และอย่าปล่อยค่านี้ว่าง

## 5. Deploy Apps Script เป็น Web App

1. ใน Apps Script เลือก **Deploy → New deployment**
2. เลือกประเภท **Web app**
3. Description: `Student List Manager API V1`
4. Execute as: **Me (บัญชีเจ้าของสคริปต์)**
5. Who has access: เลือก **Anyone** (หรือ Anyone, even anonymous หากหน้าจอแสดงตัวเลือกแยก) เพื่อให้เว็บไซต์ GitHub Pages เรียก API ได้
6. กด Deploy และอนุญาตสิทธิ์เมื่อระบบร้องขอ
7. คัดลอก URL ของ Web app ที่ลงท้ายด้วย `/exec`

เหตุผลที่ตั้งการเข้าถึง Web App เป็น Anyone: ตัวเว็บไซต์อยู่บน GitHub Pages ซึ่งเป็นคนละ Origin กับ Apps Script จึงต้องเรียก endpoint ได้โดยไม่ต้องผ่านหน้า Sign-in ของ Apps Script เอง แต่ **ไม่ได้หมายความว่าทุกคนจะอ่านหรือแก้ฐานข้อมูลได้** เพราะทุกคำขอที่ระบบรองรับต้องส่ง Google ID token และ Backend จะตรวจ Client ID, token, อีเมล และ `EDITOR_EMAILS` ก่อนทำงาน

หากบัญชี Google Workspace ของโรงเรียนปิดกั้นการ Deploy แบบ Anyone ให้ติดต่อผู้ดูแล Google Workspace เพื่อขอแนวทางที่องค์กรอนุญาต อย่าปรับชีตเป็นสาธารณะเพื่อแก้ปัญหา

## 6. อัปเดต URL และ Client ID ในเว็บไซต์

เปิดไฟล์ `config.js` แล้วแทนค่าตัวอย่างด้วยค่าจริง

```javascript
window.APP_CONFIG = {
  GOOGLE_CLIENT_ID: "123456789-example.apps.googleusercontent.com",
  API_URL: "https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec"
};
```

ค่า Client ID และ URL ของ Web App เป็นค่าที่เว็บไซต์ต้องใช้ จึงอยู่ใน `config.js` ได้ แต่ **ห้ามใส่รหัสผ่าน, Script Properties, Spreadsheet ID ที่เป็นความลับ, API key ส่วนตัว หรือข้อมูลนักเรียนจริง** ในไฟล์นี้

---

# ส่วน B — เผยแพร่เว็บไซต์ด้วย GitHub Pages

## 7. สร้าง Repository

1. เข้าสู่ [GitHub](https://github.com/)
2. สร้าง Repository ใหม่ เช่น `student-list-manager`
3. ถ้าใช้ GitHub Free โดยทั่วไป GitHub Pages สำหรับบัญชีส่วนบุคคลต้องใช้ Repository แบบ Public; โปรดตรวจสอบเงื่อนไขแพ็กเกจของบัญชีปัจจุบันก่อนเลือก Visibility
4. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ไปไว้ที่ Root ของ Repository โดยให้ `index.html` อยู่ระดับบนสุด
5. ห้ามอัปโหลด Spreadsheet export, รายชื่อนักเรียนจริง, รหัสผ่าน หรือไฟล์สำรองฐานข้อมูลขึ้น Repository

## 8. เปิด GitHub Pages

1. เปิด Repository → **Settings → Pages**
2. ในส่วน Build and deployment เลือก Deploy from a branch
3. เลือก Branch `main` และ Folder `/ (root)`
4. กด Save
5. รอให้ GitHub Actions เผยแพร่เว็บไซต์ แล้วเปิด URL ที่แสดงในหน้า Pages เช่น `https://USERNAME.github.io/student-list-manager/`

เว็บไซต์ GitHub Pages เป็นเว็บไซต์ที่บุคคลทั่วไปเปิดดูได้ แม้ Repository จะเป็น Private ในแพ็กเกจที่รองรับ Private Pages ก็ตาม ดังนั้นห้ามใส่ข้อมูลนักเรียนลงในไฟล์หน้าเว็บหรือ Repository

---

# ส่วน C — ทดสอบระบบ

1. เปิด URL GitHub Pages
2. กด Sign in with Google ด้วยบัญชีที่อยู่ใน `EDITOR_EMAILS`
3. หากระบบแจ้งว่าไม่อนุญาต ให้ตรวจอีเมลใน Script Properties และบัญชีที่ใช้ล็อกอิน
4. เพิ่มห้องเรียน เช่น `ป.1/1`, `ป.1/2`, `ป.2/1`
5. เพิ่มนักเรียนในแต่ละห้อง
6. ทดสอบแก้ไขและลบข้อมูล
7. ทดสอบเลือกห้องเรียนมากกว่า 1 ห้อง และเลือกคอลัมน์ให้เหลือเฉพาะชื่อเล่น
8. ทดสอบดาวน์โหลด CSV / พิมพ์ / นำเข้า CSV
9. เปิด Google Sheets ตรวจสอบว่าข้อมูลถูกบันทึกในชีต `Students` และ `Classrooms`
10. ทดสอบเข้าสู่ระบบด้วยบัญชีที่ **ไม่ได้อยู่ใน `EDITOR_EMAILS`** บัญชีนั้นต้องถูกปฏิเสธ

## รูปแบบ CSV สำหรับนำเข้า

ไฟล์ต้องมีแถวหัวตาราง โดยรองรับชื่อคอลัมน์ภาษาไทยหรืออังกฤษ

```csv
เลขที่,ห้อง,ชื่อ,นามสกุล,ชื่อเล่น
1,ป.1/1,สมชาย,ใจดี,บอล
2,ป.1/1,สมหญิง,รักเรียน,แก้ม
```

ชื่อห้องใน CSV ต้องตรงกับชื่อห้องที่สร้างไว้ในระบบ รายการที่ไม่มีห้อง เลขที่ หรือชื่อ จะไม่ถูกนำเข้า ระบบข้ามเลขที่ซ้ำในห้องเดียวกัน และจำกัดการนำเข้า 500 รายการต่อครั้ง

---

# ข้อควรทราบด้านความปลอดภัยและข้อจำกัดของ V1

- Google Sheets ต้องแชร์เฉพาะบัญชีเจ้าของ Apps Script/ผู้ดูแลที่จำเป็นเท่านั้น ห้ามเปิด Anyone with the link
- Apps Script Web App ทำงานภายใต้สิทธิ์ของผู้ Deploy ดังนั้น Backend จึงต้องรักษาการตรวจสอบ ID token และ `EDITOR_EMAILS` ไว้เสมอ ห้ามนำโค้ดตรวจสอบสิทธิ์ออก
- V1 ใช้ Google `tokeninfo` endpoint เพื่อตรวจ ID token ภายใน Apps Script เพื่อให้ติดตั้งง่าย Google ระบุว่า endpoint นี้เหมาะกับการทดสอบ/ดีบักและอาจมีการจำกัดคำขอ สำหรับระบบที่มีผู้ใช้จำนวนมากหรือมีความสำคัญสูง ควรเปลี่ยนเป็นการตรวจลายเซ็น JWT ใน Backend ด้วย public keys ของ Google ที่หมุนเวียนได้
- ผู้ดูแลควรตรวจสิทธิ์ผู้ใช้ใน `EDITOR_EMAILS` เป็นระยะ และลบอีเมลของผู้ที่ไม่ควรเข้าถึง
- Google Sign-In แบบนี้เป็นการยืนยันตัวตนของ Google account ไม่ใช่การบังคับว่าต้องเป็นโดเมนโรงเรียน เว้นแต่ผู้ดูแลจะเพิ่มกฎโดเมนใน Backend เพิ่มเติม
- ข้อมูลนักเรียนเป็นข้อมูลส่วนบุคคล ควรใช้ระบบกับบัญชีที่โรงเรียนอนุญาต และปฏิบัติตามนโยบายการคุ้มครองข้อมูลของโรงเรียน
- API เวอร์ชันนี้ออกแบบให้ใช้กับเว็บไซต์ชุดนี้ก่อน ยังไม่มีระบบ API key สำหรับระบบภายนอกโดยตรง ควรเพิ่มการกำหนดสิทธิ์และการบันทึกประวัติการใช้งานก่อนเปิดให้บริการแก่ระบบอื่น

## ผู้พัฒนา

**NtnKsai**  
โรงเรียนวัดแคทราย(บุญประชาสรรค์)
