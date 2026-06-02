import jwt from "jsonwebtoken";

export default (req, res, next) => {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.split(" ")[1];

  if (!token)
    return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.userId,   // ⭐ FIX HERE
      email: decoded.email,
      role: decoded.role,
    };

    console.log("✅ Authenticated user:", req.user);

    next();
  } catch (err) {
    console.error("❌ JWT Error:", err.message);
    res.status(401).json({ message: "Invalid token" });
  }
};