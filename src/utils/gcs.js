import admin from "firebase-admin";
import db from "../config/db.js"; // This ensures Firebase is initialized BEFORE we call storage

export const bucketName = process.env.GCS_BUCKET;

// We use Firebase Admin's built-in storage instead of a separate Google Cloud instance.
// This completely bypasses the file-path resolution error because Firebase is already authenticated!
export const bucket = admin.storage().bucket(bucketName);