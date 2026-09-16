/**
 * Security rules tests - run against the Firestore emulator:
 *   npm run test:rules
 *
 * "employee" = the LIFF page, which has no Firebase Auth at all, so every request it
 * makes is unauthenticated. "admin" = the Google account the admin panel signs in with.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, before, after, describe } from 'node:test';
import {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails
} from '@firebase/rules-unit-testing';
import {
    doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs,
    query, where, serverTimestamp, Timestamp
} from 'firebase/firestore';

const UID = 'U1234567890abcdef1234567890abcdef';
const TODAY = '2026-09-16';
let testEnv;

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'rules-test-in-out',
        firestore: {
            host: '127.0.0.1',
            port: 8571,
            rules: readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8')
        }
    });
});

after(async () => { await testEnv?.cleanup(); });

// The LIFF page: no auth at all
const employee = () => testEnv.unauthenticatedContext().firestore();
// The admin panel: signed in with the allow-listed Google account
const admin = () => testEnv.authenticatedContext('admin-uid', { email: 'medlifeplus@gmail.com' }).firestore();
// Somebody else signed in with the public API key
const outsider = () => testEnv.authenticatedContext('other-uid', { email: 'stranger@example.com' }).firestore();

async function seed(fn) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => { await fn(ctx.firestore()); });
}

const userDoc = {
    lineUserId: UID, name: 'สมชาย ใจดี', empId: '123', phone: '0800000000',
    dept: 'Pharmacy', status: 'Approved', pictureUrl: 'https://line/p.jpg'
};

describe('users', () => {
    before(async () => {
        await seed(async (db) => {
            await setDoc(doc(db, 'users', UID), userDoc);
            await setDoc(doc(db, 'users', 'U-other'), { ...userDoc, lineUserId: 'U-other' });
            // someone still waiting for approval - the interesting case for escalation
            await setDoc(doc(db, 'users', 'U-pending'), { ...userDoc, lineUserId: 'U-pending', status: 'Pending' });
        });
    });

    test('employee can read their own document by id', async () => {
        await assertSucceeds(getDoc(doc(employee(), 'users', UID)));
    });

    test('nobody can list the whole staff directory', async () => {
        await assertFails(getDocs(collection(employee(), 'users')));
        await assertFails(getDocs(collection(outsider(), 'users')));
    });

    test('admin can list the staff directory', async () => {
        await assertSucceeds(getDocs(collection(admin(), 'users')));
    });

    test('registration is allowed when it lands as Pending', async () => {
        await assertSucceeds(setDoc(doc(employee(), 'users', 'U-new'), {
            lineUserId: 'U-new', name: 'ใหม่', empId: '999', dept: 'General', status: 'Pending'
        }));
    });

    test('self-registering as Approved is rejected', async () => {
        await assertFails(setDoc(doc(employee(), 'users', 'U-evil'), {
            lineUserId: 'U-evil', name: 'ผี', empId: '000', dept: 'General', status: 'Approved'
        }));
    });

    test('registration with a mismatched lineUserId is rejected', async () => {
        await assertFails(setDoc(doc(employee(), 'users', 'U-mismatch'), {
            lineUserId: 'U-someone-else', name: 'ผี', status: 'Pending'
        }));
    });

    test('employee can save their own uploaded avatar (was broken before)', async () => {
        await assertSucceeds(updateDoc(doc(employee(), 'users', UID), {
            customPhotoURL: 'data:image/jpeg;base64,AAAA',
            lastPhotoUploadAt: serverTimestamp(),
            lastProfileUpdate: serverTimestamp()
        }));
    });

    test('LINE profile sync is allowed', async () => {
        await assertSucceeds(updateDoc(doc(employee(), 'users', UID), {
            pictureUrl: 'https://line/new.jpg', displayName: 'ชื่อใหม่', lastProfileUpdate: serverTimestamp()
        }));
    });

    test('a pending user cannot promote themselves to Approved', async () => {
        await assertFails(updateDoc(doc(employee(), 'users', 'U-pending'), { status: 'Approved' }));
    });

    test('nobody can suspend an approved user', async () => {
        await assertFails(updateDoc(doc(employee(), 'users', UID), { status: 'Inactive' }));
    });

    test('editing name / phone / dept through the public API is rejected', async () => {
        await assertFails(updateDoc(doc(employee(), 'users', UID), { name: 'ชื่อปลอม' }));
        await assertFails(updateDoc(doc(employee(), 'users', UID), { phone: '0999999999' }));
        await assertFails(updateDoc(doc(employee(), 'users', UID), { dept: 'Admin' }));
    });

    test('an allowed field smuggled in with a forbidden one is still rejected', async () => {
        await assertFails(updateDoc(doc(employee(), 'users', 'U-pending'), {
            pictureUrl: 'https://line/x.jpg', status: 'Approved'
        }));
    });

    test('rewriting a field to the value it already holds is a no-op, not an escalation', async () => {
        // the doc is already Approved: this write changes nothing, so the rules let it through
        await assertSucceeds(updateDoc(doc(employee(), 'users', UID), { status: 'Approved' }));
    });

    test('deleting a user is admin only', async () => {
        await assertFails(deleteDoc(doc(employee(), 'users', 'U-other')));
        await assertSucceeds(deleteDoc(doc(admin(), 'users', 'U-other')));
    });
});

describe('attendance', () => {
    const base = { userId: UID, name: 'สมชาย', empId: '123', dept: 'Pharmacy', location: { lat: 1, lng: 2 } };

    test('clocking in with a server timestamp is allowed', async () => {
        await assertSucceeds(setDoc(doc(employee(), 'attendance', 'a1'), {
            ...base, type: 'เข้างาน', timestamp: serverTimestamp()
        }));
    });

    test('the 23:00 auto checkout (past timestamp) is allowed', async () => {
        await assertSucceeds(setDoc(doc(employee(), 'attendance', 'a2'), {
            ...base, type: 'ออกงาน', timestamp: Timestamp.fromDate(new Date(Date.now() - 3600_000))
        }));
    });

    test('a future-dated record is rejected', async () => {
        await assertFails(setDoc(doc(employee(), 'attendance', 'a3'), {
            ...base, type: 'เข้างาน', timestamp: Timestamp.fromDate(new Date(Date.now() + 86_400_000))
        }));
    });

    test('an unknown record type is rejected', async () => {
        await assertFails(setDoc(doc(employee(), 'attendance', 'a4'), {
            ...base, type: 'hacked', timestamp: serverTimestamp()
        }));
    });

    test('editing or deleting a record is admin only', async () => {
        await seed(async (db) => {
            await setDoc(doc(db, 'attendance', 'a5'), { ...base, type: 'เข้างาน', timestamp: Timestamp.now() });
        });
        await assertFails(updateDoc(doc(employee(), 'attendance', 'a5'), { type: 'ออกงาน' }));
        await assertFails(deleteDoc(doc(employee(), 'attendance', 'a5')));
        await assertSucceeds(deleteDoc(doc(admin(), 'attendance', 'a5')));
    });

    test('the employee page can still query its own history', async () => {
        await assertSucceeds(getDocs(query(collection(employee(), 'attendance'), where('userId', '==', UID))));
    });
});

describe('leave_requests', () => {
    test('a leave request must be created as Pending', async () => {
        await assertSucceeds(setDoc(doc(employee(), 'leave_requests', 'l1'), {
            userId: UID, name: 'สมชาย', type: 'ลาป่วย', startDate: TODAY, endDate: TODAY, status: 'Pending'
        }));
    });

    test('self-approving a leave request is rejected', async () => {
        await assertFails(setDoc(doc(employee(), 'leave_requests', 'l2'), {
            userId: UID, name: 'สมชาย', type: 'ลาป่วย', startDate: TODAY, endDate: TODAY, status: 'Approved'
        }));
    });

    test('the auto-approved work schedule notice is still allowed', async () => {
        await assertSucceeds(setDoc(doc(employee(), 'leave_requests', 'l3'), {
            userId: UID, name: 'สมชาย', type: 'แจ้งเวลาปฏิบัติงาน',
            startDate: TODAY, endDate: TODAY, status: 'Approved'
        }));
    });

    test('approving an existing request is admin only', async () => {
        await assertFails(updateDoc(doc(employee(), 'leave_requests', 'l1'), { status: 'Approved' }));
        await assertSucceeds(updateDoc(doc(admin(), 'leave_requests', 'l1'), { status: 'Approved' }));
    });
});

describe('schedules', () => {
    test('the employee page can write its own shift as userId_date', async () => {
        await assertSucceeds(setDoc(doc(employee(), 'schedules', `${UID}_${TODAY}`), {
            userId: UID, name: 'สมชาย', date: TODAY, shiftDetail: '⏰ 08:00 - 17:00'
        }));
    });

    test('a document whose id does not match its payload is rejected', async () => {
        await assertFails(setDoc(doc(employee(), 'schedules', 'junk-doc-id'), {
            userId: UID, name: 'สมชาย', date: TODAY, shiftDetail: '⏰ 08:00 - 17:00'
        }));
        await assertFails(setDoc(doc(employee(), 'schedules', `${UID}_${TODAY}`), {
            userId: 'U-other', name: 'คนอื่น', date: TODAY, shiftDetail: '⏰ 08:00 - 17:00'
        }));
    });

    test('deleting a shift is admin only', async () => {
        await assertFails(deleteDoc(doc(employee(), 'schedules', `${UID}_${TODAY}`)));
        await assertSucceeds(deleteDoc(doc(admin(), 'schedules', `${UID}_${TODAY}`)));
    });
});

describe('admins', () => {
    test('the admin list stays closed to everyone else', async () => {
        await assertFails(getDoc(doc(employee(), 'admins', 'admin-uid')));
        await assertFails(getDoc(doc(outsider(), 'admins', 'admin-uid')));
        await assertFails(setDoc(doc(outsider(), 'admins', 'other-uid'), { email: 'stranger@example.com' }));
    });

    test('an admin can read it', async () => {
        await assertSucceeds(getDoc(doc(admin(), 'admins', 'admin-uid')));
    });
});

test('rules file is the one under test', () => {
    assert.ok(readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8').length > 0);
});
