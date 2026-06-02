import dotenv from "dotenv";
dotenv.config();

import admin from "firebase-admin";
import fs from "fs";

// 1. Initialize Firebase
const serviceAccount = JSON.parse(
  fs.readFileSync(new URL("../src/config/gcs-key.json", import.meta.url))
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 2. Verification Function
const checkCollection = async (collectionName, expectedCount) => {
  const snapshot = await db.collection(collectionName).count().get();
  const actualCount = snapshot.data().count;
  
  if (actualCount === expectedCount) {
    console.log(`✅ ${collectionName}: Match! (${actualCount} documents)`);
  } else {
    console.log(`❌ ${collectionName}: Mismatch. Expected ${expectedCount}, got ${actualCount}`);
  }
};

const runVerification = async () => {
  console.log("Checking Firestore Document Counts...\n");
  
  // Checking against the numbers your migration script printed
  await checkCollection("users", 35);
  await checkCollection("resumes", 66);
  await checkCollection("sessions", 60);
  await checkCollection("payments", 83);
  
  console.log("\nDone!");
  process.exit(0);
};

runVerification();