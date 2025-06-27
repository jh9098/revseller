import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";

admin.initializeApp();
const db = admin.firestore();

const TOSS_SECRET_KEY = functions.config().toss.secret_key;
const REGION = "asia-northeast3";

// 1) 사업자 인증 (stub)
export const verifyBusinessNumber = functions.region(REGION).https.onCall(async (data) => {
  console.log("verify biz:", data);
  return { isVerified: true };
});

// 2) Toss 결제 승인
export const confirmTossPayment = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인 필요");
  const { paymentKey, orderId, amount, productId } = data;
  const productRef = db.doc(`products/${productId}`);
  const snap = await productRef.get();
  if (!snap.exists) throw new functions.https.HttpsError("not-found", "상품 없음");

  const basic = Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");
  const res = await axios.post(
    "https://api.tosspayments.com/v1/payments/confirm",
    { paymentKey, orderId, amount },
    { headers: { Authorization: `Basic ${basic}` } }
  );

  if (res.data.status !== "DONE") throw new functions.https.HttpsError("aborted", "결제 실패");

  await db.collection("payments").add({
    sellerId: context.auth.uid,
    productId,
    amount: res.data.totalAmount,
    tossPaymentKey: paymentKey,
    orderId,
    status: "PAID",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await productRef.update({ status: "live" });
  return { success: true };
});

// 3) 관리자 claim
export const setAdminClaim = functions.region(REGION).https.onCall(async (data, context) => {
  if (context.auth?.token.admin !== true)
    throw new functions.https.HttpsError("permission-denied", "관리자 전용");
  const { email } = data;
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  return { ok: true };
});
