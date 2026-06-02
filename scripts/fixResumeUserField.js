// scripts/fixResumeUserField.js

import db from "../src/config/firebase.js";

const fixResumeUserField = async () => {
  const snapshot = await db.collection("resumes").get();

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // ❌ if broken buffer format
    if (data.user?.buffer) {
      console.log("Fixing:", doc.id);

      // 🔥 IMPORTANT: we use email to map user
      const userSnap = await db
        .collection("users")
        .where("email", "==", data.email)
        .limit(1)
        .get();

      if (userSnap.empty) {
        console.log("❌ No user found for:", data.email);
        continue;
      }

      const user = userSnap.docs[0].data();

      await doc.ref.update({
        user: user.id, // ✅ FIXED
      });

      console.log("✅ Updated:", doc.id);
    }
  }

  console.log("🎉 All resumes fixed");
};

fixResumeUserField();