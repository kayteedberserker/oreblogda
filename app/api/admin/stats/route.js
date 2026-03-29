import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import Post from "@/app/models/PostModel";

// ⚡️ HELPER: Calculate Percentage Trend
function calcTrend(curr, prev) {
    if (prev > 0) return Math.round(((curr - prev) / prev) * 100);
    if (curr > 0) return 100; // 100% growth if prev was 0 but curr has value
    return 0;
}

export async function GET(req) {
  try {
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

    // ⚡️ Determine Time Ranges
    if (range === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      prevStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      prevEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      groupByFormat = "%H:00";
      steps = 24; 
    } else if (range === "yesterday") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
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
    } else { // 7 days (default)
      startDate.setDate(now.getDate() - 7);
      prevStartDate.setDate(now.getDate() - 14);
      prevEndDate.setDate(now.getDate() - 7);
      steps = 7;
    }

    // ⚡️ MASSIVE QUERY BLOCK: Fetch Current & Previous Period Data Simultaneously
    const [
      allTimePostStatsArray,
      currPeriodPostStatsArray,
      prevPeriodPostStatsArray,
      totalUsers,
      prevTotalUsers, 
      countries,
      rawActivity, // Current Period Bar Chart Data
      prevRawActivity, // ⚡️ ADDED: Previous Period Bar Chart Data
      currentPeriodOpens,
      prevPeriodOpens,
      uniqueActiveUsers,
      prevUniqueActiveUsers
    ] = await Promise.all([
      Post.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Post.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Post.aggregate([
        { $match: { createdAt: { $gte: prevStartDate, $lte: prevEndDate } } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      MobileUser.countDocuments(),
      MobileUser.countDocuments({ createdAt: { $lt: startDate } }),
      MobileUser.aggregate([
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      MobileUser.aggregate([
        { $unwind: "$activityLog" },
        { $match: { activityLog: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: { $dateToString: { format: groupByFormat, date: "$activityLog" } }, count: { $sum: 1 } } },
        { $sort: { "_id": 1 } }
      ]),
      // ⚡️ ADDED: Query for previous period's activity array
      MobileUser.aggregate([
        { $unwind: "$activityLog" },
        { $match: { activityLog: { $gte: prevStartDate, $lte: prevEndDate } } },
        { $group: { _id: { $dateToString: { format: groupByFormat, date: "$activityLog" } }, count: { $sum: 1 } } }
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
      ]),
      MobileUser.aggregate([
        { $unwind: "$activityLog" },
        { $match: { activityLog: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: "$_id" } }, 
        { $group: { _id: null, totalUnique: { $sum: 1 } } }
      ]),
      MobileUser.aggregate([
        { $unwind: "$activityLog" },
        { $match: { activityLog: { $gte: prevStartDate, $lte: prevEndDate } } },
        { $group: { _id: "$_id" } },
        { $group: { _id: null, totalUnique: { $sum: 1 } } }
      ])
    ]);

    // --- 📊 CALCULATE TRENDS & TOTALS ---

    // 1. App Opens
    const totalAppOpens = currentPeriodOpens[0]?.total || 0;
    const prevTotalAppOpens = prevPeriodOpens[0]?.total || 0;
    const activityTrend = calcTrend(totalAppOpens, prevTotalAppOpens);

    // 2. Unique Active Users
    const uniqueDailyActive = uniqueActiveUsers[0]?.totalUnique || 0; 
    const prevUniqueDailyActive = prevUniqueActiveUsers[0]?.totalUnique || 0;
    const activeTrend = calcTrend(uniqueDailyActive, prevUniqueDailyActive);

    // 3. User Growth
    const usersTrend = calcTrend(totalUsers, prevTotalUsers);

    // 4. Post Analytics
    const allTimePosts = allTimePostStatsArray.reduce((acc, curr) => { acc[curr._id] = curr.count; return acc; }, { pending: 0, rejected: 0, approved: 0 });
    const currPosts = currPeriodPostStatsArray.reduce((acc, curr) => { acc[curr._id] = curr.count; return acc; }, { pending: 0, rejected: 0, approved: 0 });
    const prevPosts = prevPeriodPostStatsArray.reduce((acc, curr) => { acc[curr._id] = curr.count; return acc; }, { pending: 0, rejected: 0, approved: 0 });

    const postStats = {
        pending: allTimePosts.pending,
        prevPending: allTimePosts.pending - currPosts.pending,
        pendingTrend: calcTrend(currPosts.pending, prevPosts.pending),
        
        approved: allTimePosts.approved,
        prevApproved: allTimePosts.approved - currPosts.approved,
        approvedTrend: calcTrend(currPosts.approved, prevPosts.approved),
        
        rejected: allTimePosts.rejected,
        prevRejected: allTimePosts.rejected - currPosts.rejected,
        rejectedTrend: calcTrend(currPosts.rejected, prevPosts.rejected)
    };

    // --- 📈 BUILD CHART DATA (WITH PREV COUNT) ---
    const activityMap = new Map(rawActivity.map(i => [i._id, i.count]));
    const prevActivityMap = new Map(prevRawActivity.map(i => [i._id, i.count])); // ⚡️ Map previous data
    
    const dailyActivity = [];
    
    for (let i = 0; i < steps; i++) {
        let label;
        let prevLabel;
        
        const d = new Date(endDate); 
        const prevD = new Date(prevEndDate); // ⚡️ We need to track the date from the previous period too
        
        if (["24h", "today", "yesterday"].includes(range)) {
            d.setHours(d.getHours() - i);
            const h = d.getHours();
            label = `${h < 10 ? '0'+h : h}:00`;

            // Calculate corresponding previous hour
            prevD.setHours(prevD.getHours() - i);
            const prevH = prevD.getHours();
            prevLabel = `${prevH < 10 ? '0'+prevH : prevH}:00`;

        } else {
            d.setDate(d.getDate() - i);
            label = d.toISOString().split('T')[0];

            // Calculate corresponding previous day
            prevD.setDate(prevD.getDate() - i);
            prevLabel = prevD.toISOString().split('T')[0];
        }

        // ⚡️ ADDED: Push both count and prevCount into the array
        dailyActivity.unshift({ 
            _id: label, 
            count: activityMap.get(label) || 0,
            prevCount: prevActivityMap.get(prevLabel) || 0 // ⚡️ Get data for the corresponding point in the past
        });
    }

    return NextResponse.json({
      success: true,
      data: { 
        totalUsers, 
        prevTotalUsers,
        usersTrend,

        totalAppOpens,
        prevTotalAppOpens,
        activityTrend, 

        uniqueDailyActive,
        prevUniqueDailyActive,
        activeTrend,

        postStats, 
        countries, 
        dailyActivity, // ⚡️ Now includes prevCount!
      }
    });
  } catch (err) {
    console.error("Error in Analytics API [ ❌ ]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}