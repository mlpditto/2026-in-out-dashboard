import { getDeptCategoryColor, getDeptPastelColor } from './colors.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, orderBy, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 🔴 CONFIG (Public) ---
const firebaseConfig = {
    apiKey: "AIzaSyDEe7ndwzIXokG50MbNykyMG2Ed2bYWvEI",
    authDomain: "in-out-dashboard.firebaseapp.com",
    projectId: "in-out-dashboard",
    storageBucket: "in-out-dashboard.firebasestorage.app",
    messagingSenderId: "846266395224",
    appId: "1:846266395224:web:44d1dfe11692f33ca5f82d",
    measurementId: "G-WN14VJSG17"
};
const FALLBACK_ADMIN = "medlifeplus@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let calendarObj, editModal, barChart;
let userProfileMap = {};
window.allUserData = {};
let usersByDeptModal;
const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });

// --- 🔓 AUTH ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Double check: Fallback Email OR Firestore 'admins' collection
        let isAuthorized = (user.email === FALLBACK_ADMIN);

        if (!isAuthorized) {
            try {
                const adminDoc = await getDoc(doc(db, "admins", user.uid));
                if (adminDoc.exists()) isAuthorized = true;
            } catch (e) { console.error("Admin check failed:", e); }
        }

        if (isAuthorized) {
            document.getElementById('loginPage').classList.add('hidden');
            document.getElementById('dashboardPage').classList.remove('hidden');
            document.getElementById('adminEmailDisplay').innerText = user.displayName || user.email;
            document.getElementById('adminProfilePic').src = user.photoURL || "https://via.placeholder.com/30";

            // Critical Sequence: Fetch users first, then load data
            await cacheUserProfiles();
            loadInitialData();

            editModal = new bootstrap.Modal(document.getElementById('editUserModal'));
            document.getElementById('chartMonth').value = new Date().toISOString().slice(0, 7);

            // Intervals
            if (window.liveClockInterval) clearInterval(window.liveClockInterval);
            window.liveClockInterval = setInterval(updateLiveClock, 1000);
            updateLiveClock();

            if (window.autoRefreshInterval) clearInterval(window.autoRefreshInterval);
            window.autoRefreshInterval = setInterval(async () => {
                await cacheUserProfiles();
                loadData();
            }, 60000); // Auto refresh every 1 min
        } else {
            await signOut(auth);
            Swal.fire('Access Denied', 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้', 'error');
        }
    } else {
        document.getElementById('loginPage').classList.remove('hidden');
        document.getElementById('dashboardPage').classList.add('hidden');
    }
});

function updateLiveClock() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    // Update new stats card elements
    const elDate = document.getElementById('statDate');
    const elTime = document.getElementById('statTime');
    if (elDate) elDate.innerText = dateStr;
    if (elTime) elTime.innerText = timeStr;

    // Fallback/Legacy
    const el = document.getElementById('liveClock');
    if (el) el.innerHTML = `<i class="bi bi-calendar-event me-1"></i> ${dateStr} <br> <i class="bi bi-clock me-1"></i> ${timeStr}`;
}

window.loginWithGoogle = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { Swal.fire('Login Error', e.message, 'error'); } };

window.switchTab = (tabName) => {
    if (tabName === 'newMembers') tabName = 'users';
    document.querySelectorAll('.tab-section').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
    if (target) target.classList.remove('hidden');

    // Only target the MAIN navigation tabs, not inner card tabs
    document.querySelectorAll('#mainTab .nav-link').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#mainTab .nav-link').forEach(l => {
        const oc = l.getAttribute('onclick');
        if (oc && oc.includes(tabName)) l.classList.add('active');
    });

    if (tabName === 'manage') { loadSchedules(); loadLeaveRequests(); }
    if (tabName === 'report') { setTimeout(initCalendar, 200); renderCharts(); }
    if (tabName === 'users') { renderMainUserList(); loadPendingUsers(); }
    if (tabName === 'fairness') {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        if (!document.getElementById('fairnessStart').value) document.getElementById('fairnessStart').valueAsDate = firstDay;
        if (!document.getElementById('fairnessEnd').value) document.getElementById('fairnessEnd').valueAsDate = now;
    }
};

window.openPendingModal = () => {
    const m = new bootstrap.Modal(document.getElementById('pendingUsersModal'));
    loadPendingUsers();
    m.show();
};

window.delAttendance = async (id) => {
    if ((await Swal.fire({ title: 'ยืนยันลบ?', text: "ข้อมูลจะหายไปถาวร", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบเลย' })).isConfirmed) {
        try { await deleteDoc(doc(db, "attendance", id)); Toast.fire({ icon: 'success', title: 'ลบเรียบร้อย' }); loadData(); } catch (e) { Swal.fire('Error', e.message, 'error'); }
    }
};

window.toggleCustomTime = () => {
    const v = document.getElementById('schedType').value;
    const b = document.getElementById('customTimeBox');
    if (v === 'custom') b.classList.remove('d-none'); else b.classList.add('d-none');
};

window.selectShiftChip = (btn) => {
    document.querySelectorAll('#shiftChips .shift-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('schedType').value = btn.getAttribute('data-value');
    toggleCustomTime();
};

window.selectUserPick = (el) => {
    document.querySelectorAll('#userPickerList .user-pick-item').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('userSelect').value = el.getAttribute('data-uid');
};

window.selectManualUserPick = (el) => {
    document.querySelectorAll('#manualPickerList .user-pick-item').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('manualUserSelect').value = el.getAttribute('data-uid');
};

window.createSchedule = async (e) => {
    e.preventDefault();
    const uId = document.getElementById('userSelect').value;
    const activeItem = document.querySelector('#userPickerList .user-pick-item.active');
    const uName = activeItem ? activeItem.getAttribute('data-name') : '';
    const date = document.getElementById('schedDate').value;
    const type = document.getElementById('schedType').value;
    if (!uId || !date) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุพนักงานและวันที่', 'warning');

    let detail = type;
    if (type === 'custom') {
        const s = document.getElementById('customStart').value;
        const en = document.getElementById('customEnd').value;
        if (!s || !en) return Swal.fire('ระบุเวลา', 'กรุณาระบุเวลาให้ครบ', 'warning');
        detail = `กำหนดเอง (${s} - ${en})`;
    }

    try {
        const isLeave = type.includes('ลา') || type.includes('หยุด');
        await setDoc(doc(db, "schedules", `${uId}_${date}`), {
            userId: uId,
            name: uName,
            date: date,
            shiftDetail: detail,
            timestamp: new Date(),
            // Add metadata for consistent popup display
            startDate: date,
            endDate: date,
            reason: isLeave ? detail : ''
        });
        Toast.fire({ icon: 'success', title: 'บันทึกตารางเวรแล้ว' });
        loadSchedules();
    } catch (err) { Swal.fire('Error', err.message, 'error'); }
};

// --- Schedule Pagination State ---
let schedAllData = [];
let schedCurrentPage = 1;
const SCHED_PAGE_SIZE = 20;

window.changeSchedMonth = (delta) => {
    const el = document.getElementById('schedMonthFilter');
    if (!el || !el.value) return;
    const [y, m] = el.value.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    el.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    loadSchedules();
};

window.schedChangePage = (delta) => {
    const totalPages = Math.ceil(schedAllData.length / SCHED_PAGE_SIZE) || 1;
    schedCurrentPage = Math.max(1, Math.min(totalPages, schedCurrentPage + delta));
    renderSchedPage();
};

function renderSchedPage() {
    const t = document.getElementById('schedTableBody');
    if (!t) return;
    const totalPages = Math.ceil(schedAllData.length / SCHED_PAGE_SIZE) || 1;
    const start = (schedCurrentPage - 1) * SCHED_PAGE_SIZE;
    const pageData = schedAllData.slice(start, start + SCHED_PAGE_SIZE);

    let h = '';
    pageData.forEach(v => {
        let detailHtml = v.shiftDetail || '';
        const sd = detailHtml.toLowerCase();

        // Helper to get clean display without duplicate prepending
        const getDisplayShift = (text, emoji) => {
            const clean = text.replace(/🤒|🌴|📋|👶|🙏|🛑|🚫|🏖️|💼|⏰|☀️|🕛|🕙|⚙️/g, '').trim();
            return `${emoji} ${clean}`;
        };

        if (sd.includes('ลาป่วย')) {
            const displayShift = getDisplayShift(v.shiftDetail, '🤒');
            detailHtml = `<span class="badge" style="background:#dc3545;color:white;font-weight:600;font-size:0.85rem;cursor:pointer;" onclick="renderDetailModal('🤒 ลาป่วย', '#dc3545', '${v.id}')">${displayShift}</span>`;
        } else if (sd.includes('ลาพักร้อน') || sd.includes('ลาพักผ่อน')) {
            const displayShift = getDisplayShift(v.shiftDetail, '🌴');
            detailHtml = `<span class="badge" style="background:#0d9488;color:white;font-weight:600;font-size:0.85rem;cursor:pointer;" onclick="renderDetailModal('🌴 ลาพักร้อน', '#0d9488', '${v.id}')">${displayShift}</span>`;
        } else if (sd.includes('ลากิจ')) {
            const displayShift = getDisplayShift(v.shiftDetail, '📋');
            detailHtml = `<span class="badge" style="background:#0d6efd;color:white;font-weight:600;font-size:0.85rem;cursor:pointer;" onclick="renderDetailModal('📋 ลากิจ', '#0d6efd', '${v.id}')">${displayShift}</span>`;
        } else if (sd.includes('ลาคลอด')) {
            const displayShift = getDisplayShift(v.shiftDetail, '👶');
            detailHtml = `<span class="badge" style="background:#e91e8c;color:white;font-weight:600;font-size:0.85rem;cursor:pointer;" onclick="renderDetailModal('👶 ลาคลอด', '#e91e8c', '${v.id}')">${displayShift}</span>`;
        } else if (sd.includes('ลาบวช')) {
            const displayShift = getDisplayShift(v.shiftDetail, '🙏');
            detailHtml = `<span class="badge" style="background:#f59e0b;color:white;font-weight:600;font-size:0.85rem;cursor:pointer;" onclick="renderDetailModal('🙏 ลาบวช', '#f59e0b', '${v.id}')">${displayShift}</span>`;
        } else if (sd.includes('หยุด') || sd.includes('day off')) {
            const displayShift = getDisplayShift(v.shiftDetail, '🚫');
            detailHtml = `<span class="badge" style="background:#6c757d;color:white;font-weight:600;font-size:0.85rem;cursor:pointer;" onclick="renderDetailModal('🚫 หยุด', '#6c757d', '${v.id}')">${displayShift}</span>`;
        } else {
            detailHtml = `<span class="badge text-dark" style="background:#e9ecef;border:1px solid #dee2e6;font-weight:600;font-size:0.85rem;cursor:pointer;" onclick="renderDetailModal('⏰ เวรทำงาน', '#e9ecef', '${v.id}')">${v.shiftDetail}</span>`;
        }
        const safeReason = (v.reason || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const safeLink = (v.attachLink || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
        // Store metadata in data attribute or pass directly. 
        // Or better yet, rely on lookup by ID since we fixed schedAllData population.
        // But for robustness, let's pass a safe object string or rely on ID lookup which renderDetailModal does.
        // Since schedAllData is now fully populated, ID lookup is reliable.

        h += `<tr><td class="ps-3">${v.date}</td><td>${v.name}</td><td>${detailHtml}</td><td class="text-end pe-3"><button onclick="delSched('${v.id}')" class="btn btn-sm btn-light text-danger"><i class="bi bi-trash"></i></button></td></tr>`;
    });
    t.innerHTML = h || '<tr><td colspan="4" class="text-center text-muted py-3">ไม่พบข้อมูลในเดือนนี้</td></tr>';

    // Update pagination info
    const info = document.getElementById('schedPageInfo');
    if (info) info.textContent = schedAllData.length > 0 ? `หน้า ${schedCurrentPage}/${totalPages} (${schedAllData.length} รายการ)` : '';
    const prevBtn = document.getElementById('schedPrevBtn');
    const nextBtn = document.getElementById('schedNextBtn');
    if (prevBtn) prevBtn.disabled = schedCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = schedCurrentPage >= totalPages;
}

window.loadSchedules = async () => {
    const t = document.getElementById('schedTableBody');
    if (!t) return;

    // Initialize month filter if empty
    const mf = document.getElementById('schedMonthFilter');
    if (mf && !mf.value) mf.value = new Date().toISOString().slice(0, 7);

    t.innerHTML = '<tr><td colspan="4" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';

    try {
        const q = query(collection(db, "schedules"), orderBy("date", "desc"));
        const s = await getDocs(q);

        // Filter by selected month
        // Filter by selected month
        const selectedMonth = mf ? mf.value : '';
        schedAllData = [];
        s.forEach(d => {
            const v = d.data();
            if (selectedMonth && v.date && !v.date.startsWith(selectedMonth)) return;
            // Ensure all fields are pushed including reason and attachLink
            schedAllData.push({
                id: d.id,
                ...v,
                reason: v.reason || '',
                attachLink: v.attachLink || ''
            });
        });

        schedCurrentPage = 1;
        renderSchedPage();
    } catch (err) {
        console.error("Error loading schedules:", err);
        t.innerHTML = '<tr><td colspan="4" class="text-center text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
    }
};

window.delSched = async (id) => {
    if ((await Swal.fire({ title: 'ลบรายการนี้?', showCancelButton: true })).isConfirmed) {
        await deleteDoc(doc(db, "schedules", id));
        loadSchedules();
    }
};

window.loadLeaveRequests = async () => {
    const tPending = document.getElementById('leavePendingTableBody');
    const tApproved = document.getElementById('leaveApprovedTableBody');

    if (tPending) tPending.innerHTML = '<tr><td colspan="5" class="text-center py-3">กำลังโหลด...</td></tr>';
    if (tApproved) tApproved.innerHTML = '<tr><td colspan="4" class="text-center py-3">กำลังโหลด...</td></tr>';

    try {
        const q = query(collection(db, "leave_requests"));
        const s = await getDocs(q);
        const docs = s.docs.map(d => {
            const data = d.data();
            return { id: d.id, ...data };
        });

        // Sort locally
        docs.sort((a, b) => {
            const tA = a.requestedAt || a.timestamp || { seconds: 0 };
            const tB = b.requestedAt || b.timestamp || { seconds: 0 };
            return (tB.seconds || 0) - (tA.seconds || 0);
        });

        let hPending = "";
        let hApproved = "";
        let pendingCount = 0;
        let yCount = 0;
        let mCount = 0;
        const usersApprovedYear = new Set();
        const thisYear = new Date().getFullYear();
        const thisMonth = new Date().getMonth();

        // Loop over sorted docs
        docs.forEach(v => {
            const ts = v.requestedAt || v.timestamp;
            let dDate = new Date();
            if (ts && ts.seconds) {
                dDate = new Date(ts.seconds * 1000);
            } else if (ts instanceof Date) {
                dDate = ts;
            }

            if (v.status === 'Pending') pendingCount++;
            if (v.status === 'Approved') {
                if (dDate.getFullYear() === thisYear) {
                    yCount++;
                    usersApprovedYear.add(v.userId);
                    if (dDate.getMonth() === thisMonth) mCount++;
                }
            }

            const displayType = v.type || v.leaveType || 'ไม่ระบุ';

            // Leave-type specific color + emoji
            let leaveEmoji = '📋';
            let leaveColor = '#495057';
            const lt = displayType.toLowerCase();
            if (lt.includes('ป่วย')) { leaveEmoji = '🤒'; leaveColor = '#dc3545'; }
            else if (lt.includes('พักผ่อน')) { leaveEmoji = '🌴'; leaveColor = '#0d9488'; }
            else if (lt.includes('กิจ')) { leaveEmoji = '📋'; leaveColor = '#0d6efd'; }
            else if (lt.includes('คลอด')) { leaveEmoji = '👶'; leaveColor = '#e91e8c'; }
            else if (lt.includes('บวช')) { leaveEmoji = '🙏'; leaveColor = '#f59e0b'; }
            const safeReason = (v.reason || 'ไม่ได้ระบุเหตุผล').replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const safeLink = (v.attachLink || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const safeObj = JSON.stringify({
                name: v.name,
                startDate: v.startDate,
                endDate: v.endDate,
                reason: v.reason || displayType,
                attachLink: v.attachLink
            }).replace(/'/g, "\\'").replace(/"/g, "&quot;");

            const leaveBadge = `<span class="badge" style="background:${leaveColor} !important; color:white !important; border:none; font-weight:600; min-width:90px; text-align:center; font-size:0.85rem; cursor:pointer;" onclick="renderDetailModal('${leaveEmoji} ${displayType}', '${leaveColor}', null, '${safeObj}')">${leaveEmoji} ${displayType}</span>`;

            // Get user info for display (empId instead of raw userId)
            const uData = window.allUserData?.[v.userId] || {};
            const subInfo = uData.empId || v.reason || '';

            const safeString = (str) => (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, "\\n");

            const sName = safeString(v.name);
            const sType = safeString(displayType);
            const sReason = safeString(v.reason || 'ไม่ได้ระบุเหตุผล');
            const sLink = safeString(v.attachLink);

            if (v.status === 'Pending') {
                const acts = `<button onclick="updLeave('${v.id}','Approved','${v.userId}','${sName}','${v.startDate}','${v.endDate}','${sType}','${sReason}','${sLink}')" class="btn btn-sm btn-success me-1"><i class="bi bi-check-lg"></i></button>
                             <button onclick="updLeave('${v.id}','Rejected')" class="btn btn-sm btn-danger"><i class="bi bi-x-lg"></i></button>`;

                hPending += `<tr class="table-warning">
                     <td class="ps-3"><div class="fw-bold">${v.name}</div><small class="text-muted">${subInfo}</small></td>
                     <td>${leaveBadge}</td>
                     <td>${v.startDate} ถึง ${v.endDate}</td>
                     <td>${v.reason || '-'}</td>
                     <td class="text-end pe-3">${acts}</td>
                 </tr>`;
            } else {
                let statusBadge = `<span class="badge bg-secondary">${v.status}</span>`;
                if (v.status === 'Approved') statusBadge = `<span class="badge bg-success">อนุมัติแล้ว</span>`;
                if (v.status === 'Rejected') statusBadge = `<span class="badge bg-danger">ไม่อนุมัติ</span>`;

                hApproved += `<tr>
                     <td class="ps-3"><div class="fw-bold">${v.name}</div><small class="text-muted">${subInfo}</small></td>
                     <td>${leaveBadge}</td>
                     <td>${v.startDate} ถึง ${v.endDate}</td>
                     <td>${statusBadge}</td>
                 </tr>`;
            }
        });

        if (tPending) tPending.innerHTML = hPending || '<tr><td colspan="5" class="text-center text-muted py-3">ไม่มีคำขอที่รออนุมัติ</td></tr>';
        if (tApproved) tApproved.innerHTML = hApproved || '<tr><td colspan="4" class="text-center text-muted py-3">ไม่มีประวัติการลา</td></tr>';

        const sl = document.getElementById('statLeave'); if (sl) sl.innerText = pendingCount;
        const sm = document.getElementById('statLeaveMonth'); if (sm) sm.innerText = mCount;
        const sy = document.getElementById('statLeaveYear'); if (sy) sy.innerText = yCount;

        const lp = document.getElementById('leaveApprovedProfiles');
        if (lp) {
            const uList = [];
            usersApprovedYear.forEach(uid => {
                if (window.allUserData && window.allUserData[uid]) uList.push(window.allUserData[uid]);
            });
            lp.innerHTML = uList.slice(0, 5).map(u => `<img src="${u.pictureUrl || 'https://via.placeholder.com/20'}" title="${u.name}" style="width:20px;height:20px;border-radius:50%;margin-right:-5px;border:1px solid #fff;">`).join('') + (uList.length > 5 ? `<span class="small ms-2 text-muted">+${uList.length - 5}</span>` : '');
        }

    } catch (err) {
        console.error("Error loading leave requests:", err);
        if (tPending) tPending.innerHTML = '<tr><td colspan="5" class="text-center text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
        if (tApproved) tApproved.innerHTML = '<tr><td colspan="4" class="text-center text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
    }
};

const FALLBACK_PROFILE = "https://via.placeholder.com/45";

function getClosestShift(inDate, outDate) {
    if (!inDate || !outDate) return 'N/A';
    const shifts = [
        { label: '08:00 - 17:00', s: 8, e: 17 },
        { label: '09:00 - 18:00', s: 9, e: 18 },
        { label: '10:00 - 19:00', s: 10, e: 19 },
        { label: '11:00 - 20:00', s: 11, e: 20 },
        { label: '12:00 - 21:00', s: 12, e: 21 }
    ];
    const inMins = inDate.getHours() * 60 + inDate.getMinutes();
    const outMins = outDate.getHours() * 60 + outDate.getMinutes();

    let minDiff = 180; // 3 hours window
    let best = 'กำหนดเอง';

    // Also consider duration (approx 9h)
    const durationHrs = (outDate - inDate) / 3600000;
    if (durationHrs < 3) return 'กะสั้น/OT';

    shifts.forEach(sh => {
        const diff = Math.abs(inMins - sh.s * 60) + Math.abs(outMins - sh.e * 60);
        if (diff < minDiff) {
            minDiff = diff;
            best = sh.label;
        }
    });
    return best;
}

const workHoursCache = {};
function calcHoursFromLogs(logs) {
    const byDay = {};
    logs.forEach(x => {
        const k = x.timestamp.toLocaleDateString('sv'); // YYYY-MM-DD local
        if (!byDay[k]) byDay[k] = [];
        byDay[k].push(x);
    });

    let total = 0;
    Object.keys(byDay).forEach(k => {
        const list = byDay[k];
        list.sort((a, b) => a.timestamp - b.timestamp);
        let inTime = null;
        let dayHours = 0;

        list.forEach(r => {
            if (r.type === 'เข้างาน') inTime = r.timestamp;
            else if (r.type === 'ออกงาน' && inTime) {
                dayHours += (r.timestamp - inTime) / 3600000;
                inTime = null;
            }
        });

        // Ignore open inTime (only show hours after clock out)

        total += dayHours;
    });

    return total;
}

async function calcHours(uid, startDate, endDate) {
    const qh = query(
        collection(db, "attendance"),
        where("userId", "==", uid),
        where("timestamp", ">=", startDate),
        where("timestamp", "<=", endDate),
        orderBy("timestamp")
    );
    const sh = await getDocs(qh);
    const logs = sh.docs.map(dd => {
        const v = dd.data();
        const ts = v.timestamp?.toDate ? v.timestamp.toDate() : new Date(v.timestamp.seconds * 1000);
        return { type: v.type, timestamp: ts };
    });
    return calcHoursFromLogs(logs);
}

async function getHoursHtml(row, todayHours = 0) {
    const uid = row.userId;
    if (!uid) return '';
    // We don't cache todayHours because it changes as data loads
    const cacheKey = `${uid}_${todayHours.toFixed(2)}`;
    if (workHoursCache[cacheKey]) return workHoursCache[cacheKey];

    const isExtern = getUserDept(uid, row.dept) === 'Pharmacist Extern';
    const end = new Date();
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);

    const monthStart = new Date(end.getFullYear(), end.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const yearStart = new Date(end.getFullYear(), 0, 1);
    yearStart.setHours(0, 0, 0, 0);

    const monthHours = await calcHours(uid, monthStart, end);
    const mTotal = monthHours + todayHours; // Add today to month total

    let html = todayHours > 0 ? `<div class="text-muted small">วันนี้: <span class="fw-bold text-primary">${todayHours.toFixed(2)}</span> ชม.</div>` : '';
    html += `<div class="text-muted small">เดือนนี้: <span class="fw-bold">${mTotal.toFixed(2)}</span> ชม.</div>`;

    if (isExtern) {
        const user = window.allUserData?.[uid];
        const reg = user?.registrationDate || user?.createdAt;
        if (reg) {
            const regStart = reg.toDate ? reg.toDate() : new Date(reg);
            regStart.setHours(0, 0, 0, 0);
            const histHours = await calcHours(uid, regStart, end);
            const totalHours = histHours + todayHours;
            html = `<div class="text-muted small">สะสม: <span class="fw-bold">${totalHours.toFixed(2)}</span> ชม.</div>` + html;
        }
    } else {
        const yearHours = await calcHours(uid, yearStart, end);
        const yTotal = yearHours + todayHours;
        html = html + `<div class="text-muted small">ปีนี้: <span class="fw-bold">${yTotal.toFixed(2)}</span> ชม.</div>`;
    }

    workHoursCache[cacheKey] = html;
    return html;
}

function getUserDept(uid, fallbackDept) {
    return window.allUserData?.[uid]?.dept || fallbackDept || '';
}

window.changeDate = (days) => {
    const el = document.getElementById('filterDate');
    if (!el) return;
    const d = new Date(el.value);
    d.setDate(d.getDate() + days);
    el.valueAsDate = d;
    loadData();
};

window.changeMonth = (delta) => {
    const el = document.getElementById('chartMonth');
    if (!el.value) return;
    const parts = el.value.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1 + delta, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    el.value = `${y}-${m}`;
    renderCharts();
};

window.adjTime = (unit, delta) => {
    const hhEl = document.getElementById('labelHH');
    const mmEl = document.getElementById('labelMM');
    if (!hhEl || !mmEl) return;

    let h = parseInt(hhEl.textContent);
    let m = parseInt(mmEl.textContent);

    if (unit === 'H') {
        h = (h + delta + 24) % 24;
    } else {
        m = (m + delta + 60) % 60;
    }

    hhEl.textContent = String(h).padStart(2, '0');
    mmEl.textContent = String(m).padStart(2, '0');
};

window.openManualEntry = (uid, name, type) => {
    const modal = new bootstrap.Modal(document.getElementById('manualEntryModal'));
    const hiddenUser = document.getElementById('manualUserSelect');
    const listEl = document.getElementById('manualPickerList');
    const searchInput = document.getElementById('manualSearchInput');

    hiddenUser.value = uid || "";
    searchInput.value = "";

    function renderManualPicker(filter) {
        const q = (filter || '').trim().toLowerCase();
        let users = Object.values(window.allUserData || {}).filter(u => u.status === 'Approved');
        users.sort((a, b) => a.name.localeCompare(b.name, 'th'));

        if (!q && !hiddenUser.value) {
            listEl.innerHTML = '<div class="text-muted small p-2 text-center">พิมพ์ชื่อเพื่อค้นหาพนักงาน</div>';
            return;
        }

        const filtered = users.filter(u => u.name.toLowerCase().includes(q) || (u.dept || '').toLowerCase().includes(q));
        let h = '';
        for (const u of filtered) {
            const uId = u.lineUserId || u.id;
            const pic = u.pictureUrl || 'https://via.placeholder.com/28';
            h += `
            <div class="user-pick-item ${hiddenUser.value === uId ? 'active' : ''}" 
                 data-uid="${uId}" onclick="selectManualUserPick(this)">
                <img src="${pic}" onerror="this.src='https://via.placeholder.com/28'">
                <div style="overflow:hidden">
                    <div class="user-pick-name">${u.name}</div>
                    ${u.dept ? `<div class="user-pick-dept">${u.dept}</div>` : ''}
                </div>
            </div>`;
        }
        listEl.innerHTML = h || '<div class="text-muted small p-2">ไม่พบพนักงาน</div>';
    }

    searchInput.oninput = () => renderManualPicker(searchInput.value);
    renderManualPicker(''); // Initial render

    const now = new Date();
    document.getElementById('manualDate').valueAsDate = now;

    // Set stepper values
    document.getElementById('labelHH').textContent = String(now.getHours()).padStart(2, '0');
    document.getElementById('labelMM').textContent = String(now.getMinutes()).padStart(2, '0');

    // Set radio buttons
    const t = type || 'เข้างาน';
    const rb = document.querySelector(`input[name="manualType"][value="${t}"]`);
    if (rb) rb.checked = true;

    modal.show();
};

window.submitManualEntry = async (e) => {
    e.preventDefault();
    const uid = document.getElementById('manualUserSelect').value;
    const dStr = document.getElementById('manualDate').value;
    const hh = document.getElementById('labelHH').textContent;
    const mm = document.getElementById('labelMM').textContent;
    const tStr = `${hh}:${mm}`;
    const typeEl = document.querySelector('input[name="manualType"]:checked');
    const type = typeEl ? typeEl.value : 'เข้างาน';

    if (!uid || !dStr || !tStr) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุให้ครบถ้วน', 'warning');

    const user = window.allUserData[uid];
    if (!user) return Swal.fire('Error', 'ไม่พบข้อมูลพนักงาน', 'error');

    const dt = new Date(`${dStr}T${tStr}`);

    try {
        await addDoc(collection(db, "attendance"), {
            userId: uid,
            name: user.name,
            dept: user.dept || '',
            empId: user.empId || '',
            type: type,
            timestamp: dt,
            userAgent: 'Admin Manual Entry',
            location: { lat: 0, lng: 0 },
            mapUrl: ''
        });
        Toast.fire({ icon: 'success', title: 'บันทึกเรียบร้อย' });
        bootstrap.Modal.getInstance(document.getElementById('manualEntryModal')).hide();
        loadData();
    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    }
};

window.changeDate = (offset) => {
    const d = document.getElementById('filterDate');
    if (!d || !d.value) return;
    const current = new Date(d.value);
    current.setDate(current.getDate() + offset);
    d.valueAsDate = current; // Correctly updates the input value
    loadData();
};

window.loadData = async () => {
    // Refresh user profiles to get latest names/pictures before rendering attendance
    await cacheUserProfiles();

    const d = document.getElementById('filterDate').value;
    const s = new Date(d); s.setHours(0, 0, 0, 0); const e = new Date(d); e.setHours(23, 59, 59, 999);
    const t = document.getElementById('tableBody');
    t.innerHTML = '<tr><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>';

    const q = query(collection(db, "attendance"), where("timestamp", ">=", s), where("timestamp", "<=", e));
    const snap = await getDocs(q);

    // Sort and determine status
    window.currentData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    window.currentData.sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);

    const userTodayHours = {};
    const logsByUser = {};
    const currentStatusMap = {};
    window.currentData.forEach(v => {
        if (!logsByUser[v.userId]) logsByUser[v.userId] = [];
        const ts = v.timestamp?.toDate ? v.timestamp.toDate() : new Date(v.timestamp.seconds * 1000);
        logsByUser[v.userId].push({ type: v.type, timestamp: ts });
        currentStatusMap[v.userId] = v.type;
    });
    for (const uid in logsByUser) {
        userTodayHours[uid] = calcHoursFromLogs(logsByUser[uid]);
    }

    let h = "", c = 0;
    for (const v of window.currentData) {
        if (v.type === 'เข้างาน') c++;
        const deptText = getUserDept(v.userId, v.dept);
        const bg = v.type === 'เข้างาน' ? 'bg-success' : 'bg-danger';
        const map = v.mapUrl ? `<a href="${v.mapUrl}" target="_blank" class="btn btn-sm btn-light border text-primary"><i class="bi bi-geo-alt-fill"></i></a>` : '-';
        const hoursHtml = await getHoursHtml(v, userTodayHours[v.userId]);

        // Highlight row if user is currently IN
        const isStillIn = (v.type === 'เข้างาน' && currentStatusMap[v.userId] === 'เข้างาน');
        const rowClass = isStillIn ? 'table-success shadow-sm' : '';

        let actionBtns = `<button onclick="delAttendance('${v.id}')" class="btn btn-sm btn-outline-danger border-0"><i class="bi bi-trash"></i></button>`;
        if (v.type === 'เข้างาน') {
            actionBtns = `<button onclick="openManualEntry('${v.userId}', '${v.name}', 'ออกงาน')" class="btn btn-sm btn-outline-warning me-1" title="ลงเวลาออกงาน"><i class="bi bi-box-arrow-right"></i></button>` + actionBtns;
        }

        // Late indicator
        let lateBadge = "";
        if (v.isLate) {
            lateBadge = `<div class="mt-1">
                <span class="badge bg-warning text-dark shadow-sm" style="font-size:0.7rem; cursor:pointer;" 
                      title="เหตุผล: ${v.lateReason || '-'}" onclick="Swal.fire('เหตุผลการมาสาย', '${(v.lateReason || 'ไม่ได้ระบุเหตุผล').replace(/'/g, "\\'")}', 'info')">
                    <i class="bi bi-clock-history"></i> สาย ${v.delayMin || 0} น.
                </span>
            </div>`;
        }

        const dColor = getDeptCategoryColor(deptText);
        h += `<tr class="${rowClass}">
            <td class="ps-3 mono-font">${new Date(v.timestamp.seconds * 1000).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}</td>
            <td class="col-user"><div class="user-cell">${getProfileImg(v.userId)}<div><h6 class="mb-0">${v.name}</h6><small class="text-muted">${v.empId || ''}</small></div></div></td>
            <td><span class="badge" style="background:${dColor} !important; color:white !important; border:none; font-weight:600; min-width:80px; text-align:center;">${deptText}</span></td>
            <td>
                <span class="badge ${bg} bg-opacity-10 text-${bg.split('-')[1]} badge-pill"><span class="status-dot ${bg}"></span>${v.type}</span>
                ${lateBadge}
                ${hoursHtml}
            </td>
            <td>${map}</td>
            <td class="text-end pe-3">${actionBtns}</td>
        </tr>`;
    }

    t.innerHTML = h || `<tr><td colspan="6" class="text-center py-5 text-muted">ไม่พบข้อมูล</td></tr>`;

    // STATS CALCULATION
    const uniqueUsersToday = new Set();
    let currentlyInCount = 0;
    const activeProfiles = [];

    Object.entries(currentStatusMap).forEach(([uid, status]) => {
        uniqueUsersToday.add(uid);
        if (status === 'เข้างาน') {
            currentlyInCount++;
            const u = window.allUserData[uid];
            if (u) activeProfiles.push(u);
        }
    });

    // Show currently-in vs unique users who came today
    document.getElementById('statIn').innerText = `${currentlyInCount} / ${uniqueUsersToday.size}`;

    // Render Active Profiles
    const profileContainer = document.getElementById('activeUserProfiles');
    if (profileContainer) {
        profileContainer.innerHTML = activeProfiles.slice(0, 8).map(u => {
            const dColor = getDeptCategoryColor(u.dept);
            const pic = window.getSafeProfileSrc(u.pictureUrl, 22);
            return `<img src="${pic}" 
                  title="${u.name} (${u.dept || ''})" 
                  onerror="this.src='https://via.placeholder.com/22'"
                  style="width:22px;height:22px;border-radius:50%;object-fit:cover;border:2px solid ${dColor};margin-left:-6px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">`;
        }).join('') + (activeProfiles.length > 8 ? `<span class="small text-white-50 ms-1">+${activeProfiles.length - 8}</span>` : '');
    }
};

// Global helper for profile image source with cache buster
window.getSafeProfileSrc = (src, size = 45) => {
    if (!src || src.includes('placeholder') || src.includes('dicebear')) return src || `https://via.placeholder.com/${size}`;
    // Use per-minute cache buster to ensure "current" pictures
    const cacheBuster = `v_ref=${Math.floor(Date.now() / 60000)}`;
    return src + (src.includes('?') ? '&' : '?') + cacheBuster;
};

async function cacheUserProfiles() {
    const s = await getDocs(collection(db, "users"));
    userProfileMap = {};
    window.allUserData = {};

    let approvedCount = 0;
    const byDept = {};

    s.forEach(d => {
        const u = d.data();
        const uid = u.lineUserId || d.id;
        if (uid) {
            userProfileMap[uid] = u.pictureUrl;
            window.allUserData[uid] = u;

            if (u.status === 'Approved') {
                approvedCount++;
                const dept = u.dept || 'Unknown';
                if (!byDept[dept]) byDept[dept] = [];
                byDept[dept].push({ uid, pictureUrl: u.pictureUrl, name: u.name });
            }
        }
    });

    document.getElementById('statTotalUsers').innerText = approvedCount;
    renderDeptBreakdown(byDept);
}

function renderDeptBreakdown(byDept) {
    const el = document.getElementById('deptBreakdown');
    if (!el) return;

    const entries = Object.entries(byDept || {});
    if (!entries.length) {
        el.innerHTML = '';
        return;
    }

    entries.sort((a, b) => b[1].length - a[1].length);

    el.innerHTML = entries.map(([dept, list]) => {
        const color = getDeptCategoryColor(dept);
        const thumbs = list.slice(0, 8).map(u => {
            const src = window.getSafeProfileSrc(u.pictureUrl, 18);
            return `<img src="${src}" title="${u.name || ''}" onerror="this.src='https://via.placeholder.com/18'" style="width:18px;height:18px;border-radius:50%;object-fit:cover;border:1.5px solid ${color};box-shadow:0 1px 2px rgba(0,0,0,.15);margin-left:-6px;">`;
        }).join('');
        const more = list.length > 8 ? `<span class="text-muted" style="margin-left:6px;">+${list.length - 8}</span>` : '';
        return `
            <div class="d-flex justify-content-between align-items-center" style="gap:8px;">
                <div class="text-truncate" style="max-width:140px;">
                    <span class="fw-bold" style="color:${color};">${dept}</span>
                    <span class="text-muted">(${list.length})</span>
                </div>
                <div class="d-flex align-items-center" style="padding-left:6px;">
                    ${thumbs}${more}
                </div>
            </div>
        `;
    }).join('');
}

function getProfileImg(uid) {
    const src = userProfileMap[uid];
    const finalSrc = window.getSafeProfileSrc(src, 45);
    return `<img src="${finalSrc}" class="profile-thumb" onerror="this.src='https://via.placeholder.com/45'">`;
}

function loadInitialData() {
    document.getElementById('filterDate').valueAsDate = new Date();

    // Default fairness range to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const fs = document.getElementById('fairnessStart');
    const fe = document.getElementById('fairnessEnd');
    if (fs) fs.valueAsDate = firstDay;
    if (fe) fe.valueAsDate = now;

    loadData();
    loadUsersList();
    loadPendingUsers();
}

window.updLeave = async (id, st, uid, nm, s, e, tp, rs, ln) => {
    await setDoc(doc(db, "leave_requests", id), { status: st }, { merge: true });
    if (st === 'Approved') {
        let c = new Date(s), end = new Date(e);
        const lt = (tp || "").toLowerCase();
        let emoji = '🛑';
        if (lt.includes('ป่วย')) emoji = '🤒';
        else if (lt.includes('พักผ่อน') || lt.includes('พักร้อน')) emoji = '🌴';
        else if (lt.includes('กิจ')) emoji = '📋';
        else if (lt.includes('คลอด')) emoji = '👶';
        else if (lt.includes('บวช')) emoji = '🙏';

        const cleanType = tp.replace(/🤒|🌴|📋|👶|🙏|🛑|🚫|🏖️|💼|⏰|☀️|🕛|🕙|⚙️/g, '').trim();
        const finalShiftDetail = `${emoji} ${cleanType}`;

        while (c <= end) {
            let ds = c.toLocaleDateString('sv');
            await setDoc(doc(db, "schedules", `${uid}_${ds}`), {
                userId: uid, name: nm, date: ds, shiftDetail: finalShiftDetail,
                reason: rs || cleanType, attachLink: ln || '', startDate: s, endDate: e
            });
            c.setDate(c.getDate() + 1);
        }
    }
    Toast.fire({ icon: 'success', title: 'เรียบร้อย' });
    loadLeaveRequests();
};

window.loadPendingUsers = async () => {
    try {
        const pendingTable = document.getElementById('pendingUsersModalBody');
        if (!pendingTable) return;

        pendingTable.innerHTML = `
            <tr><td colspan="3" class="text-center py-5">
                <div class="spinner-border text-danger"></div>
                <div class="mt-2 text-muted">กำลังโหลด...</div>
            </td></tr>`;

        const s = await getDocs(query(collection(db, "users"), where("status", "==", "Pending")));
        let h = "";

        // Calculate New Members Stats (Month/Year) - based on 'createdAt' or 'joinedAt' if available
        // We might need to look at ALL users for this, not just pending.
        // We'll trust loadUsersList to handle the global stats if possible, 
        // OR we do a separate lightweight query here for "recently joined".
        // For now, let's just stick to Pending count for the main badge, 
        // and if we want "New Members This Month", we should probably calculate it in loadUsersList
        // where we have all users.

        // However, we need to populate the card content.
        // Let's assume this function ONLY updates the Modal content and valid Pending count.
        // I will add the stats calculation to 'loadUsersList' instead, as it iterates all users.

        s.forEach(d => {
            const v = d.data();
            const deptColor = getDeptCategoryColor(v.department || v.dept);
            h += `
            <tr>
                <td class="ps-3">
                    <div class="user-cell">
                        <img src="${window.getSafeProfileSrc(v.pictureUrl, 45)}" class="profile-thumb" onerror="this.src='https://via.placeholder.com/45'">
                        <div>
                            <h6 class="mb-0 fw-bold">${v.name}</h6>
                            <small class="text-muted">${v.empId || 'No ID'}</small>
                        </div>
                    </div>
                </td>
                <td><span class="badge" style="background:${deptColor} !important; color:white !important; border:none; font-weight:600; min-width:80px; text-align:center;">${v.department || v.dept || 'N/A'}</span></td>
                <td class="text-end pe-3">
                    <button onclick="approveUser('${d.id}')" class="btn btn-sm btn-success shadow-sm me-1"><i class="bi bi-check-lg"></i> รับเข้า</button>
                    <button onclick="rejectUser('${d.id}')" class="btn btn-sm btn-outline-danger shadow-sm"><i class="bi bi-x-lg"></i></button>
                </td>
            </tr>`;
        });

        // Update main pending count
        const sn = document.getElementById('statNewUsers');
        if (sn) sn.innerText = s.size;

        // Calculate New Members (Approved) Stats based on createdAt or startDate
        let nm = 0, ny = 0;
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();

        if (window.allUserData) {
            Object.values(window.allUserData).forEach(u => {
                let joinedDate = null;
                // Prefer createdAt, fallback to startDate
                if (u.createdAt) {
                    if (u.createdAt.seconds) joinedDate = new Date(u.createdAt.seconds * 1000);
                    else joinedDate = new Date(u.createdAt);
                } else if (u.startDate) {
                    joinedDate = new Date(u.startDate);
                }

                if (joinedDate && !isNaN(joinedDate.getTime())) {
                    if (joinedDate.getFullYear() === thisYear) {
                        ny++;
                        if (joinedDate.getMonth() === thisMonth) nm++;
                    }
                }
            });
        }

        const elNm = document.getElementById('statNewMonth'); if (elNm) elNm.innerText = nm;
        const elNy = document.getElementById('statNewYear'); if (elNy) elNy.innerText = ny;

        pendingTable.innerHTML = h || `
            <tr>
                <td colspan="3" class="text-center py-5 text-muted">
                    <i class="bi bi-emoji-smile fs-1 d-block mb-2"></i>
                    ไม่มีผู้สมัครใหม่ที่รอการอนุมัติ
                </td>
            </tr>`;

        // Update stats and show notification if there are new users
        const newUserCount = s.size;
        document.getElementById('statNewUsers').innerText = newUserCount;

        // Show notification badge on the tab
        const newMemberBadge = document.getElementById('newMemberBadge');
        if (newMemberBadge) {
            if (newUserCount > 0) {
                newMemberBadge.classList.remove('d-none');
                newMemberBadge.textContent = newUserCount;

                // Show popup notification if this is the first load
                if (!window.hasShownNewMemberNotification) {
                    window.hasShownNewMemberNotification = true;
                    setTimeout(() => {
                        Swal.fire({
                            title: 'มีสมาชิกใหม่รอการอนุมัติ',
                            text: `มีผู้ใช้ใหม่ ${newUserCount} คนรอการอนุมัติ`,
                            icon: 'info',
                            confirmButtonText: 'ไปที่หน้าอนุมัติ',
                            showCancelButton: true,
                            cancelButtonText: 'ปิด',
                        }).then((result) => {
                            if (result.isConfirmed) {
                                openPendingModal();
                            }
                        });
                    }, 1000);
                }
            } else {
                newMemberBadge.classList.add('d-none');
            }
        }

    } catch (error) {
        console.error('Error loading pending users:', error);
        const pt = document.getElementById('pendingUsersModalBody');
        if (pt) pt.innerHTML = `
            <tr><td colspan="3" class="text-center py-5 text-danger">
                <i class="bi bi-exclamation-triangle"></i> เกิดข้อผิดพลาดในการโหลดข้อมูล
            </td></tr>`;
    }
};

// --- RENDER CHART (Horizontal Bar + Sorted + Professional Analytics) ---
window.renderCharts = async () => {
    const m = document.getElementById('chartMonth').value; if (!m) return;
    const start = new Date(m + "-01"); start.setHours(0, 0, 0, 0); const end = new Date(m + "-01"); end.setMonth(end.getMonth() + 1); end.setDate(0); end.setHours(23, 59, 59, 999);

    // 1. Get All Users (Active Only)
    const userSnap = await getDocs(query(collection(db, "users"), where("status", "==", "Approved")));
    let uH = {};
    userSnap.forEach(doc => {
        const u = doc.data();
        uH[u.name] = { logs: [], pictureUrl: u.pictureUrl, dept: u.dept || '' };
    });

    // 2. Get Attendance
    const snap = await getDocs(query(collection(db, "attendance"), where("timestamp", ">=", start), where("timestamp", "<=", end)));
    snap.forEach(d => { const v = d.data(); if (uH[v.name]) uH[v.name].logs.push({ t: v.type, time: v.timestamp.seconds }); });

    // 3. Calc Hours (Filter 0 hours)
    let chartData = [];
    Object.keys(uH).forEach(n => {
        const l = uH[n].logs.sort((a, b) => a.time - b.time);
        let ms = 0, last = null;
        l.forEach(x => {
            if (x.t === 'เข้างาน') last = x.time;
            else if (x.t === 'ออกงาน' && last) { ms += (x.time - last); last = null; }
        });
        const hours = parseFloat((ms / 3600).toFixed(2));
        if (hours > 0) {
            chartData.push({ name: n, hours: hours, pictureUrl: uH[n].pictureUrl, dept: uH[n].dept });
        }
    });

    // 4. Sort (Highest hours first)
    chartData.sort((a, b) => b.hours - a.hours);

    const labels = chartData.map(d => d.name);
    const data = chartData.map(d => d.hours);

    if (barChart) barChart.destroy();
    const ctx = document.getElementById('workHoursChart').getContext('2d');

    // Custom plugin to draw labels and images
    const barLabelsPlugin = {
        id: 'barLabels',
        afterDatasetsDraw(chart) {
            const { ctx, data } = chart;
            ctx.save();
            const dataset = data.datasets[0];
            const meta = chart.getDatasetMeta(0);

            meta.data.forEach((bar, i) => {
                const val = dataset.data[i];
                const xPos = bar.x + 5;
                const yPos = bar.y;

                // Text: Hours
                ctx.font = 'bold 12px Sarabun';
                ctx.fillStyle = '#495057';
                ctx.textBaseline = 'middle';
                const text = val.toFixed(2);
                ctx.fillText(text, xPos, yPos);
                const textWidth = ctx.measureText(text).width;

                // Image: Profile
                const picUrl = chartData[i].pictureUrl;
                if (picUrl) {
                    if (!window.chartImageCache) window.chartImageCache = {};
                    if (!window.chartImageCache[picUrl]) {
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        img.src = picUrl;
                        img.onload = () => chart.draw();
                        img.onerror = () => {
                            console.error("Failed to load image:", picUrl);
                            img.src = 'https://via.placeholder.com/26';
                        };
                        window.chartImageCache[picUrl] = img;
                    }

                    const img = window.chartImageCache[picUrl];
                    if (img.complete && img.naturalWidth > 0) {
                        const size = 26;
                        const imgX = xPos + textWidth + 8;
                        const imgY = yPos - (size / 2);

                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(imgX + size / 2, yPos, size / 2, 0, Math.PI * 2);
                        ctx.closePath();
                        ctx.clip();
                        ctx.drawImage(img, imgX, imgY, size, size);
                        ctx.restore();

                        // Optional border for image
                        ctx.strokeStyle = '#dee2e6';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.arc(imgX + size / 2, yPos, size / 2, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
            });
            ctx.restore();
        }
    };

    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'ชั่วโมงทำงานรวม',
                data: data,
                backgroundColor: (c) => {
                    const d = chartData[c.dataIndex]?.dept;
                    return getDeptCategoryColor(d) + 'CC'; // CC = 80% opacity
                },
                borderRadius: 6,
                barPercentage: 0.5,
                categoryPercentage: 0.8
            }]
        },
        plugins: [barLabelsPlugin],
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 80 } },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: '#f0f0f0' },
                    title: { display: true, text: 'ชั่วโมงสะสม', font: { size: 10 } }
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { family: 'Sarabun', size: 11 } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    callbacks: { label: (c) => ` ${c.raw} ชั่วโมง` }
                }
            }
        }
    });
};

window.renderMainUserList = async () => {
    const s = await getDocs(query(collection(db, "users"), where("status", "in", ["Approved", "Inactive"])));

    // Maintain consistent indexing: prefer lineUserId, fallback to doc.id
    window.allUserData = {};
    s.forEach(d => {
        const u = d.data();
        const uid = u.lineUserId || d.id;
        u._docId = d.id; // Store actual Firestore document ID for edit/delete
        window.allUserData[uid] = u;
    });

    const tabsEl = document.getElementById('mainUsersTabs');
    const contentEl = document.getElementById('mainUsersContent');
    if (!tabsEl || !contentEl) return;

    const allUsers = Object.entries(window.allUserData || {}).map(([id, u]) => ({ id, ...u }));
    const activeUsers = allUsers.filter(u => u.status === 'Approved');
    const inactiveUsers = allUsers.filter(u => u.status === 'Inactive');

    const byDept = {};
    activeUsers.forEach(u => {
        const dept = u.dept || 'Unknown';
        if (!byDept[dept]) byDept[dept] = [];
        byDept[dept].push(u);
    });

    const deptEntries = Object.entries(byDept).sort((a, b) => b[1].length - a[1].length);

    const makeUserRows = (list) => {
        const sorted = (list || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return sorted.map(u => {
            const img = (u.pictureUrl || 'https://via.placeholder.com/45');
            const dept = u.dept || '';
            let op = u.status === 'Inactive' ? 'opacity-50' : '';
            let rowStyle = '';

            // Day counter for users with endDate
            let dayCounterHtml = '';
            if (u.endDate) {
                const end = new Date(u.endDate + 'T23:59:59');
                const now = new Date();
                const diffMs = end - now;
                const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

                if (daysLeft <= 0) {
                    dayCounterHtml = `<span class="badge bg-danger ms-2" style="font-size:0.7rem;">หมดเวลาแล้ว</span>`;
                    rowStyle = 'background-color: #fff3e0 !important;';
                } else if (daysLeft <= 7) {
                    dayCounterHtml = `<span class="badge bg-warning text-dark ms-2" style="font-size:0.7rem;">เหลือ ${daysLeft} วัน</span>`;
                    rowStyle = 'background-color: #fff8e1 !important;';
                } else if (daysLeft <= 30) {
                    dayCounterHtml = `<span class="badge bg-info text-dark ms-2" style="font-size:0.7rem;">เหลือ ${daysLeft} วัน</span>`;
                } else {
                    dayCounterHtml = `<span class="badge bg-success ms-2" style="font-size:0.7rem;">เหลือ ${daysLeft} วัน</span>`;
                }
            }

            return `<tr class="${op}" style="${rowStyle}">
                <td class="ps-3"><div class="user-cell"><img src="${window.getSafeProfileSrc(img, 45)}" class="profile-thumb" onerror="this.src='https://via.placeholder.com/45'"><div><h6 class="mb-0">${u.name || ''}${dayCounterHtml}</h6>${u.displayName && u.displayName !== u.name ? `<small class="text-muted d-block" style="font-size:0.7rem;">(${u.displayName})</small>` : ''}${u.endDate ? `<small class="text-muted">สิ้นสุด: ${u.endDate}</small>` : ''}</div></div></td>
                <td><span class="badge" style="background-color:${getDeptCategoryColor(dept)} !important; color:white !important; border:none !important; font-weight:600; min-width:90px; text-align:center; padding: 0.5em 0.8em;">${dept}</span></td>
                <td class="text-end pe-3">
                    <button onclick="viewUserStats('${u.id}')" class="btn btn-sm btn-light border me-1" title="สถิติ"><i class="bi bi-bar-chart"></i></button>
                    <button onclick="openEditUser('${u.id}')" class="btn btn-sm btn-light border me-1"><i class="bi bi-pencil"></i></button>
                    <button onclick="delUser('${u._docId || u.id}')" class="btn btn-sm btn-light border text-danger"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
        }).join('');
    };

    const tabIdAll = 'deptTabAll';
    const tabIdArchive = 'deptTabArchive';

    // Build Tabs
    let tabsHtml = `<li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#${tabIdAll}" type="button">Active <span class="badge bg-primary ms-1">${activeUsers.length}</span></button></li>`;
    tabsHtml += deptEntries.map(([dept, list], idx) => {
        const safe = `deptTab_${idx}`;
        const color = getDeptCategoryColor(dept);
        return `<li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#${safe}" type="button"><span class="badge me-1" style="background:${color}">${list.length}</span><span class="fw-bold" style="color:${color};">${dept}</span></button></li>`;
    }).join('');

    if (inactiveUsers.length > 0) {
        tabsHtml += `<li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#${tabIdArchive}" type="button"><i class="bi bi-archive me-1"></i> Archive <span class="badge bg-dark ms-1">${inactiveUsers.length}</span></button></li>`;
    }
    tabsEl.innerHTML = tabsHtml;

    // Build Content
    let contentHtml = `<div class="tab-pane fade show active" id="${tabIdAll}">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="table-light"><tr><th class="ps-3">ชื่อ (Active Only)</th><th>แผนก</th><th class="text-end pe-3">จัดการ</th></tr></thead>
                    <tbody>${makeUserRows(activeUsers) || ''}</tbody>
                </table>
            </div>
        </div>`;

    contentHtml += deptEntries.map(([dept, list], idx) => {
        const safe = `deptTab_${idx}`;
        return `<div class="tab-pane fade" id="${safe}">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="table-light"><tr><th class="ps-3">ชื่อ</th><th>แผนก</th><th class="text-end pe-3">จัดการ</th></tr></thead>
                    <tbody>${makeUserRows(list) || ''}</tbody>
                </table>
            </div>
        </div>`;
    }).join('');

    if (inactiveUsers.length > 0) {
        contentHtml += `<div class="tab-pane fade" id="${tabIdArchive}">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="table-light"><tr><th class="ps-3">ชื่อ (Inactive)</th><th>แผนก</th><th class="text-end pe-3">จัดการ</th></tr></thead>
                    <tbody>${makeUserRows(inactiveUsers) || ''}</tbody>
                </table>
            </div>
        </div>`;
    }
    contentEl.innerHTML = contentHtml;
};

window.loadAllUsers = async () => {
    await cacheUserProfiles();
    await renderMainUserList();
    loadUsersList();
    loadPendingUsers();
};

window.appUser = async (id) => { await setDoc(doc(db, "users", id), { status: "Approved" }, { merge: true }); Toast.fire({ icon: 'success', title: 'อนุมัติแล้ว' }); loadAllUsers(); };
window.delUser = async (id) => { if ((await Swal.fire({ title: 'ลบพนักงาน?', icon: 'warning', showCancelButton: true })).isConfirmed) { await deleteDoc(doc(db, "users", id)); loadAllUsers(); Toast.fire('ลบสำเร็จ', '', 'success') } };
window.openEditUser = (id) => {
    const u = window.allUserData[id]; if (!u) { console.warn('User not found:', id); return; }
    // Store the Firestore docId for saving, not the lineUserId key
    document.getElementById('editUserId').value = u._docId || id;
    document.getElementById('editUserName').value = u.name;
    document.getElementById('editEmpId').value = u.empId || '';
    document.getElementById('editUserPhone').value = u.phone || '';
    document.getElementById('editUserDept').value = u.dept;
    document.getElementById('editUserStatus').value = u.status || 'Approved';
    document.getElementById('editStartDate').value = u.startDate || '';
    document.getElementById('editEndDate').value = u.endDate || '';
    const imgEl = document.getElementById('editUserImg');
    if (imgEl) imgEl.src = u.pictureUrl || "https://via.placeholder.com/80";
    editModal.show();
};
window.saveEditUser = async () => {
    try {
        const docId = document.getElementById('editUserId').value;
        await updateDoc(doc(db, "users", docId), {
            name: document.getElementById('editUserName').value,
            empId: document.getElementById('editEmpId').value,
            phone: document.getElementById('editUserPhone').value,
            dept: document.getElementById('editUserDept').value,
            status: document.getElementById('editUserStatus').value,
            startDate: document.getElementById('editStartDate').value,
            endDate: document.getElementById('editEndDate').value
        });
        Toast.fire({ icon: 'success', title: 'แก้ไขสำเร็จ' });
        editModal.hide();
        loadAllUsers();
    } catch (e) { Swal.fire('Error', e.message, 'error') }
};

window.logout = () => signOut(auth);
window.loadUsersList = async () => {
    const s = await getDocs(query(collection(db, "users"), where("status", "==", "Approved")));
    const listEl = document.getElementById('userPickerList');
    const searchInput = document.getElementById('userSearchInput');
    let users = [];
    s.forEach(d => {
        const u = d.data();
        users.push({ uid: u.lineUserId || d.id, name: u.name || 'ไม่ทราบชื่อ', dept: u.dept || '', pic: u.pictureUrl || '' });
    });
    users.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'));

    function renderPickerList(filter) {
        const q = (filter || '').trim().toLowerCase();
        if (!q) {
            listEl.innerHTML = '<div class="text-muted small p-2 text-center">พิมพ์ชื่อเพื่อค้นหาพนักงาน</div>';
            return;
        }
        const filtered = users.filter(u => u.name.toLowerCase().includes(q) || u.dept.toLowerCase().includes(q));
        let h = '';
        for (const u of filtered) {
            const pic = u.pic || 'https://via.placeholder.com/28';
            h += `<div class="user-pick-item" data-uid="${u.uid}" data-name="${u.name}" onclick="selectUserPick(this)">
                <img src="${pic}" onerror="this.src='https://via.placeholder.com/28'">
                <div style="overflow:hidden">
                    <div class="user-pick-name">${u.name}</div>
                    ${u.dept ? `<div class="user-pick-dept">${u.dept}</div>` : ''}
                </div>
            </div>`;
        }
        listEl.innerHTML = h || '<div class="text-muted small p-2">ไม่พบพนักงาน</div>';
    }

    renderPickerList('');
    searchInput.oninput = () => renderPickerList(searchInput.value);
};
window.exportCSV = () => {
    if (!window.currentData?.length) return Toast.fire({ icon: 'warning', title: 'ไม่มีข้อมูล' });

    const esc = (v) => {
        v = (v ?? '').toString();
        if (v.includes('"')) v = v.replace(/"/g, '""');
        if (v.includes(',') || v.includes('\n') || v.includes('\r') || v.includes('"')) return `"${v}"`;
        return v;
    };

    const header = "Time,Name,EmpId,Dept,Type,MapLink\n";
    const rows = window.currentData.map(r => {
        const time = new Date(r.timestamp.seconds * 1000).toLocaleTimeString('th-TH', { hour12: false });
        const dept = getUserDept(r.userId, r.dept);
        const empId = window.allUserData?.[r.userId]?.empId || r.empId || '';
        return [time, r.name || '', empId, dept, r.type || '', r.mapUrl || ''].map(esc).join(',');
    }).join("\n");

    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURI(header + rows);
    a.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
};



// Calendar & Report Logic
let customCalendarMode = 'attendance'; // 'schedule' or 'attendance'

window.toggleCalendarMode = (mode) => {
    customCalendarMode = mode;

    // Update buttons
    const btnShift = document.getElementById('btnModeShift');
    const btnActual = document.getElementById('btnModeActual');

    if (mode === 'schedule') {
        btnShift.className = 'btn btn-primary btn-sm';
        btnActual.className = 'btn btn-outline-success btn-sm';
    } else {
        btnShift.className = 'btn btn-outline-primary btn-sm';
        btnActual.className = 'btn btn-success btn-sm';
    }

    if (calendarObj) calendarObj.refetchEvents();
};

window.renderCharts = async () => {
    const mStr = document.getElementById('chartMonth').value; // YYYY-MM
    const [y, m] = mStr.split('-').map(Number);

    // Fetch attendance for the whole month
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);

    const q = query(collection(db, "attendance"),
        where("timestamp", ">=", start),
        where("timestamp", "<=", end));

    const snap = await getDocs(q);
    const userHours = {};

    // Group by User and Date to calc hours
    const logsByUserDate = {}; // { uid_date: [logs] }

    snap.forEach(d => {
        const v = d.data();
        const k = `${v.userId}_${v.timestamp.seconds}`; // unique log
        const dayKey = `${v.userId}_${new Date(v.timestamp.seconds * 1000).getDate()}`;

        if (!logsByUserDate[dayKey]) logsByUserDate[dayKey] = { uid: v.userId, logs: [] };
        logsByUserDate[dayKey].logs.push({ t: v.type, ts: v.timestamp.seconds });
    });

    // Calc total hours per user
    Object.values(logsByUserDate).forEach(item => {
        item.logs.sort((a, b) => a.ts - b.ts);
        let ms = 0, last = null;
        item.logs.forEach(x => {
            if (x.t === 'เข้างาน') last = x.ts;
            else if (x.t === 'ออกงาน' && last) { ms += (x.ts - last); last = null; }
        });
        if (!userHours[item.uid]) userHours[item.uid] = 0;
        userHours[item.uid] += ms;
    });

    // Sort users by hours descending
    const sorted = Object.entries(userHours)
        .map(([uid, secs]) => ({ uid, hrs: secs / 3600 }))
        .sort((a, b) => b.hrs - a.hrs);

    // Render HTML List
    const container = document.getElementById('topPerformersList');
    if (!container) return;

    if (sorted.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-5">ไม่มีข้อมูลชั่วโมงทำงานในเดือนนี้</div>';
        return;
    }

    const maxHrs = sorted[0].hrs || 1; // avoid div by zero

    let html = '';
    sorted.forEach((x, index) => {
        const u = window.allUserData?.[x.uid] || { name: 'Unknown', pictureUrl: '' };
        const percent = (x.hrs / maxHrs) * 85; // Max width 85% to leave room for text/img
        const barColor = index < 3 ? 'var(--color-primary)' : '#6c757d'; // Top 3 text color highlight? No, bar is blue.

        // Screenshot style:
        // Name on left (above bar or inline?) -> Screenshot shows name on LEFT column.
        // Bar grows from left to right.
        // At end of bar: Value text + Profile Pic.

        // Actually screenshot shows:
        // Name (Text)              | Bar (Green/Blue) ....................... [Value] [Img]
        // ---------------------------------------------------------------------------------

        // Let's use Flexbox.
        const deptColor = getDeptCategoryColor(u.department || u.dept);

        html += `
        <div class="mb-3 d-flex align-items-center" style="font-size: 0.9rem;">
            <div style="width: 200px; min-width: 150px;" class="text-truncate pe-2 text-end small text-muted">
                ${u.name} <span class="d-none d-md-inline">(${u.empId || ''})</span>
            </div>
            <div class="flex-grow-1 position-relative" style="height: 28px; background: #f1f3f5; border-radius: 14px; overflow: visible;">
                 <div style="width: ${Math.max(percent, 2)}%; height: 100%; background: ${deptColor}; border-radius: 14px; display:flex; align-items:center; justify-content:flex-end;">
                 </div>
                 <div style="position: absolute; left: ${Math.max(percent, 2)}%; top: 50%; transform: translateY(-50%); display:flex; align-items:center; margin-left: 8px; white-space:nowrap;">
                    <span class="fw-bold me-2 small">${x.hrs.toFixed(2)}</span>
                    <img src="${u.pictureUrl || 'https://via.placeholder.com/25'}" class="rounded-circle shadow-sm" style="width:25px; height:25px; border:1px solid white;" onerror="this.src='https://via.placeholder.com/25'">
                 </div>
            </div>
        </div>
        `;
    });
    container.innerHTML = html;
};


function initCalendar() {
    if (calendarObj) { calendarObj.render(); return }
    calendarObj = new FullCalendar.Calendar(document.getElementById('calendar'), {
        initialView: 'dayGridMonth',
        locale: 'th',
        dayMaxEvents: true,
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'attendanceMode,scheduleMode'
        },
        customButtons: {
            attendanceMode: {
                text: 'เข้างาน',
                click: function () {
                    customCalendarMode = 'attendance';
                    calendarObj.refetchEvents();
                }
            },
            scheduleMode: {
                text: 'ตารางเวร',
                click: function () {
                    customCalendarMode = 'schedule';
                    calendarObj.refetchEvents();
                }
            }
        },
        dateClick: function (info) {
            if (customCalendarMode === 'attendance') {
                showDayAttendanceDetail(info.dateStr);
            }
        },
        eventClick: function (info) {
            const p = info.event.extendedProps;
            if (p.type === 'attendance') {
                showDayAttendanceDetail(info.event.startStr);
                return;
            }

            const safeObj = JSON.stringify({
                name: p.name,
                startDate: p.startDate,
                endDate: p.endDate,
                reason: p.reason || p.detail,
                attachLink: p.link
            });
            renderDetailModal(p.detail || 'รายละเอียด', '#6c757d', null, safeObj);
        },
        eventContent: function (arg) {
            const props = arg.event.extendedProps;
            const type = props.type;
            const img = props.image || 'https://via.placeholder.com/20';
            const name = props.name || arg.event.title;
            const detail = props.detail || '';

            let statusClass = 'status-soft-secondary';
            let customStyle = '';
            if (type === 'attendance') {
                statusClass = ''; // Use custom colors
                customStyle = `background: ${props.pastelColor}; border-left-color: ${props.deptColor};`;
            }
            else if (detail.includes('หยุด') || detail.includes('ลา')) statusClass = 'status-soft-danger';
            else if (detail.includes('เช้า')) statusClass = 'status-soft-primary';
            else if (detail.includes('เที่ยง') || detail.includes('บ่าย')) statusClass = 'status-soft-warning';

            return {
                html: `
                <div class="calendar-event-card ${statusClass}" style="${customStyle}">
                    <div class="calendar-event-header">
                        <img src="${img}" onerror="this.src='https://via.placeholder.com/20'">
                        <div class="calendar-event-title" style="${type === 'attendance' ? 'color: #333;' : ''}">${name}</div>
                    </div>
                    <div class="calendar-event-subtitle" style="${type === 'attendance' ? `color: ${props.deptColor};` : ''}">${detail || arg.event.title}</div>
                </div>`
            };
        },
        events: async (info, s, f) => {
            try {
                let ev = [];

                // 1. Schedules View
                if (customCalendarMode === 'schedule') {
                    const q = query(collection(db, "schedules"));
                    const sn = await getDocs(q);
                    sn.forEach(d => {
                        const v = d.data();
                        const uid = v.userId;
                        const prof = window.allUserData?.[uid] || {};
                        let c = 'var(--color-shift-am)';
                        const detail = v.shiftDetail || '';
                        if (detail.includes('บ่าย')) c = 'var(--color-shift-pm)';
                        else if (detail.includes('ดึก')) c = 'var(--color-shift-night)';
                        else if (detail.includes('หยุด') || detail.includes('ลา')) c = 'var(--color-leave)';

                        ev.push({
                            title: v.name,
                            start: v.date,
                            backgroundColor: c,
                            extendedProps: {
                                type: 'schedule',
                                name: v.name,
                                detail: v.shiftDetail,
                                reason: v.reason,
                                startDate: v.startDate,
                                endDate: v.endDate,
                                link: v.attachLink,
                                image: window.getSafeProfileSrc(prof.pictureUrl, 20)
                            }
                        })
                    });
                }

                // 2. Attendance View
                if (customCalendarMode === 'attendance') {
                    // Fetch attendance for current view range
                    // Currently fetching ALL, optimization: fetch by range info.start / info.end
                    const att = await getDocs(collection(db, "attendance"));
                    let map = {};
                    att.forEach(d => {
                        const data = d.data();
                        const k = `${data.userId}_${new Date(data.timestamp.seconds * 1000).toISOString().split('T')[0]}`;
                        if (!map[k]) map[k] = { n: data.name, d: data.dept, uid: data.userId, l: [] };
                        map[k].l.push({ t: data.type, ts: data.timestamp.seconds })
                    });

                    Object.keys(map).forEach(k => {
                        const i = map[k];
                        i.l.sort((a, b) => a.ts - b.ts);
                        let ms = 0, last = null;
                        i.l.forEach(x => {
                            if (x.t === 'เข้างาน') last = x.ts;
                            else if (x.t === 'ออกงาน' && last) { ms += (x.ts - last); last = null; }
                        });

                        if (ms > 0) {
                            let baseColor = getDeptCategoryColor(i.d);
                            let pastelColor = getDeptPastelColor(i.d);
                            let prof = window.allUserData?.[i.uid] || {};
                            const hrsStr = `${(ms / 3600).toFixed(2)} ชม.`;
                            ev.push({
                                title: hrsStr,
                                start: k.split('_')[1],
                                backgroundColor: pastelColor, // Use pastel for grid background
                                borderColor: baseColor,      // Use solid for left border
                                extendedProps: {
                                    type: 'attendance',
                                    name: i.n,
                                    detail: hrsStr,
                                    reason: `สรุปเวลาเข้างาน: ${hrsStr}`, // Add reason for attendance
                                    startDate: k.split('_')[1], // Add startDate for attendance
                                    endDate: k.split('_')[1],   // Add endDate for attendance
                                    image: window.getSafeProfileSrc(prof.pictureUrl || i.pictureUrl, 45),
                                    deptColor: baseColor,
                                    pastelColor: pastelColor
                                }
                            })
                        }
                    });
                }

                s(ev)
            } catch (e) { console.error(e); f(e) }
        }
    });
    calendarObj.render();
}

// Explicit export to window object to ensure availability
window.initCalendar = initCalendar;

window.renderDetailModal = (title, color, schedId, rawObj) => {
    let v;
    if (rawObj) {
        if (typeof rawObj === 'string') {
            try {
                v = JSON.parse(rawObj.replace(/&quot;/g, '"'));
            } catch (e) { console.error("Parse error", e); }
        } else {
            v = rawObj;
        }
    }

    // Fallback to searching in schedAllData if not provided directly
    if (!v && schedId) {
        v = schedAllData.find(x => x.id === schedId);
    }

    if (!v) return;

    const safeName = (v.name || '').replace(/'/g, "\\'");
    // Always show range A ถึง B even if same day, to match Image 2
    const start = v.startDate || v.date;
    const end = v.endDate || v.date;
    const safeDateRange = `${start} ถึง ${end}`.replace(/'/g, "\\'");

    // If it's a leave type and reason is missing/contains emoji, use the cleaner version or fallback
    let displayReason = v.reason || v.shiftDetail || 'ระบุผ่านตารางเวร';
    const safeReason = displayReason.replace(/'/g, "\\'").replace(/"/g, "&quot;");

    const safeLink = (v.attachLink || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
    let linkHtml = '';
    if (safeLink) {
        linkHtml = `<p><b>🔗 ลิงก์แนบ:</b> <a href="${safeLink}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-info py-0">เปิดดูเอกสาร</a></p>`;
    }

    Swal.fire({
        title: title,
        html: `<div class='text-start'><p><b>👤 พนักงาน:</b> ${safeName}</p><p><b>📅 วันที่:</b> ${safeDateRange}</p><p><b>📝 เหตุผล:</b> ${safeReason}</p>${linkHtml}</div>`,
        confirmButtonText: 'ปิด',
        confirmButtonColor: color || '#6c757d'
    });
};

window.loginWithGoogle = loginWithGoogle; window.logout = logout; window.loadData = loadData; window.exportCSV = exportCSV; window.switchTab = switchTab; window.loadSchedules = loadSchedules; window.createSchedule = createSchedule; window.saveSchedule = createSchedule; window.delSched = delSched; window.loadLeaveRequests = loadLeaveRequests; window.updLeave = updLeave; window.renderCharts = renderCharts; window.loadPendingUsers = loadPendingUsers; window.loadAllUsers = loadAllUsers; window.appUser = appUser; window.delUser = delUser; window.openEditUser = openEditUser; window.saveEditUser = saveEditUser; window.toggleCustomTime = toggleCustomTime; window.changeSchedMonth = changeSchedMonth; window.schedChangePage = schedChangePage; window.openManualEntry = openManualEntry; window.submitManualEntry = submitManualEntry; window.adjTime = adjTime;
window.loadFairnessReport = async () => {
    const dept = document.getElementById('fairnessDept').value;
    const kw = (document.getElementById('fairnessKeyword')?.value || "").toLowerCase();
    const startStr = document.getElementById('fairnessStart').value;
    const endStr = document.getElementById('fairnessEnd').value;

    if (!startStr || !endStr) {
        return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุช่วงวันที่ต้องการตรวจสอบ', 'warning');
    }

    const start = new Date(startStr); start.setHours(0, 0, 0, 0);
    const end = new Date(endStr); end.setHours(23, 59, 59, 999);

    Swal.fire({
        title: 'กำลังประมวลผล...',
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        // 1. Get filtered users
        let filteredUsers = Object.values(window.allUserData || {}).filter(u => u.status === 'Approved');
        if (dept !== 'All') {
            filteredUsers = filteredUsers.filter(u => (u.dept || u.department || '').includes(dept));
        }
        if (kw) {
            filteredUsers = filteredUsers.filter(u =>
                (u.name || "").toLowerCase().includes(kw) ||
                (u.dept || u.department || "").toLowerCase().includes(kw) ||
                (u.empId || "").toLowerCase().includes(kw)
            );
        }

        if (filteredUsers.length === 0) {
            Swal.close();
            return Swal.fire('ไม่พบพนักงาน', 'ไม่พบสมาชิกในแผนกที่เลือก', 'info');
        }

        // 2. Get attendance for the period
        const attSnap = await getDocs(query(collection(db, "attendance"),
            where("timestamp", ">=", start),
            where("timestamp", "<=", end)));

        const logsByUser = {};
        attSnap.forEach(d => {
            const v = d.data();
            const uid = v.userId;
            if (!logsByUser[uid]) logsByUser[uid] = [];
            const ts = v.timestamp?.toDate ? v.timestamp.toDate() : new Date(v.timestamp.seconds * 1000);
            logsByUser[uid].push({ ...v, ts });
        });

        // 3. Process metrics
        const report = [];
        let totalHrsSum = 0;
        let totalLateMins = 0;

        filteredUsers.forEach(u => {
            const uid = u.lineUserId || u.id;
            const uLogs = logsByUser[uid] || [];

            // Calc days worked (distinct dates)
            const daysSet = new Set(uLogs.map(l => l.ts.toLocaleDateString('sv')));
            const daysCount = daysSet.size;

            // Analyze shift distribution
            const shiftCounts = {};
            const byDay = {};
            uLogs.forEach(l => {
                const k = l.ts.toLocaleDateString('sv');
                if (!byDay[k]) byDay[k] = [];
                byDay[k].push(l);
            });
            Object.values(byDay).forEach(list => {
                list.sort((a, b) => a.ts - b.ts);
                const firstIn = list.find(l => l.type === 'เข้างาน');
                const lastOut = [...list].reverse().find(l => l.type === 'ออกงาน');
                if (firstIn && lastOut) {
                    const matchedShift = getClosestShift(firstIn.ts, lastOut.ts);
                    shiftCounts[matchedShift] = (shiftCounts[matchedShift] || 0) + 1;
                }
            });

            // Calc hours
            const workHours = calcHoursFromLogs(uLogs.map(l => ({ type: l.type, timestamp: l.ts })));

            // Calc lates
            const lates = uLogs.filter(l => l.type === 'เข้างาน' && l.isLate);
            const lateCount = lates.length;
            const lateMins = lates.reduce((sum, l) => sum + (l.delayMin || 0), 0);

            totalHrsSum += workHours;
            totalLateMins += lateMins;

            report.push({
                uid,
                name: u.name,
                pictureUrl: u.pictureUrl,
                dept: u.dept || u.department,
                days: daysCount,
                hours: workHours,
                avg: daysCount > 0 ? (workHours / daysCount) : 0,
                lateCount,
                lateMins,
                shiftCounts
            });
        });

        // 4. Calculate Scores & Sort (Higher hours, lower lates = better)
        report.forEach(r => {
            // Fairness Score = (Hours * 2) - (LateCount * 5) - (LateMins / 10)
            // This is a simple heuristic to show relative "fairness" or "effort"
            r.score = (r.hours * 2) - (r.lateCount * 3);
        });
        report.sort((a, b) => b.hours - a.hours);

        // 5. Render Table
        const tbody = document.getElementById('fairnessTableBody');
        let h = '';
        report.forEach(r => {
            const scoreColor = r.score < 0 ? 'text-danger' : (r.score < 20 ? 'text-warning' : 'text-success');
            const avgBadgeCol = r.avg > 8 ? 'bg-success' : 'bg-secondary';
            const safePic = window.getSafeProfileSrc(r.pictureUrl, 32);

            const shiftDetails = Object.entries(r.shiftCounts)
                .sort((a, b) => {
                    // Extract HH:mm from "HH:mm - HH:mm" or label
                    const getVal = (s) => parseInt(s.split(':')[0]) || 999;
                    return getVal(a[0]) - getVal(b[0]);
                })
                .map(([sh, count]) => `<span class="badge bg-light text-dark border-0 fw-normal" style="font-size:0.65rem;">${sh.replace(/ - /g, '-').replace(/:00/g, '')} (${count})</span>`)
                .join(' ');

            h += `
            <tr>
                <td class="ps-3">
                    <div class="user-cell">
                        <img src="${safePic}" class="profile-thumb" style="width:32px; height:32px;" onerror="this.src='https://via.placeholder.com/32'">
                        <div>
                            <div class="fw-bold" style="font-size:0.85rem;">${r.name}</div>
                            <small class="text-muted" style="font-size:0.7rem;">${r.dept}</small>
                        </div>
                    </div>
                </td>
                <td class="text-center">
                    <div class="fw-bold">${r.days} วัน</div>
                    <div class="d-flex flex-wrap justify-content-center gap-1 mt-1">
                        ${shiftDetails || '<small class="text-muted" style="font-size:0.6rem;">ไม่มีข้อมูลกะ</small>'}
                    </div>
                </td>
                <td class="text-center text-primary fw-bold">${r.hours.toFixed(2)}</td>
                <td class="text-center"><span class="badge ${avgBadgeCol}">${r.avg.toFixed(2)}</span></td>
                <td class="text-center ${r.lateCount > 0 ? 'text-danger fw-bold' : 'text-muted'}">${r.lateCount} ครั้ง</td>
                <td class="text-center text-muted">${r.lateMins} น.</td>
                <td class="text-end pe-3">
                    <div class="fw-bold ${scoreColor}">${r.score.toFixed(1)}</div>
                </td>
            </tr>`;
        });
        tbody.innerHTML = h || '<tr><td colspan="7" class="text-center py-5">ไม่มีข้อมูลในช่วงเวลาที่เลือก</td></tr>';

        // 6. Summary Statistics & Chart
        const totalEmployees = report.length;
        const avgHrs = totalEmployees > 0 ? (totalHrsSum / totalEmployees) : 0;

        const sumEl = document.getElementById('fairnessSummary');
        sumEl.classList.remove('hidden');
        sumEl.innerHTML = `
            <div class="col-md-3">
                <div class="p-3 bg-white border rounded shadow-sm text-center">
                    <div class="small text-muted mb-1">จำนวนบุคลากร</div>
                    <div class="h4 fw-bold mb-0">${totalEmployees} ท่าน</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="p-3 bg-white border rounded shadow-sm text-center">
                    <div class="small text-muted mb-1">รวมเวลาทำงาน</div>
                    <div class="h4 fw-bold mb-0 text-primary">${totalHrsSum.toFixed(1)} ชม.</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="p-3 bg-white border rounded shadow-sm text-center">
                    <div class="small text-muted mb-1">เฉลี่ยต่อคน</div>
                    <div class="h4 fw-bold mb-0">${avgHrs.toFixed(1)} ชม.</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="p-3 bg-white border rounded shadow-sm text-center">
                    <div class="small text-muted mb-1">รวมเวลามาสาย</div>
                    <div class="h4 fw-bold mb-0 text-danger">${totalLateMins} นาที</div>
                </div>
            </div>`;

        renderFairnessChart(report);
        Swal.close();

    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'ไม่สามารถดึงข้อมูลวิเคราะห์ได้: ' + err.message, 'error');
    }
};

let fairnessChartInstance;
function renderFairnessChart(report) {
    const ctx = document.getElementById('fairnessChart');
    const box = document.getElementById('fairnessChartBox');
    if (!ctx) return;

    if (fairnessChartInstance) fairnessChartInstance.destroy();
    box.classList.remove('hidden');

    const labels = report.map(r => r.name.split(' ')[0]); // Use first name

    // Define shift labels in chronological order
    const shiftLabels = [
        '08:00 - 17:00',
        '09:00 - 18:00',
        '10:00 - 19:00',
        '11:00 - 20:00',
        '12:00 - 21:00',
        'กะสั้น/OT',
        'กำหนดเอง'
    ];

    const shiftColors = {
        '08:00 - 17:00': '#fbbf24',
        '09:00 - 18:00': '#34d399',
        '10:00 - 19:00': '#60a5fa',
        '11:00 - 20:00': '#a78bfa',
        '12:00 - 21:00': '#f472b6',
        'กะสั้น/OT': '#fb7185',
        'กำหนดเอง': '#94a3b8'
    };

    const datasets = shiftLabels.map(sh => {
        return {
            label: sh.replace(/:00/g, ''),
            data: report.map(r => r.shiftCounts[sh] || 0),
            backgroundColor: shiftColors[sh],
            borderRadius: 4
        };
    }).filter(ds => ds.data.some(v => v > 0)); // Only show shifts that are actually used

    fairnessChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, beginAtZero: true, title: { display: true, text: 'จำนวนวัน (ครั้ง)' } },
                y: { stacked: true }
            },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
                tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.raw} วัน` } }
            }
        }
    });
}
window.copyAttendanceSummary = () => {
    const filterDate = document.getElementById('filterDate')?.value;
    if (filterDate) {
        window.copyAttendanceSummaryByDate(filterDate);
    } else {
        Toast.fire({ icon: 'warning', title: 'กรุณาเลือกวันที่ก่อนคัดลอก' });
    }
};

window.copyAttendanceSummaryByDate = async (dateStr) => {
    try {
        const start = new Date(dateStr);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dateStr);
        end.setHours(23, 59, 59, 999);

        const q = query(collection(db, "attendance"), where("timestamp", ">=", start), where("timestamp", "<=", end));
        const snap = await getDocs(q);

        if (snap.empty) return Toast.fire({ icon: 'info', title: 'ไม่มีข้อมูลในวันที่เลือก' });

        const statusMap = {};
        snap.forEach(doc => {
            const data = doc.data();
            const uid = data.userId;
            if (!statusMap[uid]) {
                // Try to get latest info from window.allUserData if possible, else use doc data
                const uProfile = window.allUserData?.[uid];
                statusMap[uid] = {
                    n: uProfile ? uProfile.name : (data.name || 'พนักงาน'),
                    d: uProfile ? (uProfile.dept || 'General') : (data.dept || 'General'),
                    l: []
                };
            }
            statusMap[uid].l.push({ t: data.type, ts: data.timestamp.seconds });
        });

        const grouped = {};
        let totalIn = 0;

        Object.keys(statusMap).forEach(uid => {
            const u = statusMap[uid];
            u.l.sort((a, b) => a.ts - b.ts);

            let firstIn = null;
            let lastOut = null;
            let ms = 0;
            let lastTs = null;

            u.l.forEach(x => {
                if (x.t === 'เข้างาน') {
                    if (!firstIn) firstIn = x.ts;
                    lastTs = x.ts;
                } else if (x.t === 'ออกงาน') {
                    lastOut = x.ts;
                    if (lastTs) {
                        ms += (x.ts - lastTs);
                        lastTs = null; // Pair closed
                    }
                }
            });

            // If still clocked in (lastTs is not null), calculate pending hours based on "now" if it's today?? 
            // Better to only count closed sessions or just leave it. 
            // User requested "Total Hours", usually implies completed work. 
            // Let's stick to closed pairs for accuracy.

            if (u.l.length > 0) {
                const tIn = firstIn ? new Date(firstIn * 1000).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
                const tOut = lastOut ? new Date(lastOut * 1000).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '...';
                const hrs = (ms / 3600).toFixed(2);

                if (!grouped[u.d]) grouped[u.d] = [];
                grouped[u.d].push({
                    name: u.n,
                    in: tIn,
                    out: tOut,
                    hrs: hrs
                });
                totalIn++;
            }
        });

        const d = new Date(dateStr);
        const formattedDate = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

        let text = `📊 สรุปเวลาเข้า-ออกงาน วันที่ ${formattedDate}\n`;

        const depts = Object.keys(grouped).sort();
        depts.forEach(dept => {
            const users = grouped[dept];
            // Sort users by Name? or Check-in time? Default to check-in time if possible, or just index
            // Let's sort by Name for consistency
            // users.sort((a, b) => a.name.localeCompare(b.name)); 

            text += `\n📍 แผนก: ${dept} (${users.length} ท่าน)\n`;
            users.forEach((p, idx) => {
                text += `${idx + 1}. ${p.name}\n   ⏰ ${p.in} - ${p.out} | ⏳ ${p.hrs} ชม.\n`;
            });
        });

        text += `\n━━━━━━━━━━━━━━━\n✅ รวมทั้งหมด: ${totalIn} ท่าน`;

        if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            Toast.fire({ icon: 'success', title: 'คัดลอกสรุปรายวันแล้ว' });
        }
    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'ไม่สามารถคัดลอกได้', 'error');
    }
};

async function showDayAttendanceDetail(dateStr) {
    const d = new Date(dateStr);
    const title = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

    Swal.fire({
        title: title,
        html: '<div id="dayAttendanceLoading" class="p-3 text-center"><div class="spinner-border text-primary"></div><p class="mt-2">กำลังโหลดข้อมูล...</p></div>',
        showCloseButton: true,
        showConfirmButton: false,
        width: '500px'
    });

    try {
        const start = new Date(dateStr);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dateStr);
        end.setHours(23, 59, 59, 999);

        const att = await getDocs(query(collection(db, "attendance"), where("timestamp", ">=", start), where("timestamp", "<=", end)));
        let map = {};
        att.forEach(doc => {
            const data = doc.data();
            const uid = data.userId;
            if (!map[uid]) map[uid] = { n: data.name, d: data.dept, uid: data.userId, l: [] };
            map[uid].l.push({ t: data.type, ts: data.timestamp.seconds })
        });

        let users = [];
        Object.keys(map).forEach(uid => {
            const i = map[uid];
            i.l.sort((a, b) => a.ts - b.ts);
            let ms = 0, last = null;
            i.l.forEach(x => {
                if (x.t === 'เข้างาน') last = x.ts;
                else if (x.t === 'ออกงาน' && last) { ms += (x.ts - last); last = null; }
            });
            if (ms > 0) users.push({ ...i, hrs: ms / 3600 });
        });

        users.sort((a, b) => b.hrs - a.hrs); // Top performers first

        if (users.length === 0) {
            Swal.update({ html: '<p class="text-center py-4 text-muted">ไม่มีข้อมูลการเข้างานในวันนี้</p>' });
            return;
        }

        let html = `<div style="max-height: 400px; overflow-y: auto; padding-right: 5px;">`;

        const maxHrs = 12; // Baseline for full width

        users.forEach(u => {
            const uData = window.allUserData?.[u.uid] || {};
            const pictureUrl = uData.pictureUrl || u.pictureUrl;
            const pastel = getDeptPastelColor(u.d);
            const borderCol = getDeptCategoryColor(u.d);
            // Calculate percentage based on maxHrs (e.g., 12 hours = full width)
            const percentWidth = Math.min((u.hrs / maxHrs) * 100, 100);

            html += `
            <div class="d-flex align-items-center mb-2 p-2 position-relative shadow-sm" 
                 style="background: #fff; border-radius: 12px; border-left: 5px solid ${borderCol}; overflow: hidden; min-height: 65px;">
                 
                <!-- Progress Bar Background -->
                <div style="position: absolute; left: 0; top: 0; height: 100%; width: ${percentWidth}%; background: ${pastel}40; z-index: 0;"></div>
                
                <div class="d-flex align-items-center gap-3 w-100" style="position: relative; z-index: 1;">
                    <img src="${window.getSafeProfileSrc(pictureUrl, 40)}" 
                         onerror="this.src='https://via.placeholder.com/40'"
                         class="rounded-circle border border-2 border-white shadow-sm"
                         style="width:40px; height:40px; object-fit: cover;">
                         
                    <div class="flex-grow-1">
                        <div class="fw-bold text-dark" style="font-size: 0.95rem;">${u.n}</div>
                        <div class="fw-bold" style="color: ${borderCol}; font-size: 0.9rem;">${u.hrs.toFixed(2)} ชม.</div>
                    </div>
                </div>
            </div>`;
        });

        html += '</div>';

        Swal.update({
            html: html,
            showCancelButton: true,
            cancelButtonText: 'ปิด',
            cancelButtonColor: '#6c757d',
            showConfirmButton: true,
            confirmButtonText: '<i class="bi bi-clipboard-check"></i> คัดลอกสรุป',
            confirmButtonColor: '#0d6efd',
            reverseButtons: true,
            preConfirm: async () => {
                await window.copyAttendanceSummaryByDate(dateStr);
                return false; // Prevent modal from closing
            }
        });

    } catch (err) {
        console.error(err);
        Swal.update({ html: '<p class="text-danger text-center">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>' });
    }
}

window.viewUserStats = async (uid) => {
    const u = window.allUserData?.[uid];
    if (!u) return;

    Swal.fire({
        title: 'กำลังคำนวณสถิติ...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        let startTotal = new Date();
        startTotal.setFullYear(now.getFullYear() - 1);
        if (u.registrationDate) startTotal = u.registrationDate.toDate ? u.registrationDate.toDate() : new Date(u.registrationDate);
        else if (u.createdAt) startTotal = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);

        const [hMonth, hYear, hTotal] = await Promise.all([
            calcHours(uid, startOfMonth, now),
            calcHours(uid, startOfYear, now),
            calcHours(uid, startTotal, now)
        ]);

        const qLeave = query(collection(db, "leave_requests"), where("userId", "==", uid), where("status", "==", "Approved"));
        const snapLeave = await getDocs(qLeave);

        let leaveSummary = {};
        let totalLeaveDays = 0;

        snapLeave.forEach(doc => {
            const data = doc.data();
            const type = data.type || data.leaveType || 'อื่นๆ';
            const s = new Date(data.startDate);
            const e = new Date(data.endDate);
            const days = Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;

            if (!leaveSummary[type]) leaveSummary[type] = { days: 0, count: 0 };
            leaveSummary[type].days += days;
            leaveSummary[type].count += 1;
            totalLeaveDays += days;
        });

        let leaveHtml = '';
        if (totalLeaveDays > 0) {
            leaveHtml = `<div class="mt-3"><h6 class="fw-bold border-bottom pb-1">รายละเอียดวันลา</h6><div class="row g-2">`;
            Object.entries(leaveSummary).forEach(([type, stat]) => {
                leaveHtml += `
                <div class="col-6">
                    <div class="p-2 border rounded bg-light">
                        <div class="small text-muted">${type}</div>
                        <div class="fw-bold text-primary">${stat.days} วัน <small class="text-muted">(${stat.count} ครั้ง)</small></div>
                    </div>
                </div>`;
            });
            leaveHtml += `</div></div>`;
        } else {
            leaveHtml = `<div class="mt-3 p-3 bg-light rounded text-muted small">ไม่มีประวัติการลาที่อนุมัติ</div>`;
        }

        Swal.fire({
            title: `<div class="d-flex align-items-center gap-2 text-start"><img src="${window.getSafeProfileSrc(u.pictureUrl, 40)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;"> <div><div style="font-size:1.1rem;">${u.name}</div><div class="text-muted" style="font-size:0.8rem;">${uid}</div></div></div>`,
            html: `
            <div class="text-start mt-3">
                <h6 class="fw-bold border-bottom pb-1">สถิติการทำงาน</h6>
                <div class="row g-2 mb-3">
                    <div class="col-4">
                        <div class="p-2 border rounded bg-light text-center">
                            <div class="small text-muted" style="font-size:0.7rem;">เดือนนี้</div>
                            <div class="fw-bold text-success" style="font-size:1.1rem;">${hMonth.toFixed(2)}</div>
                            <div class="small text-muted" style="font-size:0.7rem;">ชม.</div>
                        </div>
                    </div>
                    <div class="col-4">
                        <div class="p-2 border rounded bg-light text-center">
                            <div class="small text-muted" style="font-size:0.7rem;">ปีนี้</div>
                            <div class="fw-bold text-primary" style="font-size:1.1rem;">${hYear.toFixed(2)}</div>
                            <div class="small text-muted" style="font-size:0.7rem;">ชม.</div>
                        </div>
                    </div>
                    <div class="col-4">
                        <div class="p-2 border rounded bg-light text-center">
                            <div class="small text-muted" style="font-size:0.7rem;">ทั้งหมด</div>
                            <div class="fw-bold text-dark" style="font-size:1.1rem;">${hTotal.toFixed(2)}</div>
                            <div class="small text-muted" style="font-size:0.7rem;">ชม.</div>
                        </div>
                    </div>
                </div>

                <h6 class="fw-bold border-bottom pb-1">สรุปการลาทั้งหมด</h6>
                <div class="p-2 border rounded bg-white text-center shadow-sm">
                    <div class="h4 mb-0 fw-bold text-danger">${totalLeaveDays} วัน</div>
                    <div class="small text-muted">รวมวันลาที่ใช้ไปทั้งหมด</div>
                </div>

                ${leaveHtml}
            </div>`,
            showCloseButton: true,
            confirmButtonText: 'ปิด',
            confirmButtonColor: '#6c757d',
            width: '450px'
        });

    } catch (err) {
        console.error(err);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลสถิติได้', 'error');
    }
};
