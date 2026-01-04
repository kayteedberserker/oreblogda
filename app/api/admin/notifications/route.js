import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import { sendPushNotification } from "@/app/lib/pushNotifications";

export async function GET() {
  try {
    await connectDB();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Count users with tokens who haven't been active in 30 days
    const count = await MobileUser.countDocuments({
      lastActive: { $lt: thirtyDaysAgo },
      pushToken: { $exists: true, $ne: "" }
    });

    return NextResponse.json({ dormantCount: count });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectDB();
    const { type, userId, title, message } = await req.json();

    if (type === "SINGLE") {
      const user = await MobileUser.findById(userId);
      if (!user?.pushToken) throw new Error("User has no push token");
      await sendPushNotification(user.pushToken, title, message);
      return NextResponse.json({ success: true });
    }

    if (type === "BULK_DORMANT") {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dormantUsers = await MobileUser.find({
        lastActive: { $lt: thirtyDaysAgo },
        pushToken: { $exists: true, $ne: "" }
      }).select("pushToken");

      // Send notifications in parallel
      const pushPromises = dormantUsers.map(u => 
        sendPushNotification(u.pushToken, title, message)
      );
      
      await Promise.all(pushPromises);
      return NextResponse.json({ success: true, sentCount: dormantUsers.length });
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}