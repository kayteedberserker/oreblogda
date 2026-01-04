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
    let prevStartDate = new Date(); 
    let groupByFormat = "%Y-%m-%d"; 
    let steps = 7;

    // --- 1. SET TIME WINDOWS ---
    if (range === "24h") {
      startDate.setHours(startDate.getHours() - 24);
      prevStartDate.setHours(prevStartDate.getHours() - 48); 
      groupByFormat = "%H:00"; 
      steps = 24;
    } else if (range === "30days") {
      startDate.setDate(startDate.getDate() - 30);
      prevStartDate.setDate(prevStartDate.setDate() - 60);
      steps = 30;
    } else {
      startDate.setDate(startDate.getDate() - 7);
      prevStartDate.setDate(prevStartDate.setDate() - 14);
      steps = 7;
    }

    const [postStatsArray, totalUsers, countries, rawActivity, currentPeriodOpens, prevPeriodOpens] = await Promise.all([
      // 1. Post Status Distribution
      Post.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      
      // 2. Global User Count
      MobileUser.countDocuments(),
      
      // 3. Geographic Distribution
      MobileUser.aggregate([
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      // 4. Activity Flow (Chart Data) - CHANGED TO SUM OPENS, NOT PEOPLE
      MobileUser.aggregate([
        { $match: { lastActive: { $gte: startDate } } },
        { 
          $group: { 
            _id: { $dateToString: { format: groupByFormat, date: "$lastActive" } }, 
            count: { $sum: "$appOpens" } // Now chart shows total clicks
          } 
        },
        { $sort: { "_id": 1 } }
      ]),
      
      // 5. Current Window App Opens
      MobileUser.aggregate([
        { $match: { lastActive: { $gte: startDate } } },
        { $group: { _id: null, total: { $sum: "$appOpens" } } }
      ]),

      // 6. Previous Window App Opens
      MobileUser.aggregate([
        { $match: { lastActive: { $gte: prevStartDate, $lt: startDate } } },
        { $group: { _id: null, total: { $sum: "$appOpens" } } }
      ])
    ]);

    // --- 2. TREND CALCULATION ---
    const currentTotal = currentPeriodOpens[0]?.total || 0;
    const prevTotal = prevPeriodOpens[0]?.total || 0;
    
    let activityTrend = 0;
    if (prevTotal > 0) {
      activityTrend = Math.round(((currentTotal - prevTotal) / prevTotal) * 100);
    } else {
      activityTrend = currentTotal > 0 ? 100 : 0;
    }

    // --- 3. GAP FILLING LOGIC ---
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
        activityTrend, 
        totalAppOpens: currentTotal 
      }
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}