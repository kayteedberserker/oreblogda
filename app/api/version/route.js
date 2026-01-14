import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/app/lib/mongodb'; // Adjust path to your DB connect file

// Define a minimal schema right here to avoid separate file clutter
const VersionSchema = new mongoose.Schema({
  key: { type: String, default: 'latest_app_version' }, // Unique key to find the record
  version: { type: String, required: true },
  critical: { type: Boolean, default: false },
}, { timestamps: true });

// Prevent "OverwriteModelError" in Next.js hot-reloading
const VersionModel = mongoose.models.Version || mongoose.model('Version', VersionSchema);

// GET: Fetch the version for the Mobile App
export async function GET() {
  try {
    await connectDB();
    // Find the single version record
    const config = await VersionModel.findOne({ key: 'latest_app_version' });
    
    return NextResponse.json(config || { version: "1.0.0", critical: false });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch version" }, { status: 500 });
  }
}

// POST: Update the version from your Admin Page
export async function POST(request: Request) {
  try {
    const { version, critical } = await request.json();
    await connectDB();

    // Use upsert: update if exists, create if not
    const updated = await VersionModel.findOneAndUpdate(
      { key: 'latest_app_version' },
      { version, critical },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update version" }, { status: 500 });
  }
}
