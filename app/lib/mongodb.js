import mongoose from "mongoose";

/** * Global is used here to maintain a cached connection across hot reloads
 * in development and scope persistence in Vercel functions.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export default async function connectDB() {
  // 1. If we have a connection already, return it immediately
  if (cached.conn) {
    return cached.conn;
  }

  // 2. If we don't have a connection promise, create one
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Fails fast if connection is lost
    };

    console.log("📡 Initializing new MongoDB connection...");
    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongoose) => {
      console.log("✅ MongoDB connected successfully");
      return mongoose;
    });
  }

  try {
    // 3. Wait for the promise to resolve
    cached.conn = await cached.promise;
  } catch (e) {
    // 4. If it fails, reset the promise so we can try again next time
    cached.promise = null;
    console.error("❌ MongoDB connection error:", e);
    throw e;
  }

  return cached.conn;
}