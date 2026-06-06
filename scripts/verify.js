import dotenv from "dotenv";
dotenv.config();

import db from "../src/config/db.js";

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
