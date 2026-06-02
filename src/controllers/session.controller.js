import sessionService from "../Services/sessionService.js";
import db from "../config/db.js";
import crypto from "crypto";
import { getSessionListVersion } from "../utils/sessionListVersion.js";

/* ================= CREATE ================= */

export const createSession = async (req, res) => {
  try {
    const session = await sessionService.createSession({
      userId: req.user.id,
      payload: req.body,
    });

    res.json(session);
  } catch (err) {
    console.error("createSession error:", err);
    res.status(500).json({ message: "Failed to create session" });
  }
};

/* ================= GET ONE (CACHEABLE) ================= */

export const getSession = async (req, res) => {
  try {
    const session = await sessionService.getSessionById(req.params.id);

    let updatedStr = "new";
    if (session.updatedAt) {
      updatedStr = typeof session.updatedAt.toDate === 'function'
        ? session.updatedAt.toDate().toISOString()
        : new Date(session.updatedAt).toISOString();
    }

    const etag = crypto
      .createHash("md5")
      .update(updatedStr || JSON.stringify(session))
      .digest("hex");

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    res.set("ETag", etag);
   res.set("Cache-Control", "private, no-cache, must-revalidate");
res.set("Vary", "Authorization");

    res.json(session);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

/* ================= LIST (NATIVE FIREBASE SPEED) ================= */

export const listMySessions = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 6;
    const userId = req.user.id;

    const query = req.query.q || "";
    const company = req.query.company || "";
    const status = req.query.status || "all";
    const sort = req.query.sort || "newest";

    if (!userId) {
      return res.status(400).json({ message: "User ID missing" });
    }

    const version = await getSessionListVersion(userId);

    const etag = `"sessions:${userId}:${page}:${limit}:${query}:${company}:${status}:${sort}:${version}"`;

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    const result = await sessionService.listSessionsForUser(
      userId,
      page,
      limit
    );

    res.set("ETag", etag);
    res.set("Cache-Control", "private, no-cache, must-revalidate");
    res.set("Vary", "Authorization");

    res.json({
      ...result,
      version,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ================= UPDATE ================= */

export const updateSession = async (req, res) => {
  try {
    const updated = await sessionService.updateSession({
      sessionId: req.params.id,
      userId: req.user.id,
      update: req.body,
    });

    res.json(updated);
  } catch (err) {
    console.error("updateSession error:", err);
    res.status(400).json({ message: err.message });
  }
};

/* ================= DELETE ================= */

export const deleteSession = async (req, res) => {
  try {
    await sessionService.deleteSession({
      sessionId: req.params.id,
      userId: req.user.id,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* ================= START SESSION ================= */

export const startSession = async (req, res) => {
  try {
    const result = await sessionService.startSession({
      sessionId: req.params.id,
      userId: req.user.id,
      options: req.body,
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* ================= END SESSION ================= */

export const endSession = async (req, res) => {
  try {
    const { endAt } = req.body || {};

    const result = await sessionService.endSession({
      sessionId: req.params.id,
      userId: req.user.id,
      endAt,
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* ================= DUPLICATE ================= */

export const duplicateSession = async (req, res) => {
  try {
    const session = await sessionService.duplicateSession({
      sessionId: req.params.id,
      userId: req.user.id,
    });

    res.json(session);
  } catch (err) {
    console.error("duplicateSession error:", err);
    res.status(400).json({ message: err.message });
  }
};
