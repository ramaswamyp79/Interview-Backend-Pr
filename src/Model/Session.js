import admin from "firebase-admin";

export const formatSessionData = (data) => {
  // Helper to safely convert JS Dates or Strings to Firestore Timestamps
  const parseDate = (val) => {
    if (!val) return null;
    if (val instanceof admin.firestore.Timestamp) return val;
    return admin.firestore.Timestamp.fromDate(new Date(val));
  };

  return {
    title: data.title || "",
    company: data.company || "",
    jobDescription: data.jobDescription || "",
    position: data.position || "",
    skills: Array.isArray(data.skills) ? data.skills : [],
    location: data.location || "",
    timezone: data.timezone || "",
    scheduledAt: parseDate(data.scheduledAt),
    meetingLink: data.meetingLink || "",

    resumeId: data.resumeId || null,
    selectedResumeName: data.selectedResumeName || "",
    owner: data.owner, // User ID

    language: data.language || "English",
    aiModel: data.aiModel || "",
    simpleEnglish: data.simpleEnglish || false,
    extraContext: data.extraContext || "",
    saveTranscript: data.saveTranscript || false,
    shareAudio: data.shareAudio || false,
    connectionMethod: data.connectionMethod || "",
    autoExtend: data.autoExtend !== undefined ? data.autoExtend : true,
    trial: data.trial || false,

    creditsUsed: data.creditsUsed || 0,
    durationMinutes: data.durationMinutes || 30,
    actualDurationMinutes: data.actualDurationMinutes || null,

    status: data.status || "draft",
    startAt: parseDate(data.startAt),
    endAt: parseDate(data.endAt),

    participants: Array.isArray(data.participants) ? data.participants : [],
    
    createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

export const mapSessionDoc = (doc) => {
  if (!doc.exists) return null;
  return { _id: doc.id, ...doc.data() };
};