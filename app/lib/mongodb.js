import mongoose from "mongoose";

/** * Global is used here to maintain a cached connection across hot reloads
 * in development and scope persistence in Vercel functions.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, isLoading: false };
}

export default async function connectDB() {
  // 1. Check if the connection is already active
  if (cached.conn) {
    if (mongoose.connection.readyState === 1) {
      // Intentionally quiet to keep logs clean, or use: console.log("🟢 Cached Link Active");
      return cached.conn;
    }
    // If connection was lost or in a weird state, reset
    cached.conn = null;
    cached.promise = null;
  }

  // 2. The "Race Condition" Shield
  // If a promise already exists, wait for it instead of starting a new one
  if (cached.promise) {
    console.log("⏳ Connection in progress... awaiting existing uplink.");
    return await cached.promise;
  }

  // 3. Initialize New Connection
  const opts = {
    bufferCommands: false, 
    /* * LEAN POOL: 4. 
     * This limits THIS SPECIFIC instance. 
     * Note: Vercel may spin up multiple instances (Lambdas) simultaneously.
     */
    maxPoolSize: 4,       
    minPoolSize: 1,
    /* * IDLE CLEANUP: 60 seconds.
     */
    maxIdleTimeMS: 60000, 
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4
  };

  cached.isLoading = true;
  console.log("📡 Initializing new MongoDB connection (Pool: 4)...");

  cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongooseInstance) => {
    console.log("✅ MongoDB connected successfully");
    cached.isLoading = false;
    return mongooseInstance;
  }).catch((err) => {
    cached.isLoading = false;
    cached.promise = null; // Clear promise so the next request can retry
    console.error("❌ MongoDB connection error:", err);
    throw err;
  });

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    cached.isLoading = false;
    throw e;
  }

  return cached.conn;
}

/**
 * UI HELPER: Use this in your frontend/API to check if a load is happening.
 * Anything that includes loading should have the loading animation.
 */
export const isDbConnecting = () => cached.isLoading;