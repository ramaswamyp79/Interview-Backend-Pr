import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import "dotenv/config";
import fs from "fs";

const localKeyUrl = new URL("../../key.json", import.meta.url);

function maskEmail(email) {
  if (!email || typeof email !== "string") return email;
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
}

function traceCredential(source, serviceAccount) {
  console.log("[firebase-trace] credential source", {
    source,
    projectId: serviceAccount?.project_id,
    clientEmail: maskEmail(serviceAccount?.client_email),
    hasPrivateKey: Boolean(serviceAccount?.private_key),
    storageBucket: process.env.GCS_BUCKET,
  });
}

function parseServiceAccount(json, source) {
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`Invalid Firebase service account JSON in ${source}. ${error.message}`);
  }
}

function getCredential() {
  if (fs.existsSync(localKeyUrl)) {
    const serviceAccount = parseServiceAccount(fs.readFileSync(localKeyUrl, "utf8"), "key.json");
    traceCredential("key.json", serviceAccount);
    return admin.credential.cert(serviceAccount);
  }

  console.log("[firebase-trace] credential source", {
    source: "applicationDefault",
    storageBucket: process.env.GCS_BUCKET,
  });
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
