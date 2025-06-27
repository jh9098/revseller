import type { Handler } from "@netlify/functions";
import { db } from "./firebaseAdmin";

const handler: Handler = async (event) => {
  const { uid, businessNumber } = JSON.parse(event.body || "{}");

  // TODO: Codef 실제 검사
  console.log("사업자 번호:", businessNumber);

  await db.doc(`sellers/${uid}`).set({ isVerified: true }, { merge: true });
  return { statusCode: 200, body: JSON.stringify({ isVerified: true }) };
};
export { handler };
