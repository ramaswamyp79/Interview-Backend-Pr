import admin from "firebase-admin";
import db from "../config/db.js"; 

/**
 * Helper function to map the Firestore doc and remove sensitive fields
 */
const mapSafeUser = (doc) => {
  const data = doc.data();
  delete data.password; 
  delete data.resetOtp;
  delete data.resetOtpExpiry;
  return { _id: doc.id, ...data };
};

/**
 * Get user profile by ID
 * 🔥 Added `preFetchedDoc` parameter to prevent double-querying
 */
export const getUserById = async (userId, preFetchedDoc = null) => {
  const userDoc = preFetchedDoc || await db.collection("users").doc(userId).get();

  if (!userDoc.exists) {
    throw new Error("User not found");
  }

  return mapSafeUser(userDoc);
};

/**
 * Update user profile
 */
export const updateUserById = async (userId, updateData) => {
  const allowedUpdates = [
    "fullName",
    "role",
    "resumeUrl",
    "onboardingCompleted",
  ];

  const filteredData = {};
  allowedUpdates.forEach((key) => {
    if (updateData[key] !== undefined) {
      filteredData[key] = updateData[key];
    }
  });

  // If there are no valid updates, just return the current user
  if (Object.keys(filteredData).length === 0) {
    return await getUserById(userId);
  }

  // Always update the timestamp
  filteredData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  const userRef = db.collection("users").doc(userId);

  try {
    // Perform the update
    await userRef.update(filteredData);
  } catch (error) {
    // Firestore throws a specific error if you try to update a document that doesn't exist
    if (error.code === 5) { // 5 is the gRPC NOT_FOUND code
      throw new Error("User not found");
    }
    throw error;
  }

  // Fetch and return the newly updated document
  const updatedDoc = await userRef.get();
  return mapSafeUser(updatedDoc);
};

/**
 * Get user credits
 * 🔥 Added `preFetchedDoc` parameter to prevent double-querying
 */
export const getUserCredits = async (userId, preFetchedDoc = null) => {
  const userDoc = preFetchedDoc || await db.collection("users").doc(userId).get();

  if (!userDoc.exists) {
    throw new Error("User not found");
  }

  const userData = userDoc.data();

  return {
    // Fallback to 0 just in case the field is missing
    credits: userData.credits || 0,
  };
};