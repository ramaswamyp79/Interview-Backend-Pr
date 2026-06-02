import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

import mongoose from "mongoose";
import db from "../src/config/firebase.js"; // Firebase admin Firestore instance

console.log("MONGO_URI:", process.env.MONGO_URI);

// 🔌 Connect MongoDB
await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");

// 🔧 Helper: Clean undefined values (Firestore doesn't allow undefined)
const cleanData = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

// 🔧 Helper: Convert ObjectId → string recursively
const convertObjectIds = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(convertObjectIds);
  } else if (obj !== null && typeof obj === "object") {
    const newObj = {};
    for (const key in obj) {
      const value = obj[key];

      if (value && value._bsontype === "ObjectID") {
        newObj[key] = value.toString();
      } else {
        newObj[key] = convertObjectIds(value);
      }
    }
    return newObj;
  }
  return obj;
};

// 🚀 MAIN MIGRATION FUNCTION
const migrateAllCollections = async () => {
  try {
    // 1️⃣ Get all collections
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();

    console.log(`📦 Found ${collections.length} collections`);

    // 2️⃣ Loop collections
    for (const col of collections) {
      const collectionName = col.name;

      // ❗ Skip system collections
      if (collectionName.startsWith("system.")) continue;

      console.log(`\n🚀 Migrating collection: ${collectionName}`);

      const mongoCollection =
        mongoose.connection.db.collection(collectionName);

      const documents = await mongoCollection.find({}).toArray();

      console.log(`📄 Total documents: ${documents.length}`);

      // 🔥 Batch write (Firestore limit = 500)
      const chunkSize = 400;

      for (let i = 0; i < documents.length; i += chunkSize) {
        const chunk = documents.slice(i, i + chunkSize);

        const batch = db.batch();

        for (const doc of chunk) {
          const { _id, ...data } = doc;

          // ✅ Clean + convert
          const cleanedData = cleanData(convertObjectIds(data));

          const ref = db
            .collection(collectionName)
            .doc(_id.toString());

          batch.set(ref, {
            id: _id.toString(),
            ...cleanedData,
            createdAt: doc.createdAt || new Date(),
            updatedAt: doc.updatedAt || new Date(),
          });
        }

        await batch.commit();
        console.log(
          `✅ Batch migrated: ${i + chunk.length}/${documents.length}`
        );
      }

      console.log(`🎉 Collection "${collectionName}" migrated`);
    }

    console.log("\n🎉🎉 ALL COLLECTIONS MIGRATED SUCCESSFULLY");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
};

// ▶️ Run
migrateAllCollections();