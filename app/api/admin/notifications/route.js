import connectDB from "@/app/lib/mongodb";
import { sendMultiplePushNotifications, sendPushNotification } from "@/app/lib/pushNotifications";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

const DORMANT_PERIODS = [2, 5, 7, 14, 30];

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');

    if (daysParam) {
      // List endpoint + total count
      const days = parseInt(daysParam);
      if (!DORMANT_PERIODS.includes(days)) {
        return NextResponse.json({ error: 'Invalid days. Use 2,5,7,14,30' }, { status: 400 });
      }
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const matchQuery = {
        lastActive: { $lt: cutoffDate },
        pushToken: { $exists: true, $ne: "" }
      };
      const totalCount = await MobileUser.countDocuments(matchQuery);
      const dormantUsers = await MobileUser.find(matchQuery)
        .select('username deviceId lastActive country pushToken _id')
        .sort({ lastActive: -1 });

      return NextResponse.json({
        totalCount,
        shownCount: dormantUsers.length,
        days

      });
    }

    // Counts for all periods (compat)
    const counts = {};
    for (const days of DORMANT_PERIODS) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      counts[days] = await MobileUser.countDocuments({
        lastActive: { $lt: cutoff },
        pushToken: { $exists: true, $ne: "" }
      });
    }

    return NextResponse.json({
      counts,
      dormantCount: counts[30]
    });
  } catch (err) {
    console.error('Notifications GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectDB();
    const body = await req.json();
    const { type, userId, title, message, days = 30, userIds } = body;

    if (type === "SINGLE") {
      const user = await MobileUser.findById(userId);
      if (!user?.pushToken) throw new Error("User has no push token");
      await sendPushNotification(user.pushToken, title, message);
      return NextResponse.json({ success: true });
    }

    if (type === "BULK_DORMANT") {
      let dormantUsers;
      if (userIds && Array.isArray(userIds) && userIds.length > 0) {
        dormantUsers = await MobileUser.find({
          _id: { $in: userIds },
          pushToken: { $exists: true, $ne: "" }
        }).select("pushToken");
      } else {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        dormantUsers = await MobileUser.find({
          lastActive: { $lt: cutoffDate },
          pushToken: { $exists: true, $ne: "" }
        }).select("pushToken");
      }

      const tokens = dormantUsers.map(u => u.pushToken);
      await sendMultiplePushNotifications(tokens, title || "Oreblogda Update", message);
      return NextResponse.json({
        success: true,
        sentCount: dormantUsers.length,
        days,
        targeted: userIds ? 'selected' : 'all_dormant'
      });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (err) {
    console.error('Notifications POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

