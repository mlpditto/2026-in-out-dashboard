# 2026 In-Out Dashboard (MLP Time Attendance)

ระบบลงเวลาพนักงานผ่าน LINE LIFF + Firebase Firestore พร้อมหน้า Admin สำหรับดูรายงาน/จัดการข้อมูล

**Current Version**: `v3.51 - Hover Details & Tooltips` | **Last Updated**: 2026-02-24

---

## 📋 ภาพรวม (Overview)

*   [🚀 Features List (FEATURES.md)](FEATURES.md) - รายละเอียดฟีเจอร์ทั้งหมด
*   [🏗️ System Overview (SYSTEM_OVERVIEW.md)](SYSTEM_OVERVIEW.md) - สถาปัตยกรรมทางเทคนิคและโครงสร้างข้อมูล

| หน้า | URL | รายละเอียด |
|------|-----|-----------|
| พนักงาน | `index.html` | ลงเวลาเข้า-ออกผ่าน LINE LIFF |
| ผู้ดูแลระบบ | `admin.html` | Dashboard จัดการ/รายงานทุกอย่าง |
| ล็อกอิน | `login.html` | หน้า fallback login |

### Hosting & Deployment

| Platform | URL | วิธี Deploy |
|----------|-----|-------------|
| **Firebase Hosting** (Production) | [https://time.mlp-int.work/admin.html](https://time.mlp-int.work/admin.html) | `firebase deploy --only hosting` |
| **GitHub Pages** (Mirror) | [https://mlpditto.github.io/2026-in-out-dashboard/admin.html](https://mlpditto.github.io/2026-in-out-dashboard/admin.html) | `git push origin main` → auto-deploy |

---

## ⭐ ฟีเจอร์ทั้งหมด (All Features)

### 1) ระบบพนักงาน — `index.html`

ฝั่งพนักงานเข้าใช้งานผ่าน **LINE LIFF** เท่านั้น (ไม่รองรับเปิดจากเบราว์เซอร์ปกติ)

#### 🔐 การเข้าสู่ระบบ & ลงทะเบียน
- เข้าระบบผ่าน **LINE LIFF SDK** (Auto-Login)
- **Profile Auto-Sync**: ดึงข้อมูลโปรไฟล์จาก LINE (ชื่อ, รูป) และอัปเดตลงฐานข้อมูล Firestore โดยอัตโนมัติทุกครั้ง
- **Dynamic Theming**: UI เปลี่ยนสีตามแผนกที่สังกัด (แถบชื่อ, รหัส, ขอบรูปโปรไฟล์)
- ลงทะเบียนพนักงานใหม่: กรอกรหัส, ชื่อ-นามสกุล, เลือกแผนก
- รองรับระบุ **วันเริ่ม-สิ้นสุดฝึกงาน** สำหรับแผนก Pharmacist Extern/Intern

#### ⏰ ลงเวลาเข้า-ออกงาน
- บันทึกเวลา **เข้างาน / ออกงาน** (รูปแบบ 24 ชั่วโมง)
- **บังคับขอพิกัด GPS** และแสดงแผนที่พร้อม link Google Maps
- ส่งข้อความแจ้งเตือนเข้า **LINE Chat** อัตโนมัติ
- นาฬิกา Digital Clock แสดง real-time บนหน้าจอ
- แสดงสถานะปัจจุบัน (กำลังทำงานอยู่ / ยังไม่ได้ลงเวลา)

#### 📅 ระบบการลา (Leave System)
- พนักงานส่งคำขอลา: **ลาป่วย / ลาพักผ่อน**
- ระบุวันที่เริ่ม-สิ้นสุด + เหตุผล
- แสดงประวัติการลาแบบ Real-time พร้อมสถานะ (รออนุมัติ / อนุมัติแล้ว / ไม่อนุมัติ)

#### 📊 ชั่วโมงทำงาน
- คำนวณชั่วโมงทำงานสะสม 3 ช่วง:
  - **ตั้งแต่เริ่มฝึกงาน** (สำหรับ Extern/Intern)
  - **ตั้งแต่ต้นเดือน**
  - **ตั้งแต่ต้นปี**
- รองรับกรณีลืมลงเวลาออก (ใช้ 23:00 เป็น default)

#### 🔄 Auto Checkout
- หาก "เข้างาน" ทิ้งไว้ ระบบจะลงเวลา "ออกงาน" ให้อัตโนมัติที่เวลา **23:00 น.**

#### 👤 สถานะผู้ใช้งาน
| สถานะ | รายละเอียด |
|-------|-----------|
| **Pending** | รออนุมัติ — แอดมินต้องอนุมัติก่อนเริ่มใช้งาน |
| **Approved** | อนุมัติแล้ว — ใช้งานได้ปกติ |
| **Inactive** | ปิดการใช้งาน — ไม่แสดงในแดชบอร์ด/รายงาน แต่ข้อมูลยังคงอยู่ |

---

### 2) ระบบ Admin — `admin.html`

ฝั่งผู้ดูแลระบบเข้าใช้งานผ่าน **Google Sign-In** (จำกัดเฉพาะอีเมลที่กำหนด)

#### 🔐 การเข้าสู่ระบบ
- Login ด้วย Google Account ผ่าน Firebase Auth
- จำกัดสิทธิ์เฉพาะ `medlifeplus@gmail.com`
- แสดง Profile Picture + ชื่อแอดมินที่ Navbar

#### 🏠 Dashboard Header — Global Pastel Stats Cards

การ์ดสรุปข้อมูลแสดงอยู่ด้านบนสุดตลอดเวลา แบ่งเป็น 4 การ์ด:

| การ์ด | สี Gradient | ข้อมูลที่แสดง |
|-------|------------|--------------|
| 🟢 **เข้างานวันนี้** | เขียว (#e8f5e9 → #c8e6c9) | จำนวนคนที่กำลังทำงาน / คนที่มาวันนี้ + นาฬิกา real-time + รูปโปรไฟล์พนักงานที่ยังอยู่ (ขนาด 22px แสดงได้สูงสุด 8 ท่าน) |
| 🟠 **รออนุมัติลา** | ส้ม (#fff3e0 → #ffe0b2) | จำนวนคำขอลาที่รอ + อนุมัติเดือนนี้/ปีนี้ + รูปคนที่ลาปีนี้ |
| 🔵 **พนักงานทั้งหมด** | น้ำเงิน (#e3f2fd → #bbdefb) | จำนวนพนักงาน Approved + รายชื่อแผนก + thumbnail รูปแยกตามแผนก |
| 🔴 **สมาชิกใหม่** | แดง (#ffebee → #ffcdd2) | จำนวน Pending + สมาชิกใหม่เดือนนี้/ปีนี้ (คลิกเปิด Modal อนุมัติ) |

- ทุกการ์ดคลิกได้ → นำไปยังหน้าที่เกี่ยวข้อง
- **Auto Refresh**: ข้อมูลเข้า-ออกงานรีเฟรชอัตโนมัติทุก 60 วินาที

#### 📌 Tab 1: เวลาเข้า-ออก (`tabAttendance`)
- ตารางแสดงข้อมูลเข้า-ออกงานรายวัน พร้อม:
  - **Date Picker** เลื่อน << >> ได้
  - รูป Profile + ชื่อ + รหัสพนักงาน
  - **Badge สีแผนก** (Solid Color) ใช้ระบบสีจาก `colors.js`
  - สถานะ (เข้า/ออก) พร้อมคำนวณชั่วโมงทำงาน (สะสมเดือน/ปี)
  - **Today Tracking v3.15**: แสดงชั่วโมงของ "วันนี้" แยกออกมา พร้อมคำนวณให้อัตโนมัติทันทีหลังกด "ออกงาน"
  - ลิงก์ Google Maps (ถ้ามีพิกัด GPS)
  - ปุ่มลบ + ปุ่มบังคับลงเวลาออก (สำหรับคนที่ยังเข้างานค้าง)
- **Highlight Row**: แถวของพนักงานที่ยังอยู่ในที่ทำงาน (สีเขียวอ่อน)
- **ลงเวลาเอง (Manual Entry) v3.15**: 
  - มาพร้อม **Visual Employee Picker** (รูป+ชื่อ+แผนก) และช่องค้นหา
  - **Color-coded Toggle**: เลือก "เข้างาน" (เขียวอ่อน) หรือ "ออกงาน" (แดงอ่อน) พร้อมสีขอบที่เปลี่ยนตามเพื่อความชัดเจน
- **Export CSV**: ดาวน์โหลดข้อมูลเป็นไฟล์ CSV

#### 📌 Tab 2: จัดการเวร & การลา (`tabManage`)

**ส่วนคำขอลา:**
- แบ่ง 3 sub-tab: **รออนุมัติ** | **ประวัติการลา** | **แจ้งเวลาปฏิบัติงาน**
- รออนุมัติ: แสดงชื่อ, ประเภท (Badge สี), วันที่, เหตุผล + ปุ่ม ✏️ แก้ไข / ✅ อนุมัติ / ❌ ปฏิเสธ
- **Edit Before Approval v3.49**: แอดมินสามารถคลิกปุ่มแก้ไข (ดินสอ) เพื่อปรับปรุงรายละเอียด (ประเภท, วันที่, เวลา, เหตุผล, ลิงก์) ของคำขอที่พนักงานส่งมาได้ก่อนที่จะกดอนุมัติจริง
- **Profile Upload v3.50**: ในหน้าแก้ไขสมาชิก แอดมินสามารถคลิกที่รูปโปรไฟล์เพื่อเลือกไฟล์ภาพจากเครื่องและอัพโหลดขึ้น Firebase Storage ได้โดยตรง พร้อมระบบ Progress Bar แสดงสถานะ
- **Hover Details v3.51**: เพิ่มระบบ Tooltip เมื่อวางเมาส์เหนือ "Card" หรือ "Badge" ในปฏิทินและตารางต่างๆ เพื่อดูรายละเอียด (เหตุผล/ชื่อเต็ม) ได้ทันทีโดยไม่ต้องคลิกเข้าไปดูข้างใน
- เมื่ออนุมัติ: สร้าง schedule อัตโนมัติพร้อม emoji และ **ซิงค์รายละเอียดล่าสุดที่แอดมินแก้ไข** (เหตุผล/ชื่อเต็ม) ลงในตารางเวรให้ทันที
- ประวัติการลา: แสดงรายการลาป่วย/พักร้อน ที่อนุมัติแล้ว
- แจ้งเวลาปฏิบัติงาน: แสดงรายการแจ้งเวร (Work Schedule) ที่อนุมัติแล้ว แยกออกมาต่างหากเพื่อความชัดเจน
- **Detailed Popup v3.15**: คลิกดูรายละเอียดการลาได้ทั้งจากตารางประวัติ และตารางเวร (ใช้ Modal เดียวกัน ข้อมูลครบถ้วน)

**ส่วนตารางเวร (New UI v3.11):**
- **Visual Employee Picker**: เลือกพนักงานผ่านลิสต์แนวตั้งพร้อมรูปโปรไฟล์ + ช่องค้นหา (filter real-time)
- **Shift Chips**: สลับจากการเลือก dropdown เป็นปุ่มชิปกดง่าย (เช้า 08-17, เช้า 09-18, เที่ยง 11-20, เที่ยง 12-21, หยุด, ลา, กำหนดเอง)
- **Automatic Toggle**: ช่องระบุวลา "กำหนดเอง" จะแสดงเมื่อกดชิปที่เกี่ยวข้องเท่านั้น
- ประวัติเวรล่าสุด: แสดงรายการพร้อมวันและกะงานที่ได้รับมอบหมาย

#### 📌 Tab 3: รายงาน & ปฏิทิน (`tabReport`)

**ปฏิทินงาน (FullCalendar v6):**
- **Revamped UI v3.15**:
  - **Hierarchical Cards**: แสดงข้อมูลเป็นสัดส่วน (ชื่อพนักงาน > รายละเอียด/ชั่วโมง > รูป)
  - **Soft Status Colors**: พื้นหลังสีพาสเทลอ่อนพร้อมขอบเน้นสีตามประเภท (เข้างาน, เช้า, บ่าย, หยุด/ลา)
  - **Day Max Events**: จำกัดความสูงรายการต่อวันพร้อมปุ่ม "+N more" (Pill style) ป้องกันตารางยาวล้น
  - **Monospace Hours**: ตัวเลขชั่วโมงแสดงด้วย font แบบคงที่ อ่านง่ายดูเป็นทางการ
- สลับ 2 โหมด:
  - **ตารางเวร**: แสดงแผนงานล่วงหน้าพร้อมสีตามช่วงเวลา
  - **⏱️ ชั่วโมงทำงานจริง**: แสดงชั่วโมงสะสมรายวัน คำนวณเป็นทศนิยม 2 ตำแหน่ง
- **Interactive Click**: คลิกที่รายการเพื่อเปิดดูรายละเอียดฉบับเต็ม (เหตุผลการลา, ลิงก์แนบ, ช่วงเวลา)

**📊 อันดับชั่วโมงทำงานรายเดือน (Top Performers):**
- เลือกเดือน (<< >> หรือ date picker)
- Bar Chart แสดงชั่วโมงทำงานทุกคน เรียงจากมากไปน้อย
- สีแท่งกราฟตามแผนก + รูป Profile + ชื่อ + ชั่วโมงรวม

#### 📌 Tab 4: พนักงาน (`tabUsers`)

- แบ่ง sub-tab แบบ Dynamic ตามข้อมูลจริง:
  - **Active**: พนักงานทั้งหมดที่สถานะ Approved
  - **แยกตามแผนก**: แต่ละแผนกเป็น tab ของตัวเอง พร้อมจำนวนสมาชิก + สีแผนก
  - **Archive**: พนักงาน Inactive (ถ้ามี)
- แต่ละรายการแสดง: รูป, ชื่อ, Badge แผนก, ปุ่มแก้ไข ✏️ + ปุ่มลบ 🗑️
- **แก้ไขข้อมูลพนักงาน** (Modal): เปลี่ยนรหัส, ชื่อ, **เบอร์โทรศัพท์**, แผนก, สถานะ, วันเริ่ม-สิ้นสุดงาน
- ปรับปรุง: ย้ายไปใช้ Single Modal เพื่อลดความซ้ำซ้อนและรองรับ Floating Labels

#### 📌 Tab 5: fair·ness Analysis (v3.31 Refined)
- ระบบวิเคราะห์ "ความยุติธรรม" และวินัยรายแผนก/กลุ่ม (Batch):
- **Refined Scoring**: สูตรคำนวณคะแนนที่หักล้างจุดอ่อนของข้อมูล:
  - **Hours Capping**: จำกัดเพดาน 12.5 ชม./วัน ป้องกันคนลืมลงเวลาออกแล้วคะแนนพุ่ง
  - **GPS Weighting**: ชั่วโมงงานที่ลงนอกออฟฟิศ (รัศมี 500ม.) จะถูกคูณด้วยน้ำหนัก 0.8 (ลดทอน 20%)
  - **Anomaly Detection**: ติดสัญลักษณ์ ⚠️ สำหรับคนที่ทำงานเกิน 12 ชม. ในวันเดียว และ 📍 สำหรับคนที่ลงนอกสถานที่
- **Shift Distribution Chart**: กราฟแท่งซ้อน (Stacked Bar) แสดงสัดส่วนการเลือกช่วงเวลาเข้างานของแต่ละคน
- **Batch Filter**: ค้นหาแยกตามรุ่น (เช่น #6), แผนก หรือชื่อพนักงาน

#### 📌 Tab 6: ผลแบบสำรวจ (v3.31 NEW)
- แดชบอร์ดวิเคราะห์ **Staff Satisfaction & Preferences** จาก 10 ชุดคำถาม:
- **Executive Stats**: ค่าเฉลี่ยความพอใจการวนกะ, ความยุติธรรมในมุมพนักงาน, และน้ำหนักความต้องการส่วนตัว
- **Analysis Charts**: กราฟโดนัทกะงานที่ฮิตที่สุด และกราฟเปรียบเทียบพึงพอใจรายแผนก
- **Qualitative Feedback**: รายการข้อเสนอแนะ, ปัญหาสุขภาพ, และข้อจำกัดการเดินทางแยกรายบุคคล
- **Detail View**: กดอ่านผลแบบสำรวจฉบับเต็มของพนักงานแต่ละคนได้ทันที

#### 📌 Tab 7: แบบประเมิน (`tabEval`)
- ระบบจัดการไฟล์ประเมินนิสิตเภสัช (XLSX) แบบ Multi-file
- **Completion Tracking**: แสดงเปอร์เซ็นต์ความคืบหน้า (Progress Bar) ของนักศึกษาแต่ละคน
- **Visual Structure**: แยก Section ในแบบประเมินด้วยแถบสีที่หมุนเวียน (Color-cycling) 8 สี
- **Storage Mode Detection**: แสดงสถานะ **Online** (สีเขียว) เมื่อดึงข้อมูลจาก Admin หรือ **Local only** เมื่อใช้งานแยก
- เชื่อมโยงรูปโปรไฟล์พนักงานอัตโนมัติหากชื่อตรงกับฐานข้อมูลหลัก

#### 📱 LIFF Preview Mode
- **Real-time Preview**: แสดงหน้าจอพนักงานภายในกรอบโทรศัพท์ (iPhone Frame)
- **Data Binding**: ดึงข้อมูลพนักงานจริง (ชื่อ, รูป, แผนก) มาแสดงในโหมด Preview เพื่อความสมจริง
- **Navigation Control**: ปุ่มเปิด-ปิดชัดเจน พร้อม badge แสดงเวอร์ชันระบบกำกับข้างๆ

#### 🔔 Modal: อนุมัติสมาชิกใหม่
- เปิดจากการ์ด "สมาชิกใหม่" (แดง)
- แสดงรายชื่อ Pending พร้อมรูป, ชื่อ, รหัส, แผนก
- ปุ่ม ✅ รับเข้า + ❌ ปฏิเสธ
- แจ้งเตือนด้วย Popup เมื่อมีสมาชิกใหม่รอ

---

## 🗄️ โครงสร้างข้อมูล (Firestore Collections)

### `users`
| Field | Type | Description |
|-------|------|-------------|
| `lineUserId` | string | LINE User ID (Primary Key) |
| `name` | string | ชื่อ-นามสกุล |
| `empId` | string | รหัสพนักงาน |
| `dept` / `department` | string | แผนก |
| `status` | string | `Pending` / `Approved` / `Inactive` |
| `pictureUrl` | string | URL รูปโปรไฟล์จาก LINE |
| `startDate` | string | วันเริ่มงาน/ฝึกงาน |
| `endDate` | string | วันสิ้นสุดงาน/ฝึกงาน |
| `createdAt` | timestamp | วันที่ลงทะเบียน |

### `attendance`
| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | LINE User ID ของพนักงาน |
| `name` | string | ชื่อพนักงาน |
| `empId` | string | รหัสพนักงาน |
| `dept` | string | แผนก |
| `type` | string | `เข้างาน` / `ออกงาน` |
| `timestamp` | timestamp | เวลาที่บันทึก |
| `mapUrl` | string | ลิงก์ Google Maps (พิกัด GPS) |

### `schedules`
| Field | Type | Description |
|-------|------|-------------|
| Document ID | string | `{userId}_{date}` |
| `userId` | string | LINE User ID |
| `name` | string | ชื่อพนักงาน |
| `date` | string | วันที่ (YYYY-MM-DD) |
| `shiftDetail` | string | รายละเอียดกะ เช่น `☀️ เช้า (08:00 - 17:00)` หรือ `🤒 ลาป่วย` |
| `timestamp` | timestamp | วันที่สร้าง |

### `leave_requests`
| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | LINE User ID |
| `name` | string | ชื่อพนักงาน |
| `type` / `leaveType` | string | ประเภทการลา (ลาป่วย / ลาพักผ่อน) |
| `startDate` | string | วันเริ่มลา |
| `endDate` | string | วันสิ้นสุดลา |
| `reason` | string | เหตุผล |
| `status` | string | `Pending` / `Approved` / `Rejected` |
| `requestedAt` | timestamp | วันที่ส่งคำขอ |

---

## 🏗️ โครงสร้างไฟล์ (File Structure)

```
2026-in-out-dashboard/
├── index.html          # หน้าพนักงาน (LINE LIFF) — ลงเวลา, ดูประวัติ, ส่งคำขอลา
├── admin.html          # หน้า Admin Portal — Dashboard, จัดการ, รายงาน
├── admin.js            # JavaScript หลักของ Admin (ES Module)
├── config.js           # [Private] ไฟล์เก็บ Firebase Config และ Admin List (ไม่นำขึ้น Git)
├── config.example.js   # ไฟล์ตัวอย่าง Config สำหรับการตั้งค่าเริ่มต้น
├── firestore.rules     # กฎความปลอดภัยสำหรับการเข้าถึงฐานข้อมูล
├── storage.rules       # กฎความปลอดภัยสำหรับการเข้าถึงไฟล์ (Storage)
├── colors.js           # ระบบสี Department (Shared Module)
├── admin.css           # CSS สำหรับ Admin Panel
├── login.html          # หน้า fallback login
├── eval.html           # ระบบบันทึกคะแนนและประเมินผลนิสิตฝึกงาน (Standalone/Iframe)
├── firebase.json       # Firebase config (Security Rules + Hosting)
├── .firebaserc         # Firebase project binding
├── .github/            # GitHub Actions (auto-deploy GitHub Pages)
├── package.json        # npm dependencies (gh-pages)
└── README.md           # ← ไฟล์นี้
```

---

## 🎨 ระบบสีแผนก (Department Color System)

ระบบสีจัดการผ่านไฟล์ `colors.js` ซึ่ง export ฟังก์ชัน `getDeptCategoryColor(dept)` แบบ High-Contrast ดังนี้:

| แผนก (Department) | สี (Color) | รหัสสี (Hex) | Pattern Match |
|-------------------|------------|--------------|---------------|
| Pharmacist Extern / นักศึกษา | 🔵 Dark Blue | `#0056b3` | `/Pharmacist Extern\|นักศึกษา/i` |
| Pharmacy / คลังยา / เภสัช | 🟢 Forest Green | `#0f7d45` | `/Pharmacy\|คลังยา\|เภสัช/i` |
| General / ทั่วไป | ⚫ Slate Gray | `#495057` | `/General\|ทั่วไป/i` |
| IT / ไอที | 🟣 Royal Purple | `#5a2d9c` | `/IT\|ไอที/i` |
| Admin / ธุรการ | 🔴 Crimson Red | `#c21b2e` | `/Admin\|ธุรการ/i` |
| Sales / การตลาด | 🟠 Deep Orange | `#e65100` | `/Sales\|การตลาด/i` |
| HR / บุคคล | 🌸 Raspberry Pink | `#b82167` | `/HR\|บุคคล/i` |
| อื่นๆ (Default) | ⬛ Midnight Dark | `#1a1d20` | (fallback) |

สีเหล่านี้ปรากฏสอดคล้องกันทั่วทั้งระบบ:
- **Badge** แสดงแผนกในตาราง (Solid Background + White Text)
- **ขอบรูปโปรไฟล์** ใน Dashboard Cards & Active User Profiles
- **Bar Chart** อันดับชั่วโมงทำงาน
- **FullCalendar** events สีตามแผนก
- **Sub-tabs** ในหน้าพนักงาน (Tab ชื่อแผนก + Badge จำนวน)

---

## 🔗 Dependencies & CDN

### Admin Panel (`admin.html`)
| Library | Version | Usage |
|---------|---------|-------|
| Bootstrap | 5.3.0 | UI Framework, Tabs, Modals, Grid |
| Bootstrap Icons | 1.11.3 | Icon Set |
| FullCalendar | 6.1.10 | ปฏิทินงาน |
| Chart.js | latest | Top Performers Chart |
| SweetAlert2 | 11 | Alerts, Toasts, Confirmations |
| Google Fonts | Sarabun + Roboto Mono | Typography |
| Firebase SDK | 10.7.1 | Auth + Firestore |

### Employee Page (`index.html`)
| Library | Version | Usage |
|---------|---------|-------|
| LINE LIFF SDK | edge/2 | LINE Login & Profile |
| Bootstrap Icons | 1.11.3 | Icon Set |
| SweetAlert2 | 11 | Alerts |
| Google Fonts | Sarabun | Typography |
| Firebase SDK | 10.7.1 | Auth + Firestore |

---

## 🔧 Firebase Configuration

```javascript
// firebase.json — Hosting Config
{
  "hosting": {
    "public": ".",
    "ignore": ["firebase.json", "**/node_modules/**", ".git/**"],
    "headers": [{
      "source": "**/*.html",
      "headers": [{
        "key": "Cache-Control",
        "value": "no-cache, no-store, must-revalidate"
      }]
    }]
  }
}
```

> **Note**: HTML files are set to `no-cache` เพื่อให้ผู้ใช้ได้รับ version ล่าสุดเสมอ

---

## 🛡️ ระบบความปลอดภัย (Security Architecture)

### 1) การตั้งค่าระบบ (Configuration)
- **Client-side Config**: ข้อมูล Firebase Config (API Keys) ถูกฝังไว้ในโค้ดเพื่อความง่ายในการ Deploy (ความปลอดภัยหลักไปจัดการที่ Firestore Rules)
- **Environment Management**: รองรับการแยก LIFF ID สำหรับ Production และ Test Environment

### 2) การตรวจสอบสิทธิ์แอดมิน (Admin Authorization)
ระบบใช้โครงสร้างการตรวจสอบ 2 ชั้น:
- **ชั้นที่ 1 (Fallback)**: ตรวจสอบจากอีเมลแอดมินหลักที่ระบุในโค้ด (`FALLBACK_ADMIN`)
- **ชั้นที่ 2 (Database)**: ตรวจสอบจาก UID ใน Collection `admins` บน Firestore (รองรับการเพิ่ม/ลดแอดมินได้ทันทีโดยไม่ต้อง Deploy ใหม่)

### 3) กฎความปลอดภัย (Security Rules) — Update v3.15
- **Public Core Access**: อนุญาตให้ LIFF Users (สาธารณะ) สามารถ `read` และ `create` ในคอลเลกชัน `users`, `attendance`, `leave_requests`, และ `schedules` เพื่อให้ระบบ Login และบันทึกเวลาทำงานได้โดยไม่ต้องผ่าน Firebase Auth (ใช้ LIFF ID เป็นตัวระบุตัวตนแทน)
- **Admin Control**: เฉพาะแอดมินที่ผ่านการตรวจสอบสิทธิ์เท่านั้นที่มีสิทธิ์ `update` หรือ `delete` ข้อมูลในทุกคอลเลกชัน
- **Admin Collection Protection**: คอลเลกชัน `admins` ถูกจำกัดให้อ่านได้เฉพาะแอดมินเท่านั้น

---

## 📝 Changelog

### v3.51 — 2026-02-24
- 🖱️ **Hover Details & Tooltips**: เพิ่มการแสดงรายละเอียด (เหตุผล/หมายเหตุ) เมื่อวางเมาส์เหนือ Card ในปฏิทิน และ Badge ในตารางจัดการเวร/ลา ช่วยให้ตรวจสอบข้อมูลได้รวดเร็วขึ้น
- 🛡️ **UI Consistency**: เพิ่ม Tooltip ในหน้าพนักงานเพื่อแสดงชื่อเต็มและแผนกเมื่อวางเมาส์เหนือรายการ

### v3.50 — 2026-02-24
- 📸 **Admin Profile Upload**: เพิ่มระบบอัพโหลดรูปโปรไฟล์พนักงานผ่าน Firebase Storage โดยแอดมินสามารถคลิกที่รูปในหน้า Edit User เพื่อเปลี่ยนรูปได้ทันที
- ⏳ **Upload Progress UI**: เพิ่มแถบสถานะการโหลด (Progress Bar) ขณะอัพโหลดรูปภาพ
- 🛡️ **Storage Security**: ตั้งค่า Storage Rules ให้เฉพาะแอดมินเท่านั้นที่สามารถเขียนไฟล์ได้

### v3.49 — 2026-02-24
- 📑 **Separate History Tabs**: แยกประวัติคำขอลาที่อนุมัติแล้วออกเป็น 2 Tab: "ประวัติการลา" และ "แจ้งเวลาปฏิบัติงาน" เพื่อความเป็นระเบียบ
- ✏️ **Edit Before Approval**: เพิ่มปุ่มแก้ไขในรายการรออนุมัติ ให้แอดมินปรับเปลี่ยนประเภท วันที่ เวลา หรือเหตุผลได้ก่อนกดอนุมัติจริง
- 🕒 **Work Schedule Type Support**: เพิ่มการรองรับประเภท "ปฏิบัติงาน" โดยเฉพาะ พร้อมไอคอน 🕒 และระบบซิงค์ข้อมูลที่แม่นยำขึ้น
- 🔄 **Refactored Approval Logic**: ปรับปรุงระบบอนุมัติให้ดึงข้อมูลล่าสุดจาก DB เสมอ เพื่อให้การแก้ไขก่อนอนุมัติมีผลสมบูรณ์

### v3.15 — 2026-02-16
- 🎨 **Calendar Revamp**: ปรับ UI ปฏิทินโหมด Report ใหม่ทั้งหมด ให้ดูพรีเมียมและสบายตาขึ้น (Hierarchy Cards + Soft Status Colors)
- 📌 **Day Max Events**: ระบบ "+N more" สไตล์ Pill ในปฏิทิน ป้องกันรายการยาวทะลักและจัดระเบียบตารางให้นิ่ง
- ⏱️ **Daily Hours Display**: แสดงชั่วโมงทำงานของ "วันนี้" (ยอดรวมคู่เข้า-ออก) ในหน้า Dashboard สำหรับแอดมิน
- 🔄 **Leave-Schedule Sync**: ระบบซิงค์รายละเอียดการลา (เหตุผล, ช่วงวันที่, ลิงก์แนบ) ลงในตารางเวรและปฏิทินโดยอัตโนมัติ
- 🖱️ **Interactive Calendar**: คลิกรายการบนปฏิทินเพื่อเปิดดูรายละเอียดฉบับเต็ม (Modal ชุดเดียวกับประวัติการลา)
- 🏗️ **Manual Entry v2**: เพิ่ม Visual User Picker (รูป+ชื่อ+แผนก) และแถบสลับประเภท In/Out แบบเปลี่ยนสีตามสถานะ เพื่อป้องกันการลงเวลาผิดประเภท
- 📅 **Day Counter for Interns**: ระบบนับเวลาถอยหลัง (Days Left) สำหรับนิสิตฝึกงานที่มีวันสิ้นสุดฝึกงาน พร้อมแถบสีแจ้งเตือน (แดง/ส้ม/เขียว)
- 📋 **Copy Daily Summary**: ปุ่มคัดลอกสรุปการเข้างานประจำวันสำหรับแอดมิน (Copy to Clipboard)
- 🛡️ **Public Access Rules**: ปรับปรุง `firestore.rules` ให้ LIFF Users เข้าถึงข้อมูลพื้นฐานได้เสถียรขึ้นโดยไม่ต้องใช้ Firebase Auth
- 🛡️ **Deployment Fix**: ฝัง Firebase Config กลับเข้า codebase เพื่อแก้ปัญหาไฟล์ config หายขณะ Deploy พร้อมรักษาความปลอดภัยผ่าน Database Rules

### v3.14 — 2026-02-15
- 🛡️ **Security Hardening**: แยก Firebase Config ออกจาก codebase หลัก
- 🛡️ **Rule Enforcement**: เพิ่มไฟล์ `firestore.rules` และ `storage.rules` เพื่อทำ Data Isolation
- 🛡️ **Admin UID Access**: เพิ่มระบบตรวจสอบสิทธิ์แอดมินผ่าน Firestore Collection (`admins`)
- 🔒 **Git Protection**: อัปเดต `.gitignore` เพื่อซ่อนไฟล์ Secret และนำ `node_modules` ออกจากระบบ
- ✨ **Evaluation Enhancements**: เพิ่ม Progress Bar แสดง % ความคืบหน้าของนิสิตแต่ละคน
- ✨ **Data Sync Badge**: แสดงสถานะ Online/Local ในหน้าประเมิน
- 🎨 **Visual Evaluation**: ใส่สีแถบ Section ในตารางประเมินให้ต่างกัน 8 สี
- 🐛 **Fix LIFF Preview**: ปรับ Preview ให้ข้าม LINE Login (บล็อก embed) แต่ดึงข้อมูลพนักงานจริงมาแสดงแทน
- 🧹 **Modal Cleanup**: ลบ Duplicate Modal ในหน้า Admin และจัดระเบียบ ID ใหม่

### v3.12 — 2026-02-15
- ✨ **Navbar Updates**: ย้ายเลขเวอร์ชันไปไว้ที่ Navbar และปรับย้ายปุ่ม "บันทึกเวลาเอง" ไปไว้ใน Tab Attendance
- ✨ **Contact Info**: เพิ่มช่องกรอก "เบอร์โทรศัพท์" พนักงานในหน้าแก้ไขข้อมูล
- 🎨 **Dashboard Optimization**: ปรับขนาดรูปโปรไฟล์พนักงานในการ์ดเหลือ 22px เพื่อให้แสดงได้สูงสุด 8 คน

### v3.11 — 2026-02-15
- 🏗️ **Schedule UI Refactor**: เปลี่ยนระบบเลือกพนักงานและกะเป็นแบบ Visual
- ✨ **Employee Picker**: ค้นหาพนักงานพร้อมรูปโปรไฟล์และแผนก ลิสต์แสดงเฉพาะเมื่อค้นหา
- ✨ **Shift Chips**: ใช้ระบบปุ่ม Chip แทน Dropdown พร้อมกะใหม่ (เช้า 08-17, 09-18, เที่ยง 11-20, 12-21)


### v3.31 — 2026-02-22 (Refined Fairness & Survey)
- 🛡️ **Fairness Score 2.0**: ยกระดับความแม่นยำด้วยระบบจำกัดเพดานชั่วโมง (12.5h) และการลดทอนน้ำหนักชั่วโมงที่ลงนอกสถานที่ (GPS Weight 0.8)
- 📊 **Satisfaction Survey Dashboard**: ระบบแบบสำรวจ 10 ข้อใน LIFF พร้อมหน้าวิเคราะห์สถิติและการตอบกลับเชิงคุณภาพในฝั่ง Admin
- ⚠️ **Data Quality Indicators**: ไอคอนแจ้งเตือน ⚠️ (Anomaly) และ 📍 (Off-site) ในตาราง Fairness เพื่อการตรวจสอบที่รวดเร็ว
- 📈 **Quantitative Charts**: เพิ่มกราฟโดนัทกะงานที่ชอบ และกราฟเปรียบเทียบความยุติธรรมรายแผนก

### v3.30 — 2026-02-21
- 🔒 **Schedule-Lock System**: บังคับพนักงานส่งเวรปฏิบัติงานก่อนถึงจะกด Clock In/Out ได้ (Hard Block) เพื่อความถูกต้องของข้อมูล
- ⚡ **Auto-Approve Schedules**: ระบบอนุมัติกะงาน (Work Schedule) อัตโนมัติทันที พร้อมกระจายลงตารางรายวันให้เสร็จสรรพ
- ⚠️ **Late Detection & UI Grid**: 
    - ระบบตรวจจับมาสายอัตโนมัติ (Grace Period 5 นาที) พร้อมบังคับระบุเหตุผล
    - ปรับโฉมหน้าแจ้งเวรใหม่เป็นสไตล์ Modern Card พร้อมระบบ **Grid Selection** (08-17, 09-18, 10-19, ...)
- � **Admin Insights**: เพิ่ม Badge "สาย" ในหน้า Admin ที่สามารถคลิกดูเหตุผลและจำนวนนาทีที่สายได้ทันที
- 🛠️ **UX Improvements**: เพิ่มคำแนะนำการกรอกช่วงวัน (Date Range) และระบบ Validation ป้องกันการกรอกเวลาที่ย้อนแย้งกัน

### v3.21 (Current)
- **Schedule Details Fix**: Fixed an issue where the "reason" and "attachment link" were not showing in the admin schedule details modal. The data loading logic now correctly includes these fields.

### v3.20
- **Silent Name/Pic Sync**: Both profile picture and LINE display name are now automatically synchronized whenever a user logs in.
- **Admin Name Info**: Added a subtitle in the user management list to show the LINE name if it differs from the registered name, making identification easier.

### v3.19
- **Emoji Fix**: Removed duplicate emojis (e.g., 🤒🛑) in leave/schedule lists. Only the primary category emoji is now shown.
- **Profile Image Fallback**: Improved handling for users without a LINE profile picture, ensuring a fallback to previously saved versions or placeholders.

### v3.18
- **User Stats Dashboard**: Added a new "Stats" button for each user to view their work hours (Total, Year, Month) and detailed leave history in a single view.
- **Improved Performance Metrics**: Real-time calculation of accumulated hours and categorized leave breakdown.

### v3.17
- **Profile Image Sync Fix**: Implemented unified profile picture helper with per-minute cache busting.
- **Improved Visual Accuracy**: All profile pictures across the admin panel now synchronize more reliably with the latest Firestore data.
- **Unified Image Helper**: Simplified code by centralizing profile image rendering logic.

### v3.16
- **Calendar Mode Switching**: Added custom buttons to toggle between 'Attendance Mode' (Actual) and 'Schedule Mode' (Planned).
- **Attendance Mode Details**: Clicking on a date or attendance event now shows a detailed breakdown of employees and their working hours with pastel-colored bars.
- **Dynamic Work Intensity**: Calendar event backgrounds now reflect the duration of work hours (deeper colors for longer shifts).
- **Department Pastel Colors**: Implemented a new design system for department-specific pastel tones to improve visual distinction.
- **Copy Daily Summary**: Added a button within the daily attendance detail modal to copy a formatted text summary of employees working on that day, grouped by department.
- **Fix Duplicate Emojis**: Resolved an issue in the schedule table where leave emojis were being prepended multiple times.
- **Unify Leave Detail popups**: Synchronized the display format for leave details across the board (Schedules, Leave History, and Calendar).

### v3.1 — 2026-02-15 (Stable)
- 🐛 **Critical Fix**: `switchTab()` crash เพราะ `getAttribute('onclick')` คืน `null` สำหรับ inner nav-links → ทำให้ Tab พนักงาน, ปฏิทิน, การลา ไม่โหลดข้อมูล
- 🐛 **Fix**: การ์ด "เข้างานวันนี้" แสดงจำนวนผิด (ใช้ totalApproved แทน uniqueUsersToday)
- 🐛 **Fix**: HTML table IDs ไม่ตรงกับ JS (`leaveRequestsTable` → `leavePendingTableBody`, `approvedLeaveTable` → `leaveApprovedTableBody`, `scheduleTable` → `schedTableBody`)
- ♻️ ปรับ `switchTab()` ให้ target เฉพาะ `#mainTab .nav-link` พร้อม null-check
- ✨ เพิ่ม Auto-Refresh attendance data ทุก 60 วินาที
- ✨ เพิ่ม interval cleanup เมื่อ re-auth (ป้องกัน memory leak)
- ♻️ Harmonize user data indexing ให้ใช้ `lineUserId || doc.id` สม่ำเสมอ

### v3.0 — 2026-02-15
- 🏗️ **Major HTML Refactor**: แก้ไข div nesting ที่เสียหาย ทำให้ layout ผิดพลาดทั้งหน้า
- ✨ ย้าย Pastel Stats Cards เป็น Global Dashboard Header (แสดงตลอดทุก tab)
- ✨ คืนค่า Navigation Tabs (Bootstrap `nav-tabs`) เป็น primary navigation
- 🧹 ลบ duplicate/malformed HTML ที่ทำให้ layout พัง

### v2.0 — 2026-02-15
- 🎨 **High-Contrast Premium UI**: ปรับแก้ระบบ Badge ทั้งหมดเป็น Solid Color + White Text
- 🎨 **Vibrant Summary Cards**: Gradient pastel cards แยกหมวดข้อมูลชัดเจน
- ✨ **Real-time Stats**: แสดงโปรไฟล์พนักงานที่กำลังทำงาน + ขอบสีตามแผนก
- ✨ **Department Breakdown**: แสดงจำนวนพนักงานแยกแผนกพร้อม thumbnail ในการ์ด
- ✨ **Leave System**: ระบบคำขอลาพร้อม sub-tabs (รออนุมัติ / ประวัติ)
- ✨ **Manual Entry**: แอดมินลงเวลาแทนพนักงานในรูปแบบ 24 ชั่วโมง
- ✨ **Top Performers Chart**: กราฟชั่วโมงทำงานรายเดือน สีตามแผนก
- ✨ **Advanced Calendar**: 2 โหมด (ตารางเวร / ชั่วโมงจริง) + รูปโปรไฟล์
- ✨ **User Management**: แบ่ง Active/Inactive + Archive tab + แก้ไข/ลบ

---

## 🚀 วิธี Deploy

### Firebase Hosting & Rules (Production)
```bash
# Deploy ทุกอย่าง (Rules + Hosting)
firebase deploy

# Deploy เฉพาะส่วนที่จำเป็น (ในกรณีที่ยังไม่ได้เปิด Storage)
firebase deploy --only "firestore,hosting"
```

### GitHub Pages (Mirror)
```bash
git add .
git commit -m "your message"
git push origin main
# GitHub Actions จะ auto-deploy ให้
```

### Deploy ทั้งสอง (PowerShell)
```powershell
git add .; git commit -m "update"; git push origin main; firebase deploy --only "firestore,hosting"
```

---

## ⚙️ Tech Stack Summary

```
Frontend:     HTML5 + Vanilla JS (ES Modules) + Bootstrap 5
Backend:      Firebase Firestore (NoSQL)
Auth:         Firebase Auth (Google) + LINE LIFF SDK
Hosting:      Firebase Hosting + GitHub Pages
Calendar:     FullCalendar v6
Charts:       Chart.js
Alerts:       SweetAlert2
Fonts:        Google Fonts (Sarabun, Roboto Mono)
```
