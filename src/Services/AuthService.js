import bcrypt from "bcryptjs";
import crypto from "crypto";
import admin from "firebase-admin";
import db from "../config/db.js"; // Adjust path to your new Firebase db file
import { formatUserData, mapUserDoc } from "../Model/User.js";
import { sendOtpEmail } from "../utils/sendEmail.js";

// Helper function to find a user by email in Firestore
const getUserByEmail = async (email) => {
  const snapshot = await db.collection("users").where("email", "==", email.toLowerCase().trim()).limit(1).get();
  if (snapshot.empty) return null;
  return mapUserDoc(snapshot.docs[0]);
};

const registerUser = async (data) => {
  const existingUser = await getUserByEmail(data.email);
  if (existingUser) {
    throw new Error("Email already registered");
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);
  
  // 1. Generate a new document reference (this creates the ID automatically)
  const userRef = db.collection("users").doc();
  
  // 2. Format the data using our new "Model" function
  const userData = formatUserData({
    fullName: data.fullName,
    email: data.email,
    password: hashedPassword,
    role: data.role || "Job Seeker",
    authProvider: "local",
  });

  // 3. Save to Firestore
  await userRef.set(userData);

  return { _id: userRef.id, ...userData };
};

const loginUser = async (email, password) => {
  const user = await getUserByEmail(email);

  if (!user) {
    throw new Error("Invalid credentials");
  }

  if (!user.password) {
    throw new Error("Please login using Google or reset password");
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  return user;
};

const normalizeProvider = (provider) => {
  if (!provider) return "local";
  const p = provider.toLowerCase();

  if (p.includes("google")) return "google";
  if (p.includes("github")) return "github";
  if (p.includes("linkedin")) return "linkedin";
  if (p.includes("windowslive") || p.includes("microsoft")) return "microsoft";

  return "local";
};

const socialLogin = async ({ email, name, provider, providerId }) => {
  if (!email) {
    throw new Error("Email is required for social login");
  }

  const authProvider = normalizeProvider(provider);
  let user = await getUserByEmail(email);

  // 🔹 First-time social login
  if (!user) {
    console.log("Creating user with provider:", authProvider);
    const userRef = db.collection("users").doc();
    
    const userData = formatUserData({
      email,
      fullName: name || email.split("@")[0],
      role: "Job Seeker",
      authProvider,
      authProviderId: providerId,
    });

    await userRef.set(userData);
    return { _id: userRef.id, ...userData };
  }

  // 🔹 Existing user but provider not set (edge case)
  if (!user.authProvider || user.authProvider === "local") {
    await db.collection("users").doc(user._id).update({
      authProvider,
      authProviderId: providerId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    user.authProvider = authProvider;
    user.authProviderId = providerId;
  }

  return user;
};

export const changePassword = async (userId, newPassword) => {
  const userRef = db.collection("users").doc(userId);
  const doc = await userRef.get();
  
  if (!doc.exists) throw new Error("User not found");

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Firestore specific: updating specific fields
  await userRef.update({
    password: hashedPassword,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
};

export const forgotPassword = async (email) => {
  const user = await getUserByEmail(email);

  if (!user) {
    throw new Error("User not found");
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  
  // Store expiry as a timestamp number (milliseconds) for easy math
  const expiry = Date.now() + 10 * 60 * 1000; // 10 min

  await db.collection("users").doc(user._id).update({
    resetOtp: otp,
    resetOtpExpiry: expiry,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await sendOtpEmail(email, otp);
};

export const resetPasswordWithOtp = async (email, otp, newPassword) => {
  const user = await getUserByEmail(email);

  // Validate user, OTP, and expiry
  if (!user || user.resetOtp !== otp || Date.now() > user.resetOtpExpiry) {
    throw new Error("Invalid or expired OTP");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password and clear OTP fields using FieldValue.delete()
  await db.collection("users").doc(user._id).update({
    password: hashedPassword,
    authProvider: "local",
    authProviderId: admin.firestore.FieldValue.delete(), // removes field from document
    resetOtp: admin.firestore.FieldValue.delete(),
    resetOtpExpiry: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
};

const authService = {
  registerUser,
  loginUser,
  socialLogin,
  changePassword,
  forgotPassword,
  resetPasswordWithOtp,
};

export default authService;