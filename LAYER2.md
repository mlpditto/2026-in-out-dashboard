# 🔐 Layer 2 — ยืนยันตัวตนพนักงานด้วย Firebase Auth

สถานะ: **function + หน้าเว็บ deploy แล้ว (2026-09-17) — rules ยังเป็น Layer 1**

เหลือขั้นที่ 6 (ทดสอบจากมือถือจริง) และขั้นที่ 7 (สลับ rules) เท่านั้น

---

## ปัญหาที่ Layer 2 แก้

หน้าพนักงาน (`index.html`) ล็อกอินผ่าน LINE LIFF เท่านั้น ไม่เคยยืนยันตัวตนกับ Firebase เลย
ทุก request ที่ยิงเข้า Firestore จึงเป็น **anonymous** — security rules ไม่มีอะไรให้ตรวจ

ผลคือทุกวันนี้ `attendance`, `schedules`, `leave_requests` **อ่านได้โดยไม่ต้องล็อกอิน** ทั้งที่ข้างในมี

*   พิกัด GPS ทุกครั้งที่ตอกบัตร
*   เหตุผลการลา (รวมลาป่วย)
*   ลิงก์ใบรับรองแพทย์

Layer 2 ทำให้หน้าพนักงาน sign in กับ Firebase จริง โดย **uid = LINE user id** ซึ่งตรงกับค่า `userId`
ที่ทุก document ในฐานข้อมูลเก็บอยู่แล้ว rules จึงเทียบ `resource.data.userId == request.auth.uid` ได้ตรง ๆ
โดยไม่ต้องย้ายข้อมูลเดิมแม้แต่ document เดียว

```
LIFF id token ──▶ Cloud Function (lineLogin) ──▶ LINE verify API
                          │
                          └──▶ createCustomToken(uid = LINE user id)
                                        │
                     index.html ◀───────┘  signInWithCustomToken()
```

---

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | บทบาท |
|------|--------|
| `functions/index.js` | Cloud Function `lineLogin` — ตรวจ id token กับ LINE แล้วออก Firebase custom token |
| `functions/package.json` | dependencies ของ function (Node 22) |
| `firestore.rules.layer2` | rules ชุดใหม่ **ยังไม่ใช่ตัวที่ deploy** (`firebase.json` ยังชี้ไปที่ `firestore.rules`) |
| `test/firestore.rules.layer2.test.mjs` | เทส 30 เคสของ rules ชุดใหม่ |
| `index.html` | เรียก `signInWithLine()` ก่อนโหลดข้อมูล |

`index.html` ออกแบบให้ **ล้มแบบไม่พังหน้าเว็บ**: ถ้ายังไม่มี function ให้เรียก จะ log คำเตือนแล้วทำงานต่อ
ตาม rules ปัจจุบันได้ตามปกติ — deploy hosting ก่อน function ได้โดยไม่มีอะไรเสียหาย

---

## ข้อกำหนดก่อน deploy

Cloud Functions ต้องใช้แผน **Blaze (pay-as-you-go)** ต้องผูกบัตรเครดิต และตอนนี้โปรเจกต์
`in-out-dashboard` ยังไม่เคยเปิด Cloud Functions API เลย

ค่าใช้จ่ายจริงของงานขนาดนี้แทบเป็นศูนย์ — free tier ให้ 2,000,000 invocation/เดือน
ร้านที่มีพนักงานหลักสิบคนใช้ไม่ถึงหลักพันครั้ง/เดือน แต่ **ควรตั้ง budget alert ไว้กันเหนียว**

---

## ขั้นตอน deploy (ทำตามลำดับ ห้ามข้าม)

### 1. เปิด Blaze + Cloud Functions API (ทำเองในคอนโซล)

*   https://console.firebase.google.com/project/in-out-dashboard/usage/details → Modify plan → Blaze
*   ตั้ง budget alert เช่น 100 บาท/เดือน
*   https://console.developers.google.com/apis/api/cloudfunctions.googleapis.com/overview?project=in-out-dashboard → Enable

### 2. ตรวจว่า LINE channel id ถูกต้อง

`functions/index.js` ใช้ค่า default `2008951813` ซึ่งมาจากครึ่งหน้าของ LIFF ID
(`2008951813-KgjInNxK`) ถ้า LINE Login channel เป็นคนละเลข ให้ใส่ `LINE_CHANNEL_ID=<เลขใหม่>`
ในไฟล์ `functions/.env` แล้ว deploy function ใหม่ — ไม่ต้องแก้โค้ด

ค่านี้ไม่ใช่ความลับ มันฝังอยู่ใน `index.html` ที่เปิดเผยต่อสาธารณะอยู่แล้ว

### 3. ติดตั้ง dependencies ของ function

```bash
npm --prefix functions install
```

### 4. Deploy function

```bash
firebase deploy --only functions
```

### 5. Deploy หน้าเว็บ (ทั้งสองโฮสต์)

```bash
firebase deploy --only hosting
```

```bash
npm run build
```

```bash
npm run deploy
```

### 6. ทดสอบจริงก่อนล็อก rules ⚠️ สำคัญที่สุด

เปิดหน้าพนักงานจาก LINE จริง แล้วดูว่า debug log ขึ้น **"ยืนยันตัวตนกับระบบเรียบร้อย"**
ถ้ายังขึ้น "⚠️ ยังไม่ได้ยืนยันตัวตนกับ Firebase" **ห้ามทำขั้นที่ 7** เพราะพนักงานจะใช้งานไม่ได้ทั้งระบบ

### 7. สลับ rules เป็น Layer 2

```bash
npm run test:rules:layer2
```

```bash
cp firestore.rules.layer2 firestore.rules
```

```bash
firebase deploy --only firestore:rules
```

---

## ถ้าพัง — ย้อนกลับทันที

```bash
git show HEAD:firestore.rules > firestore.rules
```

```bash
firebase deploy --only firestore:rules
```

rules ชุดเก่ายอมให้ anonymous อ่านได้ ระบบจึงกลับมาใช้งานได้ทันทีแม้ function จะยังพังอยู่

---

## สิ่งที่ Layer 2 เปลี่ยนในเชิงสิทธิ์

| collection | เดิม (Layer 1) | ใหม่ (Layer 2) |
|------------|----------------|----------------|
| `users` | ใครรู้ LINE id ก็อ่าน document นั้นได้ | อ่านได้เฉพาะของตัวเอง |
| `attendance` | อ่านได้ทุกคน ทุก record | อ่านได้เฉพาะของตัวเอง (GPS ปิดแล้ว) |
| `leave_requests` | อ่านได้ทุกคน | อ่านได้เฉพาะของตัวเอง (เหตุผลลา/ใบรับรองแพทย์ปิดแล้ว) |
| `schedules` | อ่านได้ทุกคน | อ่านได้เฉพาะของตัวเอง |
| `survey_responses` | เขียนของตัวเองได้ | เขียนของตัวเองได้ + ต้องล็อกอิน |
| `cash_submissions` | เขียนได้ถ้ามี userId | เขียนได้เฉพาะในชื่อตัวเอง |
| การเขียน | อ้าง userId เป็นใครก็ได้ | อ้างได้เฉพาะ uid ตัวเอง — ตอกบัตรแทนกันไม่ได้ |

หน้า Admin ไม่ได้รับผลกระทบ เพราะ global admin override ยังครอบทุก collection เหมือนเดิม

---

## เทส

```bash
npm run test:rules
```

```bash
npm run test:rules:layer2
```

ชุดแรกเทส rules ที่ใช้งานจริงตอนนี้ (36 เคส) ชุดหลังเทส `firestore.rules.layer2` (30 เคส)
เมื่อสลับไปใช้ Layer 2 แล้ว ให้ย้ายเคสที่ยังมีประโยชน์จากชุดแรกมารวมกัน แล้วลบชุดเก่าทิ้ง
