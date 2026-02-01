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
  console.log("checking cache" + cached) 
  if (cached.conn) {
    console.log("Mongodb cach loaded") 
    return cached.conn;
  }

  // 2. If we don't have a connection promise, create one
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Fails fast if connection is lost
      // --- ADDED PERFORMANCE & CONNECTION LIMITS BELOW ---
      maxPoolSize: 10,       // Limits each Vercel instance to 10 connections instead of 100
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      family: 4              // Use IPv4, skip trying IPv6 (faster connection)
    };

    cached.isLoading = true; // Trigger loading state
    console.log("📡 Initializing new MongoDB connection (Limited Pool)...");

    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongoose) => {
      console.log("✅ MongoDB connected successfully");
      cached.isLoading = false; // Reset loading state
      return mongoose;
    });
  }

  try {
    // 3. Wait for the promise to resolve
    cached.conn = await cached.promise;
  } catch (e) {
    // 4. If it fails, reset the promise so we can try again next time
    cached.promise = null;
    cached.isLoading = false;
    console.error("❌ MongoDB connection error:", e);
    throw e;
  }

  return cached.conn;
}

/**
 * UI HELPER: Use this in your frontend/API to check if a load is happening.
 * Anything that includes loading should have the loading animation.
 */
export const isDbConnecting = () => cached.isLoading;
