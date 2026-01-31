import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import * as paymentController from "./controllers/payment.controller.js";

if (process.env.NODE_ENV !== "production") {
  const dotenv = await import("dotenv");
  dotenv.config();
}

// Warn if critical env vars are missing (do not print secrets)
if (!process.env.JWT_SECRET) {
	console.error("Warning: JWT_SECRET is not set. Authentication will fail until configured.");
} else {
	console.log("JWT_SECRET loaded");
}

const app = express();
connectDB();
const CLIENT_ORIGIN_HC = "https://34.149.156.4.nip.io,http://localhost:5173";
const CLIENT_ORIGIN_tmp =
  process.env.CLIENT_ORIGINS || CLIENT_ORIGIN_HC;

const allowedOrigins = CLIENT_ORIGIN_tmp.split(",");

const corsOptions = {
  origin: function (origin, callback) {
    console.log("ORIGIN" + origin);
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error("❌ CORS BLOCKED:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));


app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.get("/api/test", (req, res) => {
	res.json({ msg: "Backend is alive!" });
});

app.post(
	"/api/webhook/stripe",
	express.raw({ type: "application/json" }),
	paymentController.stripeWebhook
);


const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));

