import admin from "firebase-admin";

/**
 * Formats payment data before saving to Firestore.
 */
export const formatPaymentData = (data) => {
  return {
    userId: data.userId || "",
    stripeSessionId: data.stripeSessionId || "",
    amount: data.amount || 0,
    currency: data.currency || "INR",
    credits: data.credits || 0,
    status: data.status || "pending",
    createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

/**
 * Maps a Firestore document to a standard JS object, restoring the _id property.
 */
export const mapPaymentDoc = (doc) => {
  if (!doc.exists) return null;
  return { _id: doc.id, ...doc.data() };
};