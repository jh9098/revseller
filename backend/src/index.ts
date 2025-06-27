import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import axios from 'axios';
import { verifyFirebaseToken } from './middlewares/auth.js';
import { randomUUID } from 'crypto';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

// ----- Firebase Admin -----
admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_KEY!, 'base64').toString())
  )
});
const db = admin.firestore();

// ----- ENV -----
const TOSS_SK = process.env.TOSS_SECRET_KEY!;           // Render 환경변수
const CODEF_KEY = process.env.CODEF_API_KEY ?? '';      // 필요하면 사용

// -------- Routes ---------

// 사업자 인증 (예: Codef 연동)
app.post('/api/business/verify', verifyFirebaseToken, async (req, res) => {
  const { businessNumber } = req.body;
  // FIXME: real Codef call → isVerified
  const isVerified = true;  // 데모
  if (!isVerified) return res.status(400).json({ verified: false });
  // sellers/{uid} 문서 업데이트
  await db.doc(`sellers/${(req as any).user.uid}`).set(
    { businessNumber, isVerified: true },
    { merge: true }
  );
  res.json({ verified: true });
});

// 토스 결제 승인
app.post('/api/payment/confirm', verifyFirebaseToken, async (req, res) => {
  const { paymentKey, orderId, amount, productId } = req.body;
  const productRef = db.doc(`products/${productId}`);
  const prodSnap = await productRef.get();
  if (!prodSnap.exists) return res.status(404).json({ error: 'No product' });

  const basic = Buffer.from(`${TOSS_SK}:`).toString('base64');
  try {
    const tossRes = await axios.post(
      'https://api.tosspayments.com/v1/payments/confirm',
      { paymentKey, orderId, amount },
      { headers: { Authorization: `Basic ${basic}` } }
    );

    if (tossRes.data.status !== 'DONE')
      throw new Error('Not paid');

    // payments 컬렉션 기록
    await db.collection('payments').add({
      sellerId: (req as any).user.uid,
      productId,
      amount: tossRes.data.totalAmount,
      tossPaymentKey: paymentKey,
      orderId,
      status: 'PAID',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await productRef.update({ status: 'live' });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.response?.data ?? e.message });
  }
});

// 관리자 권한 부여
app.post('/api/admin/set-claim', verifyFirebaseToken, async (req, res) => {
  if (!(req as any).user.admin) return res.status(403).end();
  const { email } = req.body;
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  res.json({ ok: true });
});

app.get('/', (_, res) =>
  res.send(`Seller API ready ${randomUUID().slice(0, 8)}`)
);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Render API on', PORT));
