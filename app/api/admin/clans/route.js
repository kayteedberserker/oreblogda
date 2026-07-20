import connectDB from '@/app/lib/mongodb';
import Clan from '@/app/models/ClanModel';
import MobileUser from '@/app/models/MobileUserModel'; // ⚡️ Make sure this is imported!
import Post from '@/app/models/PostModel';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        await connectDB();

        // ⚡️ FIXED: By explicitly passing `model: MobileUser`, we bypass the string mismatch
        const allClans = await Clan.find({})
            .populate({ path: 'leader', select: 'username', model: MobileUser })
            .populate({ path: 'members', select: 'username', model: MobileUser })
            .sort({ totalPoints: -1 })
            .lean();

        const primeRequests = allClans.filter(clan => clan.primeApplication && clan.primeApplication.status === 'pending');

        // ⚡️ 2. Aggregate Rich Metrics
        const [
            totalClans,
            primeStats,
            warStats,
            totalClanPosts
        ] = await Promise.all([
            Clan.countDocuments(),

            // Group by Prime Level to see distribution
            Clan.aggregate([
                { $match: { primeLevel: { $gt: 0 } } },
                { $group: { _id: "$primeLevel", count: { $sum: 1 } } }
            ]),

            // Count Active Wars and Bounties
            Clan.aggregate([
                {
                    $group: {
                        _id: null,
                        activeWars: { $sum: { $cond: ["$isInWar", 1, 0] } },
                        activeBounties: { $sum: { $cond: ["$hasBounty", 1, 0] } }
                    }
                }
            ]),

            // Count total posts linked to ANY clan
            Post.countDocuments({ clanId: { $ne: null } })
        ]);

        // Format Prime Distribution
        const primeDistribution = { 1: 0, 2: 0, 3: 0, total: 0 };
        primeStats.forEach(stat => {
            primeDistribution[stat._id] = stat.count;
            primeDistribution.total += stat.count;
        });

        const metrics = {
            totalClans,
            primeClans: primeDistribution.total,
            primeDistribution,
            activeWars: warStats[0]?.activeWars || 0,
            activeBounties: warStats[0]?.activeBounties || 0,
            totalClanPosts,
        };

        return NextResponse.json({
            success: true,
            data: {
                metrics,
                allClans,
                primeRequests
            }
        });
    } catch (error) {
        console.log("Error in GET /api/admin/clans:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        await connectDB();
        const { clanId } = await request.json();

        if (!clanId) return NextResponse.json({ success: false, message: "Clan ID required." }, { status: 400 });

        await Clan.findByIdAndDelete(clanId);

        return NextResponse.json({ success: true, message: "Clan successfully terminated." });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    try {
        await connectDB();
        const { clanId, action, updateData } = await request.json();

        if (!clanId) return NextResponse.json({ success: false, message: "Clan ID is required." }, { status: 400 });

        const clan = await Clan.findById(clanId);
        if (!clan) return NextResponse.json({ success: false, message: "Clan not found." }, { status: 404 });

        // ⚡️ HANDLE EDIT ACTION
        if (action === 'edit') {
            if (updateData?.name) clan.name = updateData.name;
            if (updateData?.description !== undefined) clan.description = updateData.description;

            await clan.save();
            return NextResponse.json({ success: true, message: "Clan intel successfully overwritten." });
        }

        // ⚡️ HANDLE PRIME UPGRADE ACTIONS
        if (['approve', 'decline'].includes(action)) {
            if (clan.primeApplication?.status !== 'pending') {
                return NextResponse.json({ success: false, message: "No active pending application." }, { status: 400 });
            }

            if (action === 'approve') {
                const assignedLevel = clan.primeApplication.requestedLevel || 1;
                clan.primeLevel = assignedLevel;
                clan.verifiedClan = true;
                clan.primeApplication.status = 'approved';
                clan.primeQuota = 500;

                const badgeName = `Prime Clan ${assignedLevel}`;
                if (!clan.badges.includes(badgeName)) {
                    clan.badges.push(badgeName);
                }
            } else if (action === 'decline') {
                clan.primeApplication.status = 'declined';
            }

            await clan.save();
            return NextResponse.json({ success: true, message: `Clan Prime status ${action}d.` });
        }

        return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}