import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import Post from "@/app/models/PostModel";

export async function GET(req) {
  try {
    // --- Loading State Animation ---
    console.log("Fetching Analytics Data... [ ⌛ ]");
    /* [ . ]
       [ .. ]
       [ ... ]
    */

    await connectDB();
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "7days";

    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();
    let prevStartDate = new Date();
    let prevEndDate = new Date();
    let groupByFormat = "%Y-%m-%d";
    let steps = 7;

    if (range === "today") {
      // Current Day: 12:00 AM to 11:59 PM
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      
      // Comparison: Yesterday 12:00 AM to 11:59 PM
      prevStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      prevEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      
      groupByFormat = "%H:00";
      steps = 24; 

    } else if (range === "yesterday") {
      // Yesterday: 12:00 AM to 11:59 PM
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      
      // Comparison: Day before yesterday
      prevStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 0, 0, 0);
      prevEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 23, 59, 59);
      
      groupByFormat = "%H:00";
      steps = 24;

    } else if (range === "24h") {
      startDate.setHours(now.getHours() - 24);
      prevStartDate.setHours(now.getHours() - 48);
      prevEndDate.setHours(now.getHours() - 24);
      groupByFormat = "%H:00";
      steps = 24;
    } else if (range === "30days") {
      startDate.setDate(now.getDate() - 30);
      prevStartDate.setDate(now.getDate() - 60);
      prevEndDate.setDate(now.getDate() - 30);
      steps = 30;
    } else if (range === "thisMonth") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      steps = now.getDate();
    } else if (range === "lastMonth") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      prevStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      prevEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
      steps = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    } else {
      startDate.setDate(now.getDate() - 7);
      prevStartDate.setDate(now.getDate() - 14);
      prevEndDate.setDate(now.getDate() - 7);
      steps = 7;
    }

    const [postStatsArray, totalUsers, countries, rawActivity, currentPeriodOpens, prevPeriodOpens] = await Promise.all([
      Post.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      MobileUser.countDocuments(),
      MobileUser.aggregate([
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      MobileUser.aggregate([
        { $unwind: "$activityLog" },
        { $match: { activityLog: { $gte: startDate, $lte: endDate } } },
        { 
          $group: { 
            _id: { $dateToString: { format: groupByFormat, date: "$activityLog" } }, 
            count: { $sum: 1 }
          } 
        },
        { $sort: { "_id": 1 } }
      ]),
      MobileUser.aggregate([
        { $unwind: "$activityLog" },
        { $match: { activityLog: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: 1 } } }
      ]),
      MobileUser.aggregate([
        { $unwind: "$activityLog" },
        { $match: { activityLog: { $gte: prevStartDate, $lte: prevEndDate } } },
        { $group: { _id: null, total: { $sum: 1 } } }
      ])
    ]);

    const currentTotal = currentPeriodOpens[0]?.total || 0;
    const prevTotal = prevPeriodOpens[0]?.total || 0;
    
    let activityTrend = 0;
    if (prevTotal > 0) {
      activityTrend = Math.round(((currentTotal - prevTotal) / prevTotal) * 100);
    } else {
      activityTrend = currentTotal > 0 ? 100 : 0;
    }

    const activityMap = new Map(rawActivity.map(i => [i._id, i.count]));
    const dailyActivity = [];
    
    // Create the chart labels and data
    for (let i = 0; i < steps; i++) {
        let label;
        const d = new Date(endDate); 
        
        // Handle hourly formats for 24h, today, and yesterday
        if (["24h", "today", "yesterday"].includes(range)) {
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

    console.log("Data processing complete [ ✅ ]");

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
    console.error("Error in Analytics API [ ❌ ]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}