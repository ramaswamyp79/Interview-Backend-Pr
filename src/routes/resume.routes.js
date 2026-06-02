import express from "express";
import auth from "../middleware/auth.middleware.js";
import * as resumeController from "../controllers/resume.controller.js";

const router = express.Router();

/**
 * ✅ Apply auth globally
 */
router.use(auth);

/* ================= NON-CACHE ================= */

// Create resume
router.post("/", resumeController.createResume);

// Download (should NOT be cached)
router.get("/download/:id", resumeController.downloadResume);

// Delete resume
router.delete("/:id", resumeController.deleteResume);

/* ================= CACHEABLE ================= */

// List resumes (pagination)
router.get(
  "/",
  resumeController.getResumes
);

// View resume (signed URL - short cache)
router.get(
  "/view/:id",
  resumeController.viewResume
);

export default router;