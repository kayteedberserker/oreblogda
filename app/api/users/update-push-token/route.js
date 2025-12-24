import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect'; // You'll need a utility to connect to MongoDB
import User from '@/models/User';

export async function POST(request) {
  try {
    // 1. Connect to Database
    await dbConnect();

    // 2. Parse request body
    const { deviceId, pushToken } = await request.json();

    // 3. Validation
    if (!deviceId || !pushToken) {
      return NextResponse.json(
        { message: "Missing deviceId or pushToken" },
        { status: 400 }
      );
    }

    // 4. Update or Create User
    const user = await User.findOneAndUpdate(
      { deviceId: deviceId },
      { pushToken: pushToken },
      { 
        new: true, 
        upsert: true,
        runValidators: true // Ensures model validation still runs
      }
    );

    console.log(`✅ Updated Push Token for User: ${deviceId}`);

    // 5. Return Success
    return NextResponse.json({ 
      success: true, 
      user: {
        username: user.username,
        deviceId: user.deviceId
        // Don't send back sensitive data if not needed
      } 
    }, { status: 200 });

  } catch (error) {
    console.error("❌ Error updating push token:", error);
    
    return NextResponse.json(
      { message: "Internal Server Error", error: error.message },
      { status: 500 }
    );
  }
}