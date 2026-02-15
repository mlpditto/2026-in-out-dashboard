import { getDeptCategoryColor } from './colors.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, orderBy, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 🔴 CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyDEe7ndwzIXokG50MbNykyMG2Ed2bYWvEI",
    authDomain: "in-out-dashboard.firebaseapp.com",
    projectId: "in-out-dashboard",
    storageBucket: "in-out-dashboard.firebasestorage.app",
    messagingSenderId: "846266395224",
    appId: "1:846266395224:web:44d1dfe11692f33ca5f82d",
    measurementId: "G-WN14VJSG17"
};
const ADMIN_EMAIL = "medlifeplus@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let calendarObj, editModal, barChart;
let userProfileMap = {};
window.allUserData = {};
let usersByDeptModal;
const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });

// AUTH
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (user.email === ADMIN_EMAIL) {
            document.getElementById('loginPage').classList.add('hidden');
            document.getElementById('dashboardPage').classList.remove('hidden');
            document.getElementById('adminEmailDisplay').innerText = user.displayName || user.email;
            document.getElementById('adminProfilePic').src = user.photoURL || "https://via.placeholder.com/30";
            await cacheUserProfiles(); loadInitialData();
            editModal = new bootstrap.Modal(document.getElementById('editUserModal'));
            document.getElementById('chartMonth').value = new Date().toISOString().slice(0, 7);
            setInterval(updateLiveClock, 1000); updateLiveClock();
        } else { await signOut(auth); Swal.fire('Access Denied', 'อีเมลนี้ไม่มีสิทธิ์เข้าถึง', 'error'); }
    } else {
        document.getElementById('loginPage').classList.remove('hidden');
        document.getElementById('dashboardPage').classList.add('hidden');
    }
});

function updateLiveClock() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const el = document.getElementById('liveClock');
    if (el) el.innerHTML = `<i class="bi bi-calendar-event me-1"></i> ${dateStr} <br> <i class="bi bi-clock me-1"></i> ${timeStr}`;
}

window.loginWithGoogle = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { Swal.fire('Login Error', e.message, 'error'); } };

window.switchTab = (tabName) => {
    if (tabName === 'newMembers') tabName = 'users';
    document.querySelectorAll('.tab-section').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
    if (target) target.classList.remove('hidden');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    const links = document.querySelectorAll('.nav-link');
    links.forEach(l => { if (l.getAttribute('onclick').includes(tabName)) l.classList.add('active'); });

    if (tabName === 'manage') { loadSchedules(); loadLeaveRequests(); }
    if (tabName === 'report') { setTimeout(initCalendar, 200); renderCharts(); }
    if (tabName === 'users') { renderMainUserList(); loadPendingUsers(); }
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

window.createSchedule = async (e) => {
    e.preventDefault();
    const uId = document.getElementById('userSelect').value;
    const uName = document.getElementById('userSelect').options[document.getElementById('userSelect').selectedIndex].text;
    const date = document.getElementById('schedDate').value;
    const type = document.getElementById('schedType').value;
    if (!uId || !date) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุพนักงานและวันที่', 'warning');

    let detail = type;
    if (type === 'custom') {
        const s = document.getElementById('customStart').value;
        const en = document.getElementById('customEnd').value;
        if (!s || !en) return Swal.fire('ระบุเวลา', 'กรุณาระบุเวลาให้ครบ', 'warning');
        detail = `${s} - ${en}`;
    }

    try {
        await setDoc(doc(db, "schedules", `${uId}_${date}`), {
            userId: uId, name: uName, date: date, shiftDetail: detail, timestamp: new Date()
        });
        Toast.fire({ icon: 'success', title: 'บันทึกตารางเวรแล้ว' });
        loadSchedules();
    } catch (err) { Swal.fire('Error', err.message, 'error'); }
};

window.loadSchedules = async () => {
    const t = document.getElementById('schedTableBody');
    if (!t) return;
    t.innerHTML = '<tr><td colspan="4" class="text-center">กำลังโหลด...</td></tr>';
    try {
        const q = query(collection(db, "schedules"), orderBy("date", "desc"));
        const s = await getDocs(q);
        let h = '';
        s.forEach(d => {
            const v = d.data();
            h += `<tr><td>${v.date}</td><td>${v.name}</td><td>${v.shiftDetail}</td><td><button onclick="delSched('${d.id}')" class="btn btn-sm btn-light text-danger"><i class="bi bi-trash"></i></button></td></tr>`;
        });
        t.innerHTML = h || '<tr><td colspan="4" class="text-center text-muted">ไม่พบข้อมูล</td></tr>';
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
    const t = document.getElementById('leaveTableBody');
    if (!t) return;
    t.innerHTML = '<tr><td colspan="5" class="text-center">กำลังโหลด...</td></tr>';

    try {
        const q = query(collection(db, "leave_requests")); // Removed orderBy to avoid index issues
        const s = await getDocs(q);
        const docs = s.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort locally
        docs.sort((a, b) => {
            const tA = a.requestedAt || a.timestamp || { seconds: 0 };
            const tB = b.requestedAt || b.timestamp || { seconds: 0 };
            return (tB.seconds || 0) - (tA.seconds || 0);
        });

        // Loop over sorted docs instead of s
        docs.forEach(v => {
            // const v = d.data(); -> v is already data with id
            const ts = v.requestedAt || v.timestamp;
            const dDate = ts ? (ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)) : new Date();

            if (v.status === 'Pending') pendingCount++;
            if (v.status === 'Approved') {
                if (dDate.getFullYear() === thisYear) {
                    yCount++;
                    usersApprovedYear.add(v.userId);
                    if (dDate.getMonth() === thisMonth) mCount++;
                }
            }

            const rowClass = v.status === 'Pending' ? 'table-warning' : '';

            let acts = '';
            if (v.status === 'Pending') {
                const lType = v.type || v.leaveType;
                acts = `<button onclick="updLeave('${v.id}','Approved','${v.userId}','${v.name}','${v.startDate}','${v.endDate}','${lType}')" class="btn btn-sm btn-success me-1"><i class="bi bi-check-lg"></i></button>
                         <button onclick="updLeave('${v.id}','Rejected')" class="btn btn-sm btn-danger"><i class="bi bi-x-lg"></i></button>`;
            } else {
                acts = `<small class="text-muted">${v.status}</small>`;
            }

            const displayType = v.type || v.leaveType || 'ไม่ระบุ';
            const dColor = getDeptCategoryColor(getUserDept(v.userId, ''));

            h += `<tr class="${rowClass}">
                 <td class="ps-3"><div class="fw-bold">${v.name}</div><small class="text-muted">${v.userId}</small></td>
                 <td><span class="badge" style="background:${dColor} !important; color:white !important; border:none; font-weight:600; min-width:80px; text-align:center;">${displayType}</span></td>
                 <td>${v.startDate} ถึง ${v.endDate}</td>
                 <td>${v.reason || '-'}</td>
                 <td class="text-end pe-3">${acts}</td>
             </tr>`;
        });
        t.innerHTML = h || '<tr><td colspan="5" class="text-center text-muted">ไม่มีคำขอลา</td></tr>';

        const sl = document.getElementById('statLeave'); if (sl) sl.innerText = pendingCount;
        const sm = document.getElementById('statLeaveMonth'); if (sm) sm.innerText = mCount;
        const sy = document.getElementById('statLeaveYear'); if (sy) sy.innerText = yCount;

        const lp = document.getElementById('leaveApprovedProfiles');
        if (lp) {
            const uList = [];
            usersApprovedYear.forEach(uid => {
                if (window.allUserData && window.allUserData[uid]) uList.push(window.allUserData[uid]);
            });
            lp.innerHTML = uList.slice(0, 5).map(u => `<img src="${u.pictureUrl || 'https://via.placeholder.com/20'}" title="${u.name}" style="width:20px;height:20px;border-radius:50%;margin-right:-5px;border:1px solid #fff;">`).join('') + (uList.length > 5 ? `<span class="small ms-2 text-white-50">+${uList.length - 5}</span>` : '');
        }
    } catch (err) {
        console.error("Error loading leave requests:", err);
        t.innerHTML = '<tr><td colspan="5" class="text-center text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
    }
};

const workHoursCache = {};
function calcHoursFromLogs(logs) {
    const byDay = {};
    logs.forEach(x => {
        const k = x.timestamp.toISOString().split('T')[0];
        if (!byDay[k]) byDay[k] = [];
        byDay[k].push(x);
    });

    let total = 0;
    Object.values(byDay).forEach(list => {
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

        if (inTime) {
            const end23 = new Date(inTime);
            end23.setHours(23, 0, 0, 0);
            dayHours += (end23 - inTime) / 3600000;
        }

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

async function getHoursHtml(row) {
    const uid = row.userId;
    if (!uid) return '';
    if (workHoursCache[uid]) return workHoursCache[uid];

    const isExtern = getUserDept(uid, row.dept) === 'Pharmacist Extern';
    const end = new Date();
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);

    const monthStart = new Date(end.getFullYear(), end.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const yearStart = new Date(end.getFullYear(), 0, 1);
    yearStart.setHours(0, 0, 0, 0);

    const monthHours = await calcHours(uid, monthStart, end);
    let html = `<div class="text-muted small">เดือนนี้: <span class="fw-bold">${monthHours.toFixed(2)}</span> ชม.</div>`;

    if (isExtern) {
        const user = window.allUserData?.[uid];
        const reg = user?.registrationDate || user?.createdAt;
        if (reg) {
            const regStart = reg.toDate ? reg.toDate() : new Date(reg);
            regStart.setHours(0, 0, 0, 0);
            const totalHours = await calcHours(uid, regStart, end);
            html = `<div class="text-muted small">สะสม: <span class="fw-bold">${totalHours.toFixed(2)}</span> ชม.</div>` + html;
        }
    } else {
        const yearHours = await calcHours(uid, yearStart, end);
        html = html + `<div class="text-muted small">ปีนี้: <span class="fw-bold">${yearHours.toFixed(2)}</span> ชม.</div>`;
    }

    workHoursCache[uid] = html;
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

window.openManualEntry = (uid, name, type) => {
    const modal = new bootstrap.Modal(document.getElementById('manualEntryModal'));
    const sel = document.getElementById('manualUserSelect');

    // Populate users if empty
    if (sel.options.length === 0) {
        sel.innerHTML = '<option value="">-- เลือกพนักงาน --</option>' +
            Object.values(window.allUserData || {}).sort((a, b) => a.name.localeCompare(b.name)).map(u =>
                `<option value="${u.lineUserId || u.id}">${u.name}</option>`
            ).join('');
    }

    if (uid) sel.value = uid; else sel.value = "";

    const now = new Date();
    document.getElementById('manualDate').valueAsDate = now;
    // Force 24h HH:mm format
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('manualTime').value = `${hh}:${mm}`;

    if (type) {
        if (type === 'เข้างาน') document.getElementById('typeIn').checked = true;
        if (type === 'ออกงาน') document.getElementById('typeOut').checked = true;
    } else {
        document.getElementById('typeIn').checked = true;
    }

    modal.show();
};

window.submitManualEntry = async (e) => {
    e.preventDefault();
    const uid = document.getElementById('manualUserSelect').value;
    const dStr = document.getElementById('manualDate').value;
    const tStr = document.getElementById('manualTime').value;
    const type = document.querySelector('input[name="manualType"]:checked').value;

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

window.loadData = async () => {
    const d = document.getElementById('filterDate').value;
    const s = new Date(d); s.setHours(0, 0, 0, 0); const e = new Date(d); e.setHours(23, 59, 59, 999);
    const t = document.getElementById('tableBody');
    t.innerHTML = '<tr><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>';

    const q = query(collection(db, "attendance"), where("timestamp", ">=", s), where("timestamp", "<=", e));
    const snap = await getDocs(q);

    // Sort and determine status
    window.currentData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    window.currentData.sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);

    const currentStatusMap = {};
    window.currentData.forEach(v => {
        currentStatusMap[v.userId] = v.type;
    });

    let h = "", c = 0;
    for (const v of window.currentData) {
        if (v.type === 'เข้างาน') c++;
        const deptText = getUserDept(v.userId, v.dept);
        const bg = v.type === 'เข้างาน' ? 'bg-success' : 'bg-danger';
        const map = v.mapUrl ? `<a href="${v.mapUrl}" target="_blank" class="btn btn-sm btn-light border text-primary"><i class="bi bi-geo-alt-fill"></i></a>` : '-';
        const hoursHtml = await getHoursHtml(v);

        // Highlight row if user is currently IN
        const isStillIn = (v.type === 'เข้างาน' && currentStatusMap[v.userId] === 'เข้างาน');
        const rowClass = isStillIn ? 'table-success shadow-sm' : '';

        let actionBtns = `<button onclick="delAttendance('${v.id}')" class="btn btn-sm btn-outline-danger border-0"><i class="bi bi-trash"></i></button>`;
        if (v.type === 'เข้างาน') {
            actionBtns = `<button onclick="openManualEntry('${v.userId}', '${v.name}', 'ออกงาน')" class="btn btn-sm btn-outline-warning me-1" title="ลงเวลาออกงาน"><i class="bi bi-box-arrow-right"></i></button>` + actionBtns;
        }

        const dColor = getDeptCategoryColor(deptText);
        h += `<tr class="${rowClass}">
            <td class="ps-3 mono-font">${new Date(v.timestamp.seconds * 1000).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}</td>
            <td class="col-user"><div class="user-cell">${getProfileImg(v.userId)}<div><h6 class="mb-0">${v.name}</h6><small class="text-muted">${v.empId || ''}</small></div></div></td>
            <td><span class="badge" style="background:${dColor} !important; color:white !important; border:none; font-weight:600; min-width:80px; text-align:center;">${deptText}</span></td>
            <td>
                <span class="badge ${bg} bg-opacity-10 text-${bg.split('-')[1]} badge-pill"><span class="status-dot ${bg}"></span>${v.type}</span>
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

    document.getElementById('statIn').innerText = `${currentlyInCount} / ${uniqueUsersToday.size}`;

    // Render Active Profiles
    const profileContainer = document.getElementById('activeUserProfiles');
    if (profileContainer) {
        profileContainer.innerHTML = activeProfiles.slice(0, 5).map(u => {
            const dColor = getDeptCategoryColor(u.dept);
            return `<img src="${u.pictureUrl || 'https://via.placeholder.com/30'}" 
                  title="${u.name} (${u.dept || ''})" 
                  style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid ${dColor};margin-left:-10px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">`;
        }).join('') + (activeProfiles.length > 5 ? `<span class="small text-white-50 ms-1">+${activeProfiles.length - 5}</span>` : '');
    }
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
            const src = u.pictureUrl || 'https://via.placeholder.com/18';
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
    const src = userProfileMap[uid] || 'https://via.placeholder.com/45';
    return `<img src="${src}" class="profile-thumb" onerror="this.src='https://via.placeholder.com/45'">`;
}

function loadInitialData() {
    document.getElementById('filterDate').valueAsDate = new Date();
    loadData();
    loadUsersList();
    loadPendingUsers();
}

window.updLeave = async (id, st, uid, nm, s, e, tp) => {
    await setDoc(doc(db, "leave_requests", id), { status: st }, { merge: true });
    if (st === 'Approved') {
        let c = new Date(s), end = new Date(e);
        const emoji = tp.includes('ป่วย') ? '🤒' : (tp.includes('พักผ่อน') ? '🌴' : '🛑');
        while (c <= end) {
            let ds = c.toISOString().split('T')[0];
            await setDoc(doc(db, "schedules", `${uid}_${ds}`), { userId: uid, name: nm, date: ds, shiftDetail: `${emoji} ${tp}` });
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
        s.forEach(d => {
            const v = d.data();
            h += `
            <tr>
                <td class="ps-3">
                    <div class="user-cell">
                        <img src="${v.pictureUrl}" class="profile-thumb">
                        <div>
                            <h6 class="mb-0">${v.name}</h6>
                            <small class="text-muted">${v.empId || 'ยังไม่มีรหัสพนักงาน'}</small>
                        </div>
                    </div>
                </td>
                <td><span class="badge" style="background:${getDeptCategoryColor(v.dept)} !important; color:white !important; border:none; font-weight:600; min-width:80px; text-align:center;">${v.dept || 'ยังไม่ระบุ'}</span></td>
                <td class="text-end pe-3">
                    <div class="btn-group">
                        <button onclick="appUser('${d.id}')" class="btn btn-sm btn-success">
                            <i class="bi bi-check-lg"></i> อนุมัติ
                        </button>
                        <button onclick="delUser('${d.id}')" class="btn btn-sm btn-outline-danger">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        });

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
    window.allUserData = {};
    s.forEach(d => { window.allUserData[d.id] = d.data(); });

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
            const op = u.status === 'Inactive' ? 'opacity-50' : '';
            return `<tr class="${op}">
                <td class="ps-3"><div class="user-cell"><img src="${img}" class="profile-thumb" onerror="this.src='https://via.placeholder.com/45'"><h6 class="mb-0">${u.name || ''}</h6></div></td>
                <td><span class="badge" style="background-color:${getDeptCategoryColor(dept)} !important; color:white !important; border:none !important; font-weight:600; min-width:90px; text-align:center; padding: 0.5em 0.8em;">${dept}</span></td>
                <td class="text-end pe-3">
                    <button onclick="openEditUser('${u.id}')" class="btn btn-sm btn-light border me-1"><i class="bi bi-pencil"></i></button>
                    <button onclick="delUser('${u.id}')" class="btn btn-sm btn-light border text-danger"><i class="bi bi-trash"></i></button>
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
        return `<li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#${safe}" type="button"><span class="fw-bold" style="color:${color};">${dept}</span> <span class="badge ms-1" style="background:${color}">${list.length}</span></button></li>`;
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
    const u = window.allUserData[id]; if (!u) return;
    document.getElementById('editUserId').value = id;
    document.getElementById('editUserName').value = u.name;
    document.getElementById('editEmpId').value = u.empId || '';
    document.getElementById('editUserDept').value = u.dept;
    document.getElementById('editUserStatus').value = u.status || 'Approved';
    document.getElementById('editStartDate').value = u.startDate || '';
    document.getElementById('editEndDate').value = u.endDate || '';
    document.getElementById('editUserImg').src = u.pictureUrl || "https://via.placeholder.com/80";
    editModal.show();
};
window.saveEditUser = async () => {
    try {
        await updateDoc(doc(db, "users", document.getElementById('editUserId').value), {
            name: document.getElementById('editUserName').value,
            empId: document.getElementById('editEmpId').value,
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
window.loadUsersList = async () => { const s = await getDocs(query(collection(db, "users"), where("status", "==", "Approved"))); let h = '<option value="">เลือกพนักงาน...</option>'; s.forEach(d => h += `<option value="${d.data().lineUserId}">${d.data().name}</option>`); document.getElementById('userSelect').innerHTML = h };
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



function initCalendar() {
    if (calendarObj) { calendarObj.render(); return }
    calendarObj = new FullCalendar.Calendar(document.getElementById('calendar'), {
        initialView: 'dayGridMonth',
        locale: 'th',
        height: 'auto',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,layerGrid'
        },
        eventContent: function (arg) {
            const type = arg.event.extendedProps.type;
            const img = arg.event.extendedProps.image || 'https://via.placeholder.com/20';
            const title = arg.event.title;

            if (type === 'attendance') {
                const bgColor = arg.event.backgroundColor || '#198754';
                return {
                    html: `
                    <div class="calendar-event-user att-event" style="background:${bgColor}20; border-color:${bgColor};">
                        <img src="${img}" onerror="this.src='https://via.placeholder.com/20'">
                        <span class="event-hours" style="color:${bgColor}">${title}</span>
                    </div>`
                };
            } else if (type === 'schedule') {
                const bgColor = arg.event.backgroundColor || '#6c757d';
                return {
                    html: `
                    <div class="calendar-event-user sched-event" style="background:${bgColor}20; border-color:${bgColor}">
                        <img src="${img}" onerror="this.src='https://via.placeholder.com/20'">
                        <span class="event-name" style="color:${bgColor}">${title}</span>
                    </div>`
                };
            }
            return { text: title };
        },
        events: async (info, s, f) => {
            try {
                let ev = [];
                // 1. Schedules
                const sn = await getDocs(collection(db, "schedules"));
                sn.forEach(d => {
                    const v = d.data();
                    const uid = v.userId;
                    const prof = window.allUserData?.[uid] || {};
                    let c = 'var(--color-shift-am)';
                    if (v.shiftDetail.includes('บ่าย')) c = 'var(--color-shift-pm)';
                    else if (v.shiftDetail.includes('ดึก')) c = 'var(--color-shift-night)';
                    else if (v.shiftDetail.includes('หยุด') || v.shiftDetail.includes('ลา')) c = 'var(--color-leave)';

                    ev.push({
                        title: v.name,
                        start: v.date,
                        backgroundColor: c,
                        extendedProps: {
                            type: 'schedule',
                            image: prof.pictureUrl
                        }
                    })
                });

                // 2. Attendance (Actual Hours)
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
                        let prof = window.allUserData?.[i.uid] || {};

                        ev.push({
                            title: `${(ms / 3600).toFixed(1)} ชม.`,
                            start: k.split('_')[1],
                            backgroundColor: 'transparent',
                            borderColor: 'transparent',
                            textColor: '#333',
                            extendedProps: {
                                type: 'attendance',
                                image: prof.pictureUrl || i.pictureUrl,
                                dept: i.d,
                                name: i.n
                            },
                            display: 'block'
                        })
                    }
                });
                s(ev)
            } catch (e) { f(e) }
        }
    });
    calendarObj.render();
}

// Explicit export to window object to ensure availability
window.initCalendar = initCalendar;

window.loginWithGoogle = loginWithGoogle; window.logout = logout; window.loadData = loadData; window.exportCSV = exportCSV; window.switchTab = switchTab; window.loadSchedules = loadSchedules; window.createSchedule = createSchedule; window.delSched = delSched; window.loadLeaveRequests = loadLeaveRequests; window.updLeave = updLeave; window.renderCharts = renderCharts; window.loadPendingUsers = loadPendingUsers; window.loadAllUsers = loadAllUsers; window.appUser = appUser; window.delUser = delUser; window.openEditUser = openEditUser; window.saveEditUser = saveEditUser; window.toggleCustomTime = toggleCustomTime;
