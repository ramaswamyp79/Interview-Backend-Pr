import admin from "firebase-admin";

/**
 * Firestore doesn't use rigid schemas like Mongoose. 
 * This function enforces our defaults before saving a new User to the database.
 */
export const formatUserData = (data) => {
  return {
    fullName: data.fullName?.trim() || "",
    email: data.email ? data.email.toLowerCase().trim() : "",
    password: data.password || null,
    role: data.role || "Job Seeker",
    resumeUrl: data.resumeUrl || null,
    authProvider: data.authProvider || "local",
    authProviderId: data.authProviderId || null,
    onboardingCompleted: data.onboardingCompleted || false,
    interviewStats: {
      sessionsTaken: data.interviewStats?.sessionsTaken || 0,
      averageScore: data.interviewStats?.averageScore || 0,
    },
    credits: data.credits || 0,
    resetOtp: data.resetOtp || null,
    resetOtpExpiry: data.resetOtpExpiry || null,
    createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

// We export this so we can quickly format user data returning to the frontend 
// to ensure the frontend still sees the `_id` field it expects.
export const mapUserDoc = (doc) => {
  if (!doc.exists) return null;
  return { _id: doc.id, ...doc.data() };
};