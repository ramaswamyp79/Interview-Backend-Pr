import * as userService from "../Services/UserService.js";
import db from "../config/db.js"; 

/* ================= GET PROFILE (CACHEABLE - OPTIMIZED) ================= */

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // 🔥 OPTIMIZATION 1: Fetch the user document ONCE
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const meta = userDoc.data();
    
    // Safely handle Firestore Timestamp or standard JS Date objects
    let updatedStr = "new";
    if (meta.updatedAt) {
      updatedStr = typeof meta.updatedAt.toDate === 'function' 
        ? meta.updatedAt.toDate().toISOString() 
        : new Date(meta.updatedAt).toISOString();
    }

    const etag = updatedStr;

    // ✅ SHORT-CIRCUIT: If ETag matches, return early
    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end(); // ⚡ ~10ms
    }

    // 🔥 OPTIMIZATION 2: Pass the pre-fetched document to the service
    const user = await userService.getUserById(userId, userDoc);

    res.set("ETag", etag);
    res.set("Cache-Control", "private, max-age=60");

    return res.json({ user });

  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
};

/* ================= UPDATE PROFILE ================= */

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const updatedUser = await userService.updateUserById(
      userId,
      req.body
    );

    return res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });

  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

/* ================= GET USER CREDITS (CACHEABLE - OPTIMIZED) ================= */

export const fetchUserCredits = async (req, res) => {
  try {
    const userId = req.user.id;

    // 🔥 OPTIMIZATION 1: Fetch document ONCE
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const meta = userDoc.data();
    
    // Safely parse timestamp
    let updatedStr = "new";
    if (meta.updatedAt) {
      updatedStr = typeof meta.updatedAt.toDate === 'function' 
        ? meta.updatedAt.toDate().toISOString() 
        : new Date(meta.updatedAt).toISOString();
    }

    const credits = meta.credits || 0;
    const etag = `${updatedStr}-${credits}`;

    // ✅ EARLY RETURN
    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end(); // ⚡ no DB/service call
    }

    // 🔥 OPTIMIZATION 2: Pass the pre-fetched document to the service
    const data = await userService.getUserCredits(userId, userDoc);

    res.set("ETag", etag);
    res.set("Cache-Control", "private, max-age=30"); // shorter for credits

    return res.status(200).json({
      success: true,
      message: "Credits fetched successfully",
      data,
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};