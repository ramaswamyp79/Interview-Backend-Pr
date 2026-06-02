import express from "express";
import * as authController from "../controllers/auth.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/social", authController.socialAuth);

router.get(
  "/me",
  authMiddleware,
  authController.me // ✅ FIXED
);

router.get("/debug/cookies", authController.debugCookies);
router.post("/change-password", authMiddleware, authController.changePassword);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

export default router;
