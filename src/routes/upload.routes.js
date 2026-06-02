import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import os from "os";
import crypto from "crypto";

import { bucket } from "../utils/gcs.js";
import textUtils from "../utils/textUtils.js";
import { parseResumeWithGemini } from "../utils/geminiResumeParser.js";

// 👇 FIREBASE IMPORTS
import { formatResumeData } from "../Model/Resume.js";
import db from "../config/db.js";
import admin from "firebase-admin";

import auth from "../middleware/auth.middleware.js";
import libre from "libreoffice-convert";
import util from "util";
import { convertToPdf } from "../utils/convertToPdf.js";

const libreConvert = util.promisify(libre.convert);
const BASE_URL = process.env.BACKEND_URL;

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post("/upload-resume", auth, upload.single("resume"), async (req, res) => {
  const requestId = crypto.randomUUID();
  const tempFiles = [];
  const startTime = Date.now();

  const logStep = (step, message) => {
    console.log(`[${requestId}] ✅ ${step} completed — ${message}`);
  };

  const logTime = (label, start) => {
    console.log(`[${requestId}] ⏱ ${label}: ${Date.now() - start}ms`);
  };

  try {
    const stepStart = Date.now();

    const { file } = req;
    const { title } = req.body;
    const userId = req.user._id || req.user.id;
    const email = req.user.email;

    if (!file)
      return res.status(400).json({ success: false, message: "Resume file is required" });

    console.log(`[${requestId}] 🚀 Upload started for user ${userId}`);

    /* ===============================
       STEP 1: Determine version (INDEX BYPASS IN JAVASCRIPT)
    =============================== */
    const t1 = Date.now();

    // Fetch ALL resumes for this user (only uses 1 basic index, which is allowed)
    const userResumesSnapshot = await db.collection("resumes")
      .where("user", "==", userId)
      .get();

    let lastVersion = 0;
    const targetTitle = title || file.originalname;

    if (!userResumesSnapshot.empty) {
      // Filter by title in JavaScript to avoid composite index error
      const matchingResumes = userResumesSnapshot.docs.filter(
        (doc) => doc.data().title === targetTitle
      );

      if (matchingResumes.length > 0) {
        // Sort descending by version in JavaScript
        matchingResumes.sort((a, b) => {
          const versionA = Number(a.data().version || 0);
          const versionB = Number(b.data().version || 0);
          return versionB - versionA;
        });

        lastVersion = Number(matchingResumes[0].data().version || 0);
      }
    }

    const version = lastVersion + 1;

    logStep("STEP 1", `Version determined: v${version}`);
    logTime("STEP 1 duration", t1);

    /* ===============================
       STEP 2: Upload original resume
    =============================== */
    const t2 = Date.now();

    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
    const baseName = `${Date.now()}-v${version}-${cleanName}`;
    const resumePath = `resumes/uploaded/${baseName}`;

    // Upload ORIGINAL file (doc/docx/pdf)
    await bucket.file(resumePath).save(file.buffer, {
      contentType: file.mimetype,
      resumable: false,
    });

    let previewPdfPath = resumePath; // default (for PDF uploads)

    // Detect DOC/DOCX safely
    const isDoc =
      file.originalname.toLowerCase().endsWith(".doc") ||
      file.originalname.toLowerCase().endsWith(".docx");

    if (isDoc) {
      console.log(`[${requestId}] 🔄 Converting DOC to PDF (CloudConvert)`);

      try {
        // ⏱ Add timeout protection
        const pdfBuffer = await Promise.race([
          convertToPdf(file.buffer),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Conversion timeout")), 10000)
          ),
        ]);

        const pdfName = baseName.replace(path.extname(baseName), ".pdf");
        previewPdfPath = `resumes/preview/${pdfName}`;

        await bucket.file(previewPdfPath).save(pdfBuffer, {
          contentType: "application/pdf",
          resumable: false,
        });

        console.log(`[${requestId}] ✅ DOC converted & PDF uploaded`);
      } catch (err) {
        console.error(`[${requestId}] ❌ CloudConvert failed`, err);

        // 🔥 CRITICAL fallback
        previewPdfPath = resumePath;
      }
    }

    logStep("STEP 2", `Original uploaded → ${resumePath}`);
    logTime("STEP 2 duration", t2);

    /* ===============================
       STEP 3: Extract text
    =============================== */
    const t3 = Date.now();

    const tempResumePath = path.join(os.tmpdir(), baseName);
    await fs.writeFile(tempResumePath, file.buffer);
    tempFiles.push(tempResumePath);

    const extractedText = await textUtils.extractText(tempResumePath);
    // DEBUG: log final extracted text
    const debugPath = path.join(os.tmpdir(), `DEBUG_${baseName}.txt`);
    await fs.writeFile(debugPath, extractedText);

    logStep("STEP 3", `Text extracted (${extractedText.length} chars)`);
    logTime("STEP 3 duration", t3);

    /* ===============================
       STEP 4: Upload extracted text
    =============================== */
    const t4 = Date.now();

    const txtName = baseName.replace(path.extname(baseName), ".txt");
    const txtTemp = path.join(os.tmpdir(), txtName);
    await fs.writeFile(txtTemp, extractedText);
    tempFiles.push(txtTemp);

    const textPath = `resumes/processed/${txtName}`;
    await bucket.upload(txtTemp, {
      destination: textPath,
      metadata: { contentType: "text/plain" },
    });

    logStep("STEP 4", `Extracted text uploaded → ${textPath}`);
    logTime("STEP 4 duration", t4);

    /* ===============================
       STEP 5: Parse resume JSON
    =============================== */
    const t5 = Date.now();

    let parsedData = null;
    try {
      parsedData = await parseResumeWithGemini(extractedText);
      logStep("STEP 5", "Resume parsed successfully");
    } catch (err) {
      console.warn(`[${requestId}] ⚠ Parsing failed: ${err.message}`);
    }

    const jsonName = baseName.replace(path.extname(baseName), ".json");
    const jsonTemp = path.join(os.tmpdir(), jsonName);
    await fs.writeFile(jsonTemp, JSON.stringify(parsedData || {}, null, 2));
    tempFiles.push(jsonTemp);

    const jsonPath = `resumes/extracted/${jsonName}`;
    await bucket.upload(jsonTemp, {
      destination: jsonPath,
      metadata: { contentType: "application/json" },
    });

    logStep("STEP 5", `JSON uploaded → ${jsonPath}`);
    logTime("STEP 5 duration", t5);

    /* ===============================
       STEP 6: Update default resume (INDEX BYPASS IN JAVASCRIPT)
    =============================== */
    const t6 = Date.now();

    if (!userResumesSnapshot.empty) {
      // Filter by isDefault in JavaScript to avoid composite index error
      const defaultDocs = userResumesSnapshot.docs.filter(
        (doc) => doc.data().isDefault === true
      );

      if (defaultDocs.length > 0) {
        const batch = db.batch();
        defaultDocs.forEach((doc) => {
          batch.update(doc.ref, {
            isDefault: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        await batch.commit();
      }
    }

    logStep("STEP 6", "Previous resumes marked non-default");
    logTime("STEP 6 duration", t6);

    /* ===============================
       STEP 7: Save to DB (FIREBASE WAY)
    =============================== */
    const t7 = Date.now();

    const resumeRef = db.collection("resumes").doc();
    const resumeData = formatResumeData({
      user: userId,
      email,
      title: title || file.originalname,
      version,
      resumePath,
      previewPdfPath,
      textPath,
      jsonPath,
      parsedData,
      isDefault: true,
    });

    await resumeRef.set(resumeData);

    // Create an object that mimics Mongoose's response for the frontend
    const resumeDoc = { _id: resumeRef.id, ...resumeData };

    logStep("STEP 7", `Resume saved with ID ${resumeDoc._id}`);
    logTime("STEP 7 duration", t7);

    /* ===============================
       STEP 8: Response
    =============================== */
    logStep("STEP 8", "Response sent to client");
    logTime("TOTAL PROCESS TIME", startTime);

    const displayTitle =
      resumeDoc.version > 1
        ? `${resumeDoc.title} (v${resumeDoc.version})`
        : resumeDoc.title;

    return res.status(201).json({
      success: true,
      message: "Resume uploaded & processed successfully",
      resume: {
        _id: resumeDoc._id,
        title: displayTitle,
        originalTitle: resumeDoc.title,
        version: resumeDoc.version,
        isDefault: resumeDoc.isDefault,
        previewUrl: `${BASE_URL}/api/resume/view/${resumeDoc._id}`,
        downloadUrl: `${BASE_URL}/api/resume/download/${resumeDoc._id}`,
      },
    });
  } catch (error) {
    console.error(`[${requestId}] ❌ Upload failed`, error);
    return res.status(500).json({
      success: false,
      message: "Resume processing failed",
    });
  } finally {
    /* ===============================
       STEP 9: Cleanup temp files
    =============================== */
    await Promise.all(tempFiles.map((f) => fs.unlink(f).catch(() => { })));
    console.log(`[${requestId}] 🧹 Temporary files cleaned`);
  }
});

export default router;