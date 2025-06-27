import type { Handler } from "@netlify/functions";
import axios from "axios";
import { db, FieldValue } from "./firebaseAdmin";

const handler: Handler = async (event) => {
  const { uid, paymentKey, orderId, amount, productId } = JSON.parse(event.body!);

  const basic = Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64");
  const toss = await axios.post(
    "https://api.tosspayments.com/v1/payments/confirm",
    { paymentKey, orderId, amount },
    { headers: { Authorization: `Basic ${basic}` } }
  );

  if (toss.data.status !== "DONE") return { statusCode: 400, body: "PAYMENT_FAIL" };

  await db.collection("payments").add({
    sellerId: uid,
    productId,
    amount: toss.data.totalAmount,
    orderId,
    status: "PAID",
    createdAt: FieldValue.serverTimestamp(),
  });
  await db.doc(`products/${productId}`).update({ status: "live" });

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
export { handler };
