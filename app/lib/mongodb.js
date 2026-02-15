import mongoose from "mongoose";

/** * Global is used here to maintain a cached connection across hot reloads
 * in development and scope persistence in Vercel functions.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, isLoading: false };
}

export default async function connectDB() {
  // 1. If we have a connection already, return it immediately
  if (cached.conn) {
    // Check if the connection is still actually open (1 = connected)
    if (mongoose.connection.readyState === 1) {
      console.log("🟢 Using cached MongoDB connection");
      return cached.conn;
    }
    // If connection was lost, reset cache
    cached.conn = null;
    cached.promise = null;
  }

  // 2. If we don't have a connection promise, create one
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, 
      /* * LEAN POOL: Set to 2.
       * This allows 250+ Vercel instances to run without hitting the 500 limit.
       */
      maxPoolSize: 4,       
      minPoolSize: 1,
      /* * IDLE CLEANUP: 60 seconds is the sweet spot. 
       * 10 seconds is too aggressive and will make your site feel slow 
       * as it will constantly have to "re-connect" from scratch.
       */
      maxIdleTimeMS: 60000, 
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4
    };

    cached.isLoading = true; // Trigger loading state
    console.log("📡 Initializing new MongoDB connection (Lean Pool: 2)...");

    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongooseInstance) => {
      console.log("✅ MongoDB connected successfully");
      cached.isLoading = false; // Reset loading state
      return mongooseInstance;
    }).catch((err) => {
      cached.isLoading = false;
      cached.promise = null; // Reset promise so we can try again
      console.error("❌ MongoDB connection error in promise:", err);
      throw err;
    });
  }

  try {
    // 3. Wait for the promise to resolve
    cached.conn = await cached.promise;
  } catch (e) {
    // 4. If it fails, reset the promise so we can try again next time
    cached.promise = null;
    cached.isLoading = false;
    console.error("❌ MongoDB connection failed:", e);
    throw e;
  }

  return cached.conn;
}

/**
 * UI HELPER: Use this in your frontend/API to check if a load is happening.
 * Anything that includes loading should have the loading animation.
 */
export const isDbConnecting = () => cached.isLoading;
