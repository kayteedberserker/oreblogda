import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import Post from "@/app/models/PostModel";

export async function GET() {
  try {
    await connectDB();

    // 1. Group Post Counts by Status (Pending, Rejected, Approved)
    const postStatsArray = await Post.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    
    // Transform array [{_id: 'pending', count: 5}] into a clean object {pending: 5}
    const postStats = postStatsArray.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, { pending: 0, rejected: 0, approved: 0 });

    // 2. User Stats
    const totalUsers = await MobileUser.countDocuments();

    // 3. Country Breakdown
    const countries = await MobileUser.aggregate([
      { $group: { _id: "$country", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 } // Top 10 countries
    ]);

    // 4. Daily Activity (Last 7 Days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyActivity = await MobileUser.aggregate([
      { $match: { lastActive: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$lastActive" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalUsers,
        postStats,
        countries,
        dailyActivity
      }
    }, { status: 200 });

  } catch (err) {
    console.error("Admin Stats Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}