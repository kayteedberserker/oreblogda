import jwt from "jsonwebtoken";

export const verifyToken = (token) => {
  try {
    if (!token) return null; // no token provided
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded; // will contain whatever you encoded (e.g., { id, email })
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    return null;
  }
};
