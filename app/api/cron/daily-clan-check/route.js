import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";

export async function GET(req) {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");

    // Check for Vercel Cron Secret
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.error("❌ Auth Match Failed");
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        await connectDB();
        const clans = await Clan.find({});
        const now = new Date();

        for (const clan of clans) {
            // Initialize update objects
            let setFields = {};
            let badgesToAdd = [];
            const currentBadges = clan.badges || [];

            // 1. 🛡️ INACTIVITY PENALTY (7-Day Wall)
            const daysSinceActive = Math.floor((now - new Date(clan.lastActive)) / (1000 * 60 * 60 * 24));
            if (daysSinceActive >= 7) {
                setFields.totalPoints = Math.floor((clan.totalPoints || 0) * 0.5);
                setFields.spendablePoints = Math.floor((clan.spendablePoints || 0) * 0.5);
                setFields.lastActive = new Date(); 
            }

            // 2. 🎖️ MILESTONE BADGES
            if (clan.members?.length >= 10 && !currentBadges.includes("Gotei 13")) {
                badgesToAdd.push("Gotei 13");
            } else if (clan.members?.length >= 5 && !currentBadges.includes("The 5 Kage")) {
                badgesToAdd.push("The 5 Kage");
            }

            if ((clan.stats?.totalPosts || 0) >= 1000 && !currentBadges.includes("Library of Ohara")) {
                badgesToAdd.push("Library of Ohara");
            }

            if ((clan.stats?.likes || 0) >= 100000 && !currentBadges.includes("King's Haki")) {
                badgesToAdd.push("King's Haki");
            }

            // --- SAGE MODE (Balanced Mastery) ---
            if (!currentBadges.includes("Sage Mode")) {
                const { likes = 0, comments = 0, shares = 0 } = clan.stats || {};
                // Mastery: 50k points + at least 500 in every engagement category
                if ((clan.totalPoints || 0) >= 50000 && likes >= 500 && comments >= 500 && shares >= 500) {
                    badgesToAdd.push("Sage Mode");
                }
            }

            if (clan.rank === 6 && !currentBadges.includes("Final Form")) {
                badgesToAdd.push("Final Form");
            }

            // 3. 🎖️ SCOUTER SERIES
            const scouterLevels = [
                { threshold: 1000, badge: "Scouter Lvl 1" },
                { threshold: 5000, badge: "Scouter Lvl 2" },
                { threshold: 10000, badge: "Scouter Lvl 3" },
                { threshold: 50000, badge: "Scouter Lvl 4" },
                { threshold: 80000, badge: "Scouter: Broken Scale" },
                { threshold: 100000, badge: "Scouter: It's Over 9000" },
            ];

            for (const level of scouterLevels) {
                if ((clan.followerCount || 0) >= level.threshold && !currentBadges.includes(level.badge)) {
                    badgesToAdd.push(level.badge);
                }
            }

            // --- APPLY UPDATES ATOMICALLY ---
            const finalUpdate = {};
            if (Object.keys(setFields).length > 0) finalUpdate.$set = setFields;
            if (badgesToAdd.length > 0) {
                finalUpdate.$addToSet = { badges: { $each: badgesToAdd } };
            }

            if (Object.keys(finalUpdate).length > 0) {
                await Clan.updateOne({ _id: clan._id }, finalUpdate);
            }
        }

        return Response.json({ success: true, processed: clans.length });
    } catch (error) {
        console.error("❌ Daily Check Error:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}