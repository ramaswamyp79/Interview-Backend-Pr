import db from './firebase.js'; 
import fs from "fs";

async function auditDatabase() {
  const collections = ["users", "resumes", "payments", "sessions"];
  let report = `--- Database Audit: answerflow-ai ---\n`;
  report += `Date: ${new Date().toLocaleString()}\n\n`;

  console.log("🔍 Starting database audit...");

  for (const colName of collections) {
    try {
      // This will now work because 'db' is correctly initialized
      const snapshot = await db.collection(colName).get();
      const count = snapshot.size;

      report += `Collection: ${colName}\n`;
      report += `Total Documents: ${count}\n`;

      if (count > 0) {
        report += `Sample Document IDs:\n`;
        snapshot.docs.slice(0, 3).forEach(doc => {
          report += `  - ${doc.id}\n`;
        });
      } else {
        report += `  (No data found in this collection)\n`;
      }

      report += `------------------------------\n`;
      console.log(`✅ Checked ${colName}: ${count} docs`);
    } catch (error) {
      report += `Collection: ${colName} -> ERROR: ${error.message}\n`;
      report += `------------------------------\n`;
      console.error(`❌ Error in ${colName}:`, error.message);
    }
  }

  fs.writeFileSync("db_audit.txt", report);
  console.log("\n⭐ Audit complete! Check: db_audit.txt");
}

auditDatabase().catch(console.error);