/**
 * Turns a LINE LIFF login into a real Firebase account.
 *
 * The employee page has always identified people by their LINE user id while talking
 * to Firestore as an anonymous caller, which left the security rules with nothing to
 * check. This exchanges the LIFF id token for a Firebase custom token whose uid IS the
 * LINE user id, so every existing document - all of which already carry userId - can be
 * matched against request.auth.uid in firestore.rules.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

// The LINE Login channel that issued the token. It is the numeric half of the LIFF id
// (2008951813-KgjInNxK) and is not a secret - it ships inside index.html. Override it
// with LINE_CHANNEL_ID in functions/.env if the channel ever changes.
const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || '2008951813';

// Singapore is the closest region to the shop; keep the client's getFunctions() in sync.
const REGION = 'asia-southeast1';

exports.lineLogin = onCall({ region: REGION, cors: true }, async (request) => {
    const idToken = request.data && request.data.idToken;
    if (typeof idToken !== 'string' || idToken.length === 0) {
        throw new HttpsError('invalid-argument', 'idToken is required');
    }

    // LINE verifies the signature, the audience and the expiry for us. Anything other
    // than 200 means the token is not a valid, current token for our own channel.
    const response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            id_token: idToken,
            client_id: LINE_CHANNEL_ID
        })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        console.warn('LINE rejected an id token:', payload.error, payload.error_description);
        throw new HttpsError('unauthenticated', 'LINE could not verify this login.');
    }

    // sub is the LINE user id - the same value the app already writes as userId.
    const lineUserId = payload.sub;
    if (typeof lineUserId !== 'string' || !lineUserId.startsWith('U')) {
        throw new HttpsError('unauthenticated', 'LINE returned no user id.');
    }

    const token = await admin.auth().createCustomToken(lineUserId, { provider: 'line' });
    return { token };
});
