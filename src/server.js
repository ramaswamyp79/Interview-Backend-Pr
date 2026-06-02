import "dotenv/config";

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";

// 👇 We removed the old connectDB import here!

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import sessionRoutes from "./routes/session.routes.js";
import resumeRoutes from "./routes/resume.routes.js";
import uploadRoutes from "./routes/upload.routes.js";

import * as paymentController from "./controllers/payment.controller.js";

const app = express();

/* ================= SECURITY ================= */

// Secure headers
app.use(helmet());

// Compression (🔥 BIG performance boost)
app.use(compression());

/* ================= RATE LIMIT ================= */

// Global limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300, // limit per IP
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

/* ================= CORS ================= */

const allowedOrigins = [
  "http://localhost:5173",
  "https://34.54.116.200.nip.io",
  "https://interview-user.onrender.com",
   process.env.CLIENT_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

/* ================= BODY PARSER ================= */

// Stripe webhook MUST come BEFORE json parser
app.post(
  "/api/webhook/stripe",
  express.raw({ type: "application/json" }),
  paymentController.stripeWebhook
);

// Limit payload size (🔥 prevents abuse)
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

/* ================= ROUTES ================= */

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/upload", uploadRoutes);

/* ================= HEALTH ================= */

app.get("/api/test", (req, res) => {
  res.json({ msg: "Backend is alive!" });
});

/* ================= GLOBAL ERROR HANDLER ================= */

app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.message);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
