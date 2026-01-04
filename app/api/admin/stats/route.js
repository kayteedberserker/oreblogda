import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import Post from "@/app/models/PostModel";

export async function GET(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "7days";

    let startDate = new Date();
    let groupByFormat = "%Y-%m-%d"; // Default: Day
    let steps = 7;

    if (range === "24h") {
      startDate.setHours(startDate.getHours() - 24);
      groupByFormat = "%H:00"; // Hourly
      steps = 24;
    } else if (range === "30days") {
      startDate.setDate(startDate.getDate() - 30);
      steps = 30;
    } else {
      startDate.setDate(startDate.getDate() - 7);
    }

    const [postStatsArray, totalUsers, countries, rawActivity, appOpenData] = await Promise.all([
      Post.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      MobileUser.countDocuments(),
      MobileUser.aggregate([
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      MobileUser.aggregate([
        { $match: { lastActive: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: groupByFormat, date: "$lastActive" } }, count: { $sum: 1 } } },
        { $sort: { "_id": 1 } }
      ]),
      MobileUser.aggregate([
        { $match: { lastActive: { $gte: startDate } } },
        { $group: { _id: null, total: { $sum: "$appOpens" } } }
      ])
    ]);

    // --- FILLING THE GAPS (Zero-Fill Logic) ---
    const activityMap = new Map(rawActivity.map(i => [i._id, i.count]));
    const dailyActivity = [];
    
    for (let i = 0; i < steps; i++) {
        let label;
        const d = new Date();
        if (range === "24h") {
            d.setHours(d.getHours() - i);
            const h = d.getHours();
            label = `${h < 10 ? '0'+h : h}:00`;
        } else {
            d.setDate(d.getDate() - i);
            label = d.toISOString().split('T')[0];
        }
        dailyActivity.unshift({ _id: label, count: activityMap.get(label) || 0 });
    }

    const postStats = postStatsArray.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, { pending: 0, rejected: 0, approved: 0 });

    return NextResponse.json({
      success: true,
      data: { 
        totalUsers, 
        postStats, 
        countries, 
        dailyActivity,
        totalAppOpens: appOpenData[0]?.total || 0 
      }
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}