import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import "./db.js";

const db = getFirestore(admin.app(), "answerflow-ai");

export default db;
