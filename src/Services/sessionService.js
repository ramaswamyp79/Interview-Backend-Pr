import admin from "firebase-admin";
import db from "../config/db.js";
import { touchSessionListVersion } from "../utils/sessionListVersion.js";
import { formatSessionData, mapSessionDoc } from "../Model/Session.js";
import { mapUserDoc } from "../Model/User.js";

/* ================= CREATE ================= */
const createSession = async ({ userId, payload }) => {
  const sessionRef = db.collection("sessions").doc();
  const sessionData = formatSessionData({
    ...payload,
    owner: userId,
  });

  const batch = db.batch();

  batch.set(sessionRef, sessionData);
  touchSessionListVersion(userId, batch);

  await batch.commit();

  const freshDoc = await sessionRef.get();
  return mapSessionDoc(freshDoc);
};

/* ================= GET BY ID WITH POPULATE ================= */
const getSessionById = async (sessionId) => {
  const sessionDoc = await db.collection("sessions").doc(sessionId).get();

  if (!sessionDoc.exists) {
    throw new Error("Session not found");
  }

  const session = mapSessionDoc(sessionDoc);

  if (session.owner) {
    const userDoc = await db.collection("users").doc(session.owner).get();

    if (userDoc.exists) {
      const userData = userDoc.data();

      session.owner = {
        _id: userDoc.id,
        fullName: userData.fullName,
        email: userData.email,
      };
    }
  }

  return session;
};

/* ================= LIST ULTRA OPTIMIZED ================= */
const listSessionsForUser = async (userId, page = 1, limit = 6, baseUrl) => {
  if (!baseUrl) throw new Error("Base URL missing");

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.max(Number(limit) || 6, 1);
  const skip = (safePage - 1) * safeLimit;

  const sessionsRef = db.collection("sessions");

  const [countSnapshot, snapshot] = await Promise.all([
    sessionsRef.where("owner", "==", userId).count().get(),

    sessionsRef
      .where("owner", "==", userId)
      .orderBy("createdAt", "desc")
      .offset(skip)
      .limit(safeLimit)
      .get(),
  ]);

  const total = countSnapshot.data().count || 0;
  const totalPages = Math.ceil(total / safeLimit);
  const sessions = snapshot.docs.map(mapSessionDoc);

  if (sessions.length === 0) {
    return {
      data: [],
      page: safePage,
      total,
      totalPages,
    };
  }

  const uniqueResumeIds = [
    ...new Set(
      sessions
        .map((session) => session.resumeId)
        .filter(Boolean)
        .map((resumeId) =>
          typeof resumeId === "object" && resumeId._id ? resumeId._id : resumeId
        )
    ),
  ];

  const resumeCache = {};

  if (uniqueResumeIds.length > 0) {
    const chunks = [];

    for (let i = 0; i < uniqueResumeIds.length; i += 10) {
      chunks.push(uniqueResumeIds.slice(i, i + 10));
    }

    const resumeSnapshots = await Promise.all(
      chunks.map((chunk) =>
        db
          .collection("resumes")
          .where(admin.firestore.FieldPath.documentId(), "in", chunk)
          .get()
      )
    );

    resumeSnapshots.forEach((resumeSnapshot) => {
      resumeSnapshot.forEach((doc) => {
        resumeCache[doc.id] = doc.data();
      });
    });
  }

  const mapped = sessions.map((session) => {
    const rawResumeId =
      typeof session.resumeId === "object" && session.resumeId?._id
        ? session.resumeId._id
        : session.resumeId;

    const resumeData = rawResumeId ? resumeCache[rawResumeId] : null;
    const isValidResume = resumeData && !resumeData.isDeleted;

    return {
      ...session,

      resumeId: isValidResume
        ? {
            _id: rawResumeId,
            title: resumeData.title,
          }
        : null,

      resumeName: isValidResume
        ? resumeData.title
        : session.selectedResumeName || "Deleted Resume",

      resumePreviewUrl: isValidResume
        ? `${baseUrl}/api/resume/view/${rawResumeId}`
        : null,

      resumeDownloadUrl: isValidResume
        ? `${baseUrl}/api/resume/download/${rawResumeId}`
        : null,
    };
  });

  return {
    data: mapped,
    page: safePage,
    total,
    totalPages,
  };
};

/* ================= UPDATE ================= */
const updateSession = async ({ sessionId, userId, update }) => {
  const sessionRef = db.collection("sessions").doc(sessionId);
  const doc = await sessionRef.get();

  if (!doc.exists) {
    throw new Error("Session not found");
  }

  if (doc.data().owner !== userId) {
    throw new Error("Not authorized to update this session");
  }

  const allowed = [
    "title",
    "company",
    "position",
    "jobDescription",
    "selectedResumeName",
    "resumeId",
    "resumePreviewUrl",
    "resumeUrl",
    "skills",
    "location",
    "timezone",
    "scheduledAt",
    "meetingLink",
    "language",
    "aiModel",
    "simpleEnglish",
    "extraContext",
    "saveTranscript",
    "shareAudio",
    "connectionMethod",
    "autoExtend",
    "trial",
    "creditsUsed",
    "durationMinutes",
    "status",
    "startAt",
    "endAt",
  ];

  const filteredUpdate = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  allowed.forEach((key) => {
    if (update[key] !== undefined) {
      if (["scheduledAt", "startAt", "endAt"].includes(key) && update[key]) {
        filteredUpdate[key] = admin.firestore.Timestamp.fromDate(
          new Date(update[key])
        );
      } else {
        filteredUpdate[key] = update[key];
      }
    }
  });

  const batch = db.batch();

  batch.update(sessionRef, filteredUpdate);
  touchSessionListVersion(userId, batch);

  await batch.commit();

  const updatedDoc = await sessionRef.get();
  return mapSessionDoc(updatedDoc);
};

/* ================= START / CONNECT SESSION ================= */
const startSession = async ({ sessionId, userId, options = {} }) => {
  const sessionRef = db.collection("sessions").doc(sessionId);
  const userRef = db.collection("users").doc(userId);

  const minRequired = 0.5;
  let updatedUser = null;

  await db.runTransaction(async (transaction) => {
    const sessionDoc = await transaction.get(sessionRef);

    if (!sessionDoc.exists) {
      throw new Error("Session not found");
    }

    const sessionData = sessionDoc.data();

    if (sessionData.owner !== userId) {
      throw new Error("Not authorized to start this session");
    }

    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error("User not found");
    }

    const userData = userDoc.data();
    const currentCredits = Number(userData.credits || 0);

    if (currentCredits < minRequired) {
      throw new Error("Insufficient credits to start session");
    }

    transaction.update(userRef, {
      credits: admin.firestore.FieldValue.increment(-minRequired),
    });

    updatedUser = {
      ...mapUserDoc(userDoc),
      credits: currentCredits - minRequired,
    };

    const sessionUpdate = {
      status: "active",
      creditsUsed: Number(sessionData.creditsUsed || 0) + minRequired,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (sessionData.startAt) {
      sessionUpdate.startAt = sessionData.startAt;
    } else {
      sessionUpdate.startAt = admin.firestore.FieldValue.serverTimestamp();
    }

    if (options.shareAudio !== undefined) {
      sessionUpdate.shareAudio = options.shareAudio;
    }

    if (options.connectionMethod) {
      sessionUpdate.connectionMethod = options.connectionMethod;
    }

    if (options.meetingLink) {
      sessionUpdate.meetingLink = options.meetingLink;
    }

    if (options.language) {
      sessionUpdate.language = options.language;
    }

    if (options.aiModel) {
      sessionUpdate.aiModel = options.aiModel;
    }

    transaction.update(sessionRef, sessionUpdate);
    touchSessionListVersion(userId, transaction);
  });

  const finalSessionDoc = await sessionRef.get();

  return {
    session: mapSessionDoc(finalSessionDoc),
    user: updatedUser,
  };
};

/* ================= END SESSION ================= */
const endSession = async ({ sessionId, userId, endAt }) => {
  const sessionRef = db.collection("sessions").doc(sessionId);
  const userRef = db.collection("users").doc(userId);

  let creditsDeducted = 0;
  let updatedUser = null;

  await db.runTransaction(async (transaction) => {
    const sessionDoc = await transaction.get(sessionRef);

    if (!sessionDoc.exists) {
      throw new Error("Session not found");
    }

    const sessionData = sessionDoc.data();

    if (sessionData.owner !== userId) {
      throw new Error("Not authorized to end this session");
    }

    if (!sessionData.startAt) {
      throw new Error("Session has not been started");
    }

    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error("User not found");
    }

    const userData = userDoc.data();
    const currentCredits = Number(userData.credits || 0);

    const startAtDate =
      typeof sessionData.startAt.toDate === "function"
        ? sessionData.startAt.toDate()
        : new Date(sessionData.startAt);

    const finishedAt = endAt ? new Date(endAt) : new Date();

    const durationMs = finishedAt.getTime() - startAtDate.getTime();
    const durationMinutes = Math.max(1, Math.ceil(durationMs / 60000));

    const planned = Number(sessionData.durationMinutes || 30);
    const totalCreditsRequired = durationMinutes > planned ? 1 : 0.5;
    const alreadyCharged = Number(sessionData.creditsUsed || 0);

    creditsDeducted = Math.max(0, totalCreditsRequired - alreadyCharged);

    if (creditsDeducted > 0 && currentCredits < creditsDeducted) {
      throw new Error("Insufficient credits to end session");
    }

    const userUpdate = {
      "interviewStats.sessionsTaken": admin.firestore.FieldValue.increment(1),
    };

    if (creditsDeducted > 0) {
      userUpdate.credits = admin.firestore.FieldValue.increment(
        -creditsDeducted
      );
    }

    transaction.update(userRef, userUpdate);

    updatedUser = {
      ...mapUserDoc(userDoc),
      credits: currentCredits - creditsDeducted,
      interviewStats: {
        ...(userData.interviewStats || {}),
        sessionsTaken: Number(userData.interviewStats?.sessionsTaken || 0) + 1,
      },
    };

    const exceededPlanned = durationMinutes > planned;
    const finalStatus =
      exceededPlanned && sessionData.autoExtend === false
        ? "expired"
        : "completed";

    transaction.update(sessionRef, {
      endAt: admin.firestore.Timestamp.fromDate(finishedAt),
      actualDurationMinutes: durationMinutes,
      creditsUsed: alreadyCharged + creditsDeducted,
      status: finalStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    touchSessionListVersion(userId, transaction);
  });

  const finalSessionDoc = await sessionRef.get();

  return {
    session: mapSessionDoc(finalSessionDoc),
    creditsDeducted,
    user: updatedUser,
  };
};

/* ================= DELETE ================= */
const deleteSession = async ({ sessionId, userId }) => {
  const sessionRef = db.collection("sessions").doc(sessionId);
  const doc = await sessionRef.get();

  if (!doc.exists) {
    throw new Error("Session not found");
  }

  if (doc.data().owner !== userId) {
    throw new Error("Not authorized to delete this session");
  }

  const batch = db.batch();

  batch.delete(sessionRef);
  touchSessionListVersion(userId, batch);

  await batch.commit();

  return {
    success: true,
    deletedId: sessionId,
  };
};

/* ================= DUPLICATE ================= */
const duplicateSession = async ({ sessionId, userId }) => {
  const doc = await db.collection("sessions").doc(sessionId).get();

  if (!doc.exists) {
    throw new Error("Session not found");
  }

  const originalData = doc.data();

  if (originalData.owner !== userId) {
    throw new Error("Not authorized to duplicate this session");
  }

  const duplicatedData = {
    ...originalData,
    status: "draft",
    startAt: null,
    endAt: null,
    creditsUsed: 0,
    actualDurationMinutes: null,
    title: `${originalData.title || "Session"} (Copy)`,
  };

  delete duplicatedData.createdAt;
  delete duplicatedData.updatedAt;

  const newSessionRef = db.collection("sessions").doc();
  const formattedData = formatSessionData(duplicatedData);

  const batch = db.batch();

  batch.set(newSessionRef, formattedData);
  touchSessionListVersion(userId, batch);

  await batch.commit();

  const freshDoc = await newSessionRef.get();
  return mapSessionDoc(freshDoc);
};

export default {
  createSession,
  getSessionById,
  listSessionsForUser,
  updateSession,
  startSession,
  endSession,
  deleteSession,
  duplicateSession,
};
