import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import db from "../src/config/db.js";

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
