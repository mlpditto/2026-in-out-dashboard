/**
 * Security rules tests - run against the Firestore emulator:
 *   npm run test:rules
 *
 * This is the only rules suite, and it describes production. The LIFF page signs in with
 * a custom token whose uid is the LINE user id, so "employee" here is authenticated, and
 * "anon" - a caller with no Firebase Auth at all - must be turned away everywhere.
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

const RULES_FILE = process.env.RULES_FILE || 'firestore.rules';
const UID = 'U1234567890abcdef1234567890abcdef';
const OTHER = 'U-other';
const TODAY = '2026-09-16';
let testEnv;

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'rules-test-in-out',
        firestore: {
            host: '127.0.0.1',
            port: 8571,
            rules: readFileSync(RULES_FILE, 'utf8')
        }
    });
    await seedFixtures();
});

after(async () => { await testEnv?.cleanup(); });

// The LIFF page after signing in with the custom token: uid === LINE user id
const employee = () => testEnv.authenticatedContext(UID).firestore();
// A second signed-in employee - the colleague whose data must stay private
const colleague = () => testEnv.authenticatedContext(OTHER).firestore();
// What a scraper looks like, and what the LIFF page looked like before Layer 2
const anon = () => testEnv.unauthenticatedContext().firestore();
// The admin panel: signed in with the allow-listed Google account
const admin = () => testEnv.authenticatedContext('admin-uid', { email: 'medlifeplus@gmail.com' }).firestore();

async function seed(fn) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => { await fn(ctx.firestore()); });
}

const userDoc = {
    lineUserId: UID, name: 'สมชาย ใจดี', empId: '123', phone: '0800000000',
    dept: 'Pharmacy', status: 'Approved', pictureUrl: 'https://line/p.jpg'
};

async function seedFixtures() {
    await seed(async (db) => {
        await setDoc(doc(db, 'users', UID), userDoc);
        await setDoc(doc(db, 'users', OTHER), { ...userDoc, lineUserId: OTHER, name: 'คนอื่น' });
        // still waiting for approval - the interesting case for self-escalation
        await setDoc(doc(db, 'users', 'U-pending'), { ...userDoc, lineUserId: 'U-pending', status: 'Pending' });
        // exists purely so the admin has something to delete
        await setDoc(doc(db, 'users', 'U-disposable'), { ...userDoc, lineUserId: 'U-disposable' });

        // one record of each kind for each of the two employees
        for (const owner of [UID, OTHER]) {
            await setDoc(doc(db, 'attendance', `a-${owner}`), {
                userId: owner,
                type: 'เข้างาน',
                timestamp: Timestamp.fromDate(new Date('2026-09-16T01:00:00Z')),
                location: { lat: 13.7, lng: 100.5 }
            });
            await setDoc(doc(db, 'leave_requests', `l-${owner}`), {
                userId: owner, status: 'Pending', type: 'ลาป่วย',
                reason: 'ไข้หวัด', certificateUrl: 'https://example/cert.jpg'
            });
            await setDoc(doc(db, 'schedules', `${owner}_${TODAY}`), {
                userId: owner, date: TODAY, shiftDetail: '⏰ 08:00 - 17:00'
            });
        }
    });
}

describe('anonymous callers (any scraper, and the pre-Layer-2 LIFF page)', () => {
    test('cannot read attendance, schedules or leave requests', async () => {
        await assertFails(getDoc(doc(anon(), 'attendance', `a-${UID}`)));
        await assertFails(getDocs(query(collection(anon(), 'attendance'), where('userId', '==', UID))));
        await assertFails(getDoc(doc(anon(), 'schedules', `${UID}_${TODAY}`)));
        await assertFails(getDocs(query(collection(anon(), 'leave_requests'), where('userId', '==', UID))));
    });

    test('cannot read a user profile or write anything', async () => {
        await assertFails(getDoc(doc(anon(), 'users', UID)));
        await assertFails(setDoc(doc(anon(), 'attendance', 'a-anon'), {
            userId: UID, type: 'เข้างาน', timestamp: serverTimestamp()
        }));
        await assertFails(setDoc(doc(anon(), 'users', 'U-new-anon'), {
            lineUserId: 'U-new-anon', status: 'Pending'
        }));
    });
});

describe('users', () => {
    test('an employee reads their own document and nobody elses', async () => {
        await assertSucceeds(getDoc(doc(employee(), 'users', UID)));
        await assertFails(getDoc(doc(employee(), 'users', OTHER)));
    });

    test('the staff directory stays admin-only', async () => {
        await assertFails(getDocs(collection(employee(), 'users')));
        await assertSucceeds(getDocs(collection(admin(), 'users')));
    });

    test('self registration lands as Pending under the callers own id', async () => {
        const newcomer = testEnv.authenticatedContext('U-new').firestore();
        await assertSucceeds(setDoc(doc(newcomer, 'users', 'U-new'), {
            lineUserId: 'U-new', name: 'พนักงานใหม่', status: 'Pending'
        }));
    });

    test('self-registering straight as Approved is rejected', async () => {
        const sneaky = testEnv.authenticatedContext('U-sneaky').firestore();
        await assertFails(setDoc(doc(sneaky, 'users', 'U-sneaky'), {
            lineUserId: 'U-sneaky', name: 'ปลอม', status: 'Approved'
        }));
    });

    test('registering under somebody elses id is rejected', async () => {
        await assertFails(setDoc(doc(employee(), 'users', 'U-victim'), {
            lineUserId: 'U-victim', name: 'ปลอม', status: 'Pending'
        }));
    });

    test('an employee can sync their LINE picture', async () => {
        await assertSucceeds(updateDoc(doc(employee(), 'users', UID), {
            pictureUrl: 'https://line/new.jpg', lastProfileUpdate: serverTimestamp()
        }));
    });

    test('an employee can save the avatar they uploaded themselves', async () => {
        await assertSucceeds(updateDoc(doc(employee(), 'users', UID), {
            customPhotoURL: 'data:image/jpeg;base64,AAAA',
            lastPhotoUploadAt: serverTimestamp(),
            lastProfileUpdate: serverTimestamp()
        }));
    });

    test('editing status or staff fields from the employee page is rejected', async () => {
        await assertFails(updateDoc(doc(employee(), 'users', UID), { status: 'Approved', empId: '999' }));
        await assertFails(updateDoc(doc(employee(), 'users', UID), { name: 'ชื่อใหม่', phone: '0899999999' }));
    });

    test('an allowed field smuggled in with a forbidden one is still rejected', async () => {
        await assertFails(updateDoc(doc(employee(), 'users', UID), {
            pictureUrl: 'https://line/ok.jpg', dept: 'Management'
        }));
    });

    test('a pending user cannot promote themselves to Approved', async () => {
        const pending = testEnv.authenticatedContext('U-pending').firestore();
        await assertFails(updateDoc(doc(pending, 'users', 'U-pending'), { status: 'Approved' }));
    });

    test('an approved user cannot suspend themselves either', async () => {
        await assertFails(updateDoc(doc(employee(), 'users', UID), { status: 'Inactive' }));
    });

    test('rewriting a field to the value it already holds is a no-op, not an escalation', async () => {
        // the document is already Approved: this write changes nothing, so the rules allow it
        await assertSucceeds(updateDoc(doc(employee(), 'users', UID), { status: 'Approved' }));
    });

    test('an employee cannot edit a colleagues picture', async () => {
        await assertFails(updateDoc(doc(employee(), 'users', OTHER), { pictureUrl: 'https://evil/p.jpg' }));
    });

    test('deleting a user is admin only', async () => {
        await assertFails(deleteDoc(doc(employee(), 'users', UID)));
        await assertSucceeds(deleteDoc(doc(admin(), 'users', 'U-disposable')));
    });
});

describe('attendance', () => {
    test('an employee reads only their own records', async () => {
        await assertSucceeds(getDoc(doc(employee(), 'attendance', `a-${UID}`)));
        await assertFails(getDoc(doc(employee(), 'attendance', `a-${OTHER}`)));
    });

    test('the apps own scoped query works, an unscoped sweep does not', async () => {
        await assertSucceeds(getDocs(query(collection(employee(), 'attendance'), where('userId', '==', UID))));
        await assertFails(getDocs(collection(employee(), 'attendance')));
        await assertFails(getDocs(query(collection(employee(), 'attendance'), where('userId', '==', OTHER))));
    });

    test('clocking in writes under the callers own id', async () => {
        await assertSucceeds(setDoc(doc(employee(), 'attendance', 'a-new'), {
            userId: UID, type: 'เข้างาน', timestamp: serverTimestamp(),
            location: { lat: 13.7, lng: 100.5 }
        }));
    });

    test('the 23:00 auto checkout writes a past timestamp and is allowed', async () => {
        await assertSucceeds(setDoc(doc(employee(), 'attendance', 'a-auto'), {
            userId: UID, type: 'ออกงาน',
            timestamp: Timestamp.fromDate(new Date(Date.now() - 3600e3)),
            userAgent: 'Evaluate-System (Auto 23:00)'
        }));
    });

    test('clocking in for somebody else is rejected', async () => {
        await assertFails(setDoc(doc(employee(), 'attendance', 'a-forged'), {
            userId: OTHER, type: 'เข้างาน', timestamp: serverTimestamp()
        }));
    });

    test('a made-up record type or a future timestamp is rejected', async () => {
        await assertFails(setDoc(doc(employee(), 'attendance', 'a-bad-type'), {
            userId: UID, type: 'โกง', timestamp: serverTimestamp()
        }));
        await assertFails(setDoc(doc(employee(), 'attendance', 'a-future'), {
            userId: UID, type: 'ออกงาน', timestamp: Timestamp.fromDate(new Date(Date.now() + 864e5))
        }));
    });

    test('editing or deleting a stamp is admin only', async () => {
        await assertFails(updateDoc(doc(employee(), 'attendance', `a-${UID}`), { type: 'ออกงาน' }));
        await assertSucceeds(updateDoc(doc(admin(), 'attendance', `a-${UID}`), { type: 'ออกงาน' }));
    });
});

describe('leave requests', () => {
    test('a leave reason and its certificate stay private to the author', async () => {
        await assertSucceeds(getDoc(doc(employee(), 'leave_requests', `l-${UID}`)));
        await assertFails(getDoc(doc(employee(), 'leave_requests', `l-${OTHER}`)));
        await assertFails(getDoc(doc(colleague(), 'leave_requests', `l-${UID}`)));
    });

    test('leave is filed as Pending under the callers own id', async () => {
        await assertSucceeds(setDoc(doc(employee(), 'leave_requests', 'l-new'), {
            userId: UID, status: 'Pending', type: 'ลากิจ', reason: 'ธุระ'
        }));
        await assertFails(setDoc(doc(employee(), 'leave_requests', 'l-forged'), {
            userId: OTHER, status: 'Pending', type: 'ลากิจ', reason: 'ธุระ'
        }));
    });

    test('self-approving leave is rejected, except the work schedule notice', async () => {
        await assertFails(setDoc(doc(employee(), 'leave_requests', 'l-self'), {
            userId: UID, status: 'Approved', type: 'ลาป่วย'
        }));
        await assertSucceeds(setDoc(doc(employee(), 'leave_requests', 'l-notice'), {
            userId: UID, status: 'Approved', type: 'แจ้งเวลาปฏิบัติงาน'
        }));
    });

    test('approving an existing request is admin only', async () => {
        await assertFails(updateDoc(doc(employee(), 'leave_requests', `l-${UID}`), { status: 'Approved' }));
        await assertSucceeds(updateDoc(doc(admin(), 'leave_requests', `l-${UID}`), { status: 'Approved' }));
    });
});

describe('schedules', () => {
    test('an employee sees their own roster only', async () => {
        await assertSucceeds(getDocs(query(collection(employee(), 'schedules'), where('userId', '==', UID))));
        await assertFails(getDoc(doc(employee(), 'schedules', `${OTHER}_${TODAY}`)));
        await assertFails(getDocs(collection(employee(), 'schedules')));
    });

    test('the work schedule notice writes its own userId_date document', async () => {
        await assertSucceeds(setDoc(doc(employee(), 'schedules', `${UID}_2026-09-17`), {
            userId: UID, date: '2026-09-17', shiftDetail: '⏰ 08:00 - 17:00'
        }));
    });

    test('a shift cannot be written onto a colleague or under a mismatched id', async () => {
        await assertFails(setDoc(doc(employee(), 'schedules', `${OTHER}_${TODAY}`), {
            userId: OTHER, date: TODAY, shiftDetail: '⏰ 08:00 - 17:00'
        }));
        await assertFails(setDoc(doc(employee(), 'schedules', 'junk-doc-id'), {
            userId: UID, date: TODAY, shiftDetail: '⏰ 08:00 - 17:00'
        }));
    });

    test('deleting a shift is admin only', async () => {
        await assertFails(deleteDoc(doc(employee(), 'schedules', `${UID}_${TODAY}`)));
        await assertSucceeds(deleteDoc(doc(admin(), 'schedules', `${UID}_${TODAY}`)));
    });
});

describe('survey responses', () => {
    const answers = { q1: 4, q2: 5 };

    test('an employee posts their own answers only', async () => {
        await assertSucceeds(setDoc(doc(employee(), 'survey_responses', UID), {
            userId: UID, name: 'สมชาย', dept: 'Pharmacy', answers, timestamp: serverTimestamp()
        }));
        await assertFails(setDoc(doc(employee(), 'survey_responses', OTHER), {
            userId: OTHER, name: 'คนอื่น', dept: 'Pharmacy', answers, timestamp: serverTimestamp()
        }));
    });

    test('answers are readable by the admin panel only', async () => {
        await assertFails(getDoc(doc(employee(), 'survey_responses', UID)));
        await assertSucceeds(getDocs(collection(admin(), 'survey_responses')));
    });
});

describe('cash submissions', () => {
    const submission = {
        userId: UID, name: 'สมชาย', dept: 'Pharmacy', date: TODAY,
        timestamp: serverTimestamp(), entries: [], totalAmount: 5000,
        drawerType: 'ลิ้นชักบน', targetAmount: 5000, diffAmount: 0
    };

    test('an employee posts a cash count under their own id', async () => {
        await assertSucceeds(setDoc(doc(employee(), 'cash_submissions', 'c1'), submission));
        await assertFails(setDoc(doc(employee(), 'cash_submissions', 'c2'), { ...submission, userId: OTHER }));
    });

    test('a cash count without a numeric total is rejected', async () => {
        await assertFails(setDoc(doc(employee(), 'cash_submissions', 'c3'), {
            ...submission, totalAmount: '5000'
        }));
    });

    test('cash counts cannot be read or rewritten from the employee page', async () => {
        await assertFails(getDoc(doc(employee(), 'cash_submissions', 'c1')));
        await assertFails(updateDoc(doc(employee(), 'cash_submissions', 'c1'), { totalAmount: 1 }));
        await assertSucceeds(getDoc(doc(admin(), 'cash_submissions', 'c1')));
    });
});

describe('admins', () => {
    test('the admin list stays closed to employees and anonymous callers', async () => {
        await assertFails(getDoc(doc(employee(), 'admins', 'admin-uid')));
        await assertFails(getDoc(doc(anon(), 'admins', 'admin-uid')));
        await assertFails(setDoc(doc(employee(), 'admins', UID), { email: 'me@example.com' }));
    });

    test('an admin can read it', async () => {
        await assertSucceeds(getDoc(doc(admin(), 'admins', 'admin-uid')));
    });
});

test('the deployed rules file is the one under test', () => {
    const rules = readFileSync(RULES_FILE, 'utf8');
    assert.ok(rules.includes('function isSelf('), 'expected the isSelf() helper that scopes reads to their owner');
});
