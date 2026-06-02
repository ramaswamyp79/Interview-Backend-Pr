import db from "../src/config/firebase.js";

const fixSessionOwnerField = async () => {
  const snapshot = await db.collection("sessions").get();

  for (const doc of snapshot.docs) {
    const session = doc.data();

    // Only fix broken owner field
    if (session.owner?.buffer) {
      console.log("🔧 Fixing session:", doc.id);

      let resumeSnap = null;

      // Step 1: Try fetching resume by resumeId if it exists
      if (session.resumeId) {
        resumeSnap = await db.collection("resumes").doc(session.resumeId).get();
      }

      // Step 1b: fallback to matching by resumeUrl / resumePath
      if (!resumeSnap || !resumeSnap.exists) {
        const resumeQuery = await db
          .collection("resumes")
          .where("resumePath", "==", session.resumeUrl)
          .limit(1)
          .get();

        if (!resumeQuery.empty) {
          resumeSnap = resumeQuery.docs[0];
        }
      }

      if (!resumeSnap || !resumeSnap.exists) {
        console.log("❌ Resume not found for session:", doc.id, "resumeUrl:", session.resumeUrl);
        continue;
      }

      const resume = resumeSnap.data();

      // Step 2: Lookup user by resume email
      const userSnap = await db
        .collection("users")
        .where("email", "==", resume.email)
        .limit(1)
        .get();

      if (userSnap.empty) {
        console.log("❌ No user found for email:", resume.email);
        continue;
      }

      const user = userSnap.docs[0].data();

      // Step 3: Update session in Firestore
      await doc.ref.update({
        owner: user.id,
        resumeId: resumeSnap.id,
      });

      console.log("✅ Updated session owner & resumeId:", doc.id);
    }
  }

  console.log("🎉 All sessions fixed");
};

fixSessionOwnerField();