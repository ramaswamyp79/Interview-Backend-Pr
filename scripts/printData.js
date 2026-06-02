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

// 👇 Changed the file name so it doesn't overwrite your previous data
const logStream = fs.createWriteStream("payments_results.txt", { flags: "w" });

const logToFile = (message) => {
  logStream.write(message + "\n");
};

const printAllFromCollection = async (collectionName) => {
  logToFile(`\n========== FETCHING ALL: ${collectionName.toUpperCase()} ==========`);

  const snapshot = await db.collection(collectionName).get();

  if (snapshot.empty) {
    logToFile(`No documents found in ${collectionName}.`);
    return;
  }

  snapshot.forEach((doc) => {
    logToFile(`\n--- ${collectionName} ID: ${doc.id} ---`);
    logToFile(JSON.stringify(doc.data(), null, 2));
  });

  logToFile(`\n========== Total ${collectionName}: ${snapshot.size} ==========\n`);
};

// 4. Execution Flow
const runPrint = async () => {
  try {
    console.log("Fetching ONLY payments data and writing to payments_results.txt... Please wait.");

    // 👇 Commented out the other collections so it only grabs payments!
    // await printAllFromCollection("users");
    // await printAllFromCollection("resumes");
    // await printAllFromCollection("sessions");

    await printAllFromCollection("payments");

    console.log("🎉 Success! Open 'payments_results.txt' in your editor to see your data.");

    // Wait a brief moment to ensure the write stream finishes before exiting
    logStream.end(() => {
      process.exit(0);
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    logStream.end();
    process.exit(1);
  }
};

runPrint();