import admin from "firebase-admin";

/**
 * Formats data before saving to Firestore to enforce schema-like rules
 */
export const formatResumeData = (data) => {
  return {
    user: data.user, // User ID string
    email: data.email ? data.email.toLowerCase().trim() : "",
    title: data.title?.trim() || "Untitled",
    version: data.version || 1,
    resumePath: data.resumePath || "",
    previewPdfPath: data.previewPdfPath || "",
    textPath: data.textPath || "",
    jsonPath: data.jsonPath || "",
    parsedData: data.parsedData || {},
    isDeleted: data.isDeleted || false,
    deletedAt: data.deletedAt || null,
    isDefault: data.isDefault || false,
    createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

/**
 * Maps a Firestore document to a standard JS object, restoring the _id property
 */
export const mapResumeDoc = (doc) => {
  if (!doc.exists) return null;
  return { _id: doc.id, ...doc.data() };
};