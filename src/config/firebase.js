import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync(new URL("./gcs-key.json", import.meta.url))
);

// Prevent re-initializing if the app is already running
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Using getFirestore fixes the "firestore is not a function" error
const db = getFirestore("answerflow-ai"); 

export default db;