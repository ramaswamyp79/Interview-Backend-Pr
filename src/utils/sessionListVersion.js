import admin from "firebase-admin";
import db from "../config/db.js";

const META_COLLECTION = "session_list_meta";

export const getSessionListVersion = async (userId) => {
  const doc = await db.collection(META_COLLECTION).doc(userId).get();

  if (!doc.exists) {
    return "0";
  }

  return String(doc.data()?.version || "0");
};

export const touchSessionListVersion = async (userId, batch = null) => {
  const metaRef = db.collection(META_COLLECTION).doc(userId);

  const payload = {
    userId,
    version: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (batch) {
    batch.set(metaRef, payload, { merge: true });
    return;
  }

  await metaRef.set(payload, { merge: true });
};
