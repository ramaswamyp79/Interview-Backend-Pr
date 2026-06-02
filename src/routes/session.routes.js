import express from "express";
import auth from "../middleware/auth.middleware.js";
import * as sessionController from "../controllers/session.controller.js";

const router = express.Router();

/**
 * ✅ Apply auth to ALL routes
 */
router.use(auth);

/* ================= NON-CACHE (WRITE OPERATIONS) ================= */

// Create session
router.post("/", sessionController.createSession);

// Update session
router.put("/:id", sessionController.updateSession);

// Delete session
router.delete("/:id", sessionController.deleteSession);

// Start / Connect session
router.post("/:id/connect", sessionController.startSession);

// End session
router.post("/:id/end", sessionController.endSession);

// Duplicate session
router.post("/:id/duplicate", sessionController.duplicateSession);

/* ================= CACHEABLE (READ OPERATIONS) ================= */

// List sessions (with pagination)
router.get(
  "/",
  sessionController.listMySessions
);

// Get single session
router.get(
  "/:id",
  sessionController.getSession
);

export default router;