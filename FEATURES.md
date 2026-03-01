# 🚀 Features - MLP Time Attendance Dashboard (v3.52)

### 🌟 New in v3.52: Task Alerts & Cash Submission
*   🔔 **Task Reminder Alerts (แจ้งเตือนภาระงาน):** Admins can set custom reminder messages for individual employees to display when they clock in or out.
*   💰 **Cash Submission System (ระบบส่งยอดเงิน):** A new tool for staff (when enabled by admin) to input and calculate daily cash collections (coins/banknotes) before ending their shift.

### 🌟 New in v3.51: Hover Details & Quick Inspection
*   🖱️ **Hover Details (Tooltips):** Mouse over any "Card" in the calendar or "Badge" in management tables to instantly see the full name, shift details, or reasons. No more repetitive clicking!
*   📸 **Admin Profile Upload (v3.50):** Direct image uploads to Firebase Storage via the user edit modal.
*   ⏳ **Visual Progress Tracking (v3.50):** Real-time feedback during profile photo uploads.
*   ✏️ **Edit Before Approval (v3.49):** Correct mistakes in staff requests before they become official.

### 🌟 Previous Updates
*   🕙 **Closing Shift (12:00 - 21:00):** Integrated throughout the system.
*   📱 **Mobile Survey Optimization:** Forced horizontal layout for rating buttons (1-5).
*   🛡️ **Fairness Score (Refined):** Added Hours Capping, GPS Weighting, and Anomaly Detection.
*   📊 **Satisfaction Survey:** Full-cycle survey for staff shift preferences with Admin Analytics dash.

## 📋 Employee Interface (Mobile LIFF)
The employee interface is accessible via LINE LIFF, providing a seamless experience for time recording and leave management.

### 1. Registration & Profiling
*   **LINE Profile Sync:** Automatic synchronization of Display Name and Profile Picture from LINE.
*   **Registration Form:** Secure onboarding with Employee ID, Department selection, and Approval process.
*   **Approval Status:** Real-time status tracking (Pending/Approved) with restricted access until approved.

### 2. Time Attendance (GPS-Verified)
*   **Check-In/Out:** One-tap time recording for "เข้างาน" (Clock-in) and "ออกงาน" (Clock-out).
*   **GPS Verification:** Automatic capturing of geolocation and generation of Google Maps links for location audits.
*   **Status Indicators:** Visual feedback of current status (In/Out) on the main dashboard.

### 3. Leave Requests
*   **Multi-type Leave:** Supports Sick Leave (ลาป่วย), Personal Leave (ลากิจ), Vacation (ลาพักร้อน), and others.
*   **Attachment Support:** Ability to attach document links for medical certificates or proofs.
*   **History Tracking:** Employees can view their past leave requests and approval status.

### 4. Personal Dashboard
*   **Working Hours Summary:** Real-time calculation of daily, monthly, and yearly working hours.
*   **Internship Tracker:** Countdown timer for students showing "Days Left" until the completion of their internship.
*   **Personal Schedule:** View of assigned shifts and approved leaves for the current month.

### 5. Advanced Attendance Logic (v3.30)
*   🔒 **Schedule-Lock System**: บังคับพนักงานต้องมีเวรในระบบก่อนจึงจะกดเข้างานได้ ป้องกันข้อมูลขาดหาย
*   ⚡ **Auto-Approve Schedules**: ระบบอนุมัติกะงานทันที พนักงานส่งเสร็จลงเวลาได้เลยไม่ต้องรอ
*   🔘 **Modern Grid Selection**: หน้าแจ้งเวรใหม่แบบ Grid (08-17, 09-18, ...) เลือกง่ายแค่คลิกเดียว
*   📝 **Late Detection System**: ระบบแจ้งเตือนมาสายอัตโนมัติ (เกิน 5 นาที) พร้อมบังคับระบุเหตุผลผ่าน Popup
*   🛠️ **Time Validation**: ระบบป้องกันการกรอกวัน/เวลาเริ่ม-จบที่ย้อนสลับกัน

---

### 6. Admin Panel (Desktop Web)
*   **fair·ness Analysis (v3.31 Refined):** Advanced department-level analysis with built-in data quality safeguards.
    *   **Batch Filtering:** Search by department or keywords (e.g., "#6") to focus on specific groups or batches.
    *   **Fairness Score (Refined):** Improved scoring formula: `(Adj_Hours * 2.5) - (Lates * 3) - (Anomalies * 8) - (Offsite * 2)`.
    *   **[ก] Hours Capping:** Work hours are capped at **12.5 hrs/day** to prevent inflation from forgotten clock-outs.
    *   **[ข] GPS-Based Weighting:** Work hours logged outside a 500m radius are penalized (multiplied by **0.8x**).
    *   **[ค] Anomaly Detection:** System flags days with >12 hrs of work with a ⚠️ icon and row highlighting.
    *   **Off-site Indicators:** Logs outside allowed perimeters are marked with a 📍 icon.
    *   **Shift Distribution Chart:** Stacked bar chart visualizing the diversity of shifts worked by each employee.

### 8. Satisfaction Survey & Insights (NEW v3.31)
*   **Employee Survey (LIFF):** 10-question smart survey covering shift preferences, travel constraints, health, and fairness perception.
*   **Progressive Wizard UI:** Engaging multi-step interface with choice chips and visual rating scales (1-5).
*   **Analytics Dashboard (Admin):** 
    *   **Executive Metrics:** Average Satisfaction, Fairness Perception, and Team vs Self Weighting.
    *   **Quantitative Analytics:** Doughnut charts for favorite shifts and department benchmarking.
    *   **Qualitative Feedback:** Consolidated list of comments, health reports, and constraints.
    *   **Detail Viewer:** Ability to drill down into a specific employee's full survey responses.

### 7. Global Settings & Branding (Dashboard)
*   **Live Status Cards:** Instant metrics for "Currently In", "Pending Approvals", "Total Approved Users", and "New Members".
*   **Visual Attendance Table:** List of today's activities with profile images, department color-coding, and GPS map buttons.
*   **Auto-Refresh:** The dashboard refreshes every 60 seconds to ensure data is up-to-date.
*   ⚠️ **Late Status Badges (new)**: แสดงสถานะการมาสายพร้อมจำนวนนาที และคลิกดูเหตุผลได้ทันที
*   **Quick Copy Summary:** A tool to copy today's attendance summary for reporting in group chats.

### 2. Shift Scheduling & Leave Management
*   **Shift Picker (Chips UI):** Efficient shift assignment using pre-defined chips (08-17, 09-18, 10-19, 11-20, 12-21).
*   **Leave Approval Workflow:** Dedicated tab for approving or rejecting leave requests with detailed popups.
*   **Automatic Sync:** Approved leaves are automatically injected into the staff's schedule with appropriate emojis (🤒, 🌴, 📋).
*   **Manual Entry v2:** Admins can record time on behalf of employees using a visual user picker.

### 3. Reporting & Analytics
*   **Calendar View (Hierarchy Cards):** Monthly calendar displaying either scheduled shifts or actual clock-in times.
*   **Top Performers Chart:** Dynamic bar chart showing the most active employees based on working hours for any selected month.
*   **CSV/Excel Export:** Export functionality for attendance records and evaluation results.

### 4. User Management
*   **Employee Directory:** Categorized lists of employees by department (General, Pharmacist, etc.).
*   **Advanced Filtering:** Filter users by department or search by name/ID.
*   **Archive System:** Deactivate employees or interns who have finished their term without deleting their history.

### 5. Specialized Evaluation System (Pharm Interns)
*   **Multi-File XLSX Support:** Fast processing of multiple student evaluation spreadsheets simultaneously.
*   **Progress Tracking:** Visual progress bars for each evaluation section (ป-1 to ป-5).
*   **Sectional Theming:** Each evaluation category is color-coded using 8 distinct palette colors.
*   **Feedback System:** Separate feedback fields for Mid-term (Week 3) and Final (Week 6) evaluations.

---

## 🎨 Visual & UX Identity
*   **Department Theme Colors:** Custom color palette defined in `colors.js` for consistent branding across UI elements.
*   **Dark/Light Mode:** Full support for dark and light themes (especially in the Evaluation module).
*   **Responsive Design:** Optimized for both desktop (Admin) and mobile (LIFF).
