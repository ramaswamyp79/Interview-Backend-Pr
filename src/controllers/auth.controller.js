import { signJwt as generateToken, getJwtExpiryMs } from "../utils/jwt.utils.js";
import authService from "../Services/AuthService.js";

// ================= SIGNUP =================
export const signup = async (req, res) => {
  try {
    const user = await authService.registerUser(req.body);

    const token = generateToken({
      userId: user._id, // Removed .toString() - Firestore IDs are native strings
      email: user.email,
      role: user.role,
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: getJwtExpiryMs(),
    });

    res.status(201).json({
      message: "Signup successful",
      token,
      user,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ================= LOGIN =================
export const login = async (req, res) => {
  try {
    const user = await authService.loginUser(
      req.body.email,
      req.body.password
    );

    const token = generateToken({
      userId: user._id, 
      email: user.email,
      role: user.role,
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: getJwtExpiryMs(),
    });

    res.json({ message: "Login successful", token, user });
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
};

// ================= SOCIAL =================
export const socialAuth = async (req, res) => {
  try {
    const user = await authService.socialLogin(req.body);

    const token = generateToken({
      userId: user._id,
      email: user.email,
      role: user.role,
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: getJwtExpiryMs(),
    });

    res.json({ token, user });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ================= ME (CACHED) =================
export const me = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // This response will be cached via middleware
    return res.json({ user: req.user });

  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

// ================= DEBUG =================
export const debugCookies = (req, res) => {
  try {
    return res.json({ cookies: req.cookies });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

// ================= CHANGE PASSWORD =================
export const changePassword = async (req, res) => {
  const { newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  await authService.changePassword(req.user.id, newPassword);

  res.clearCookie("token");

  res.json({ message: "Password changed. Please login again." });
};

// ================= FORGOT =================
export const forgotPassword = async (req, res) => {
  try {
    if (!req.body.email) {
      return res.status(400).json({ message: "Email is required" });
    }

    await authService.forgotPassword(req.body.email);

    res.json({ message: "OTP sent to email" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ================= RESET =================
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    await authService.resetPasswordWithOtp(email, otp, newPassword);

    res.json({ message: "Password reset successful. Please login." });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};