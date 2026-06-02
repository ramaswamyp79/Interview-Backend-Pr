import admin from "firebase-admin";
import db from "../config/db.js";
import { formatResumeData, mapResumeDoc } from "../Model/Resume.js";
import { bucket } from "../utils/gcs.js";

const BASE_URL = process.env.BACKEND_URL;

// ================= CREATE RESUME =================
export const createResume = async (data) => {
  // Determine version for the same user & same title
  const snapshot = await db.collection("resumes")
    .where("user", "==", data.user)
    .where("title", "==", data.title)
    .orderBy("version", "desc")
    .limit(1)
    .get();

  let lastVersion = 0;
  if (!snapshot.empty) {
    lastVersion = Number(snapshot.docs[0].data().version || 0);
  }

  const version = lastVersion + 1;

  // Generate new document reference
  const resumeRef = db.collection("resumes").doc();
  const resumeData = formatResumeData({ ...data, version });

  // Save to Firestore
  await resumeRef.set(resumeData);

  return { _id: resumeRef.id, ...resumeData };
};

export const getResumes = async (userId, page = 1, limit = 6) => {
  if (!userId) throw new Error("User ID missing");

  const skip = (page - 1) * limit;

  // Use parallel execution for count and data fetch to save time
  const [countSnapshot, dataSnapshot] = await Promise.all([
    db.collection("resumes")
      .where("user", "==", userId)
      .where("isDeleted", "==", false)
      .count()
      .get(),
    db.collection("resumes")
      .where("user", "==", userId)
      .where("isDeleted", "==", false)
      .orderBy("createdAt", "desc")
      .offset(skip)
      .limit(limit)
      .get()
  ]);

  const total = countSnapshot.data().count;
  const resumes = dataSnapshot.docs.map(mapResumeDoc);

  const formatted = resumes.map((r) => ({
    ...r,
    title: `${r.title} (v${r.version})`,
    previewUrl: `${BASE_URL}/api/resume/view/${r._id}`,
    downloadUrl: `${BASE_URL}/api/resume/download/${r._id}`,
  }));

  return {
    data: formatted,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

// ================= SOFT DELETE RESUME =================
export const deleteResume = async (resumeId, userId) => {
  if (!resumeId || !userId) {
    throw new Error("Resume ID & User ID are required");
  }

  const resumeRef = db.collection("resumes").doc(resumeId);
  const doc = await resumeRef.get();

  // Verify document exists, belongs to user, and isn't already deleted
  if (!doc.exists || doc.data().user !== userId || doc.data().isDeleted) {
    throw new Error("Resume not found or already deleted");
  }

  console.log("🗑 Soft deleting resume:", doc.id);

  // Soft delete using FieldValue timestamps
  await resumeRef.update({
    isDeleted: true,
    deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    isDefault: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Ensure user still has a default resume
  const anotherSnapshot = await db.collection("resumes")
    .where("user", "==", userId)
    .where("isDeleted", "==", false)
    .get();

  if (!anotherSnapshot.empty) {
    // 🔥 FIXED: Sorted in JS to bypass the hidden index requirement here
    const sortedDocs = anotherSnapshot.docs.sort((a, b) => {
      const timeA = a.data().createdAt?.toMillis() || 0;
      const timeB = b.data().createdAt?.toMillis() || 0;
      return timeB - timeA;
    });

    const anotherDocRef = sortedDocs[0].ref;
    await anotherDocRef.update({
      isDefault: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  console.log("✅ Resume soft deleted");

  return { message: "Resume deleted successfully" };
};