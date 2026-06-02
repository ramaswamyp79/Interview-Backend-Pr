import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

// 1. Load your Service Account Key
const serviceAccount = JSON.parse(
  fs.readFileSync(new URL("./gcs-key.json", import.meta.url))
);

// 2. Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// 3. Connect to BOTH databases
// The default database
const defaultDb = getFirestore();
// The new named database (Requires firebase-admin v11.10.0 or higher)
const newDb = getFirestore(admin.app(), "answerflow-ai");

// 4. List the collections you want to migrate
const collectionsToMigrate = [
  "conversation",
  "payments",
  "resumes",
  "sessions",
  "users"
];

// 5. The Migration Function
async function migrateCollection(collectionName) {
  console.log(`\n⏳ Starting migration for: [${collectionName}]...`);

  const sourceRef = defaultDb.collection(collectionName);
  const destRef = newDb.collection(collectionName);

  const snapshot = await sourceRef.get();

  if (snapshot.empty) {
    console.log(`⚠️ No documents found in [${collectionName}]. Skipping.`);
    return;
  }

  // Firestore batches can hold a maximum of 500 operations
  let batch = newDb.batch();
  let count = 0;
  let totalCopied = 0;

  for (const doc of snapshot.docs) {
    // Read from source, prep to write to destination using the exact same Document ID
    batch.set(destRef.doc(doc.id), doc.data());
    count++;
    totalCopied++;

    // Commit the batch every 500 documents
    if (count === 500) {
      await batch.commit();
      console.log(`   Copied ${totalCopied} documents so far...`);
      batch = newDb.batch(); // Create a fresh batch
      count = 0;
    }
  }

  // Commit any remaining documents in the final batch
  if (count > 0) {
    await batch.commit();
  }

  console.log(`✅ Finished migrating [${collectionName}]. Total documents: ${totalCopied}`);
}

// 6. Run the script
async function runMigration() {
  try {
    console.log("🚀 Starting database migration...");

    for (const collection of collectionsToMigrate) {
      await migrateCollection(collection);
    }

    console.log("\n🎉 All collections migrated successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  }
}

// Execute
runMigration();