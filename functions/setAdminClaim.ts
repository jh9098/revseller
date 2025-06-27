import type { Handler } from "@netlify/functions";
import { auth } from "./firebaseAdmin";

const handler: Handler = async (event) => {
  const { requesterUid, targetEmail } = JSON.parse(event.body!);
  const requester = await auth.getUser(requesterUid);
  if (!(requester.customClaims?.admin)) {
    return { statusCode: 403, body: "NO_ADMIN" };
  }
  const target = await auth.getUserByEmail(targetEmail);
  await auth.setCustomUserClaims(target.uid, { admin: true });
  return { statusCode: 200, body: "OK" };
};
export { handler };
