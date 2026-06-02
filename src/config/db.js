import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import fs from "fs";

const localKeyUrl = new URL("../../key.json", import.meta.url);

function parseServiceAccount(json, source) {
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`Invalid Firebase service account JSON in ${source}. ${error.message}`);
  }
}

function getCredential() {
  if (process.env.GCS_KEY) {
    return admin.credential.cert(parseServiceAccount(process.env.GCS_KEY, "GCS_KEY"));
  }

  if (fs.existsSync(localKeyUrl)) {
    const serviceAccount = parseServiceAccount(fs.readFileSync(localKeyUrl, "utf8"), "key.json");
    return admin.credential.cert(serviceAccount);
  }

  return admin.credential.applicationDefault();
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: getCredential(),
    storageBucket: process.env.GCS_BUCKET,
  });
}

const db = getFirestore();

// Use the environment variable here as well
const bucket = getStorage().bucket(process.env.GCS_BUCKET);

export { db, bucket };
export default db;
