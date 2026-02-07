import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";

export async function GET(req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return new Response('Unauthorized', { status: 401 });

    await connectDB();
    const clans = await Clan.find({});
    
    const rankMap = { 6: 5000, 5: 2500, 4: 1000, 3: 500, 2: 200, 1: 50 };

    const updatePromises = clans.map(clan => {
        const allowance = rankMap[clan.rank] || 0;
        return Clan.updateOne({ _id: clan._id }, { $inc: { spendablePoints: allowance } });
    });

    await Promise.all(updatePromises);
    return Response.json({ success: true });
}