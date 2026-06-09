import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import mongoose from 'mongoose';
import { NextResponse } from "next/server";

const VersionSchema = new mongoose.Schema({
    key: { type: String, default: 'latest_app_version' },
    appVersion: { type: String, required: true },
    runtimeVersion: { type: String, required: true },
    critical: { type: Boolean, default: false },
}, { timestamps: true });

const VersionModel = mongoose.models.Version || mongoose.model('Version', VersionSchema);

function addCorsHeaders(response) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
    return response;
}

export async function OPTIONS() {
    return addCorsHeaders(new NextResponse(null, { status: 204 }));
}

export async function POST(req) {
    try {
        await connectDB();

        const { deviceId, pushToken, platform } = await req.json();

        if (!deviceId) {
            return addCorsHeaders(NextResponse.json({ error: "Missing deviceId" }, { status: 400 }));
        }

        const now = new Date();
        const sixtyDaysAgo = new Date(now);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        // 1️⃣ Prepare fields to update dynamically
        let updateFields = { lastActive: now };
        if (pushToken) updateFields.pushToken = pushToken;
        if (platform) updateFields.platform = platform; // Save device analytics (ios / android)

        let user = await MobileUser.findOne({ deviceId });

        const lastLogEntry = user?.activityLog?.[user.activityLog.length - 1];
        const shouldLog = !user || !lastLogEntry || new Date(lastLogEntry) < oneHourAgo;

        let dbOperation;

        if (shouldLog) {
            dbOperation = MobileUser.findOneAndUpdate(
                { deviceId },
                {
                    $set: updateFields,
                    $inc: { appOpens: 1 },
                    $push: {
                        activityLog: {
                            $each: [now],
                            $slice: -100 // 👈 Keeps ONLY the 100 most recent items; chops off oldest
                        }
                    }
                },
                { upsert: true, new: true, runValidators: true }
            );
        } else {
            dbOperation = MobileUser.findOneAndUpdate(
                { deviceId },
                { $set: updateFields },
                { upsert: true, new: true, runValidators: true }
            );
        }

        // 2️⃣ Execute user metrics update and look up app updates in one single trip
        const [updatedUser, versionConfig] = await Promise.all([
            dbOperation,
            VersionModel.findOne({ key: 'latest_app_version' })
        ]);

        const systemVersion = versionConfig || { appVersion: "1.0.0", runtimeVersion: "v1", critical: false };

        return addCorsHeaders(NextResponse.json({
            success: true,
            system: {
                appVersion: systemVersion.appVersion,
                runtimeVersion: systemVersion.runtimeVersion,
                critical: systemVersion.critical
            },
            activity: {
                recorded: shouldLog,
                pushTokenUpdated: !!pushToken
            }
        }));

    } catch (err) {
        console.error("Bootstrap Error:", err);
        return addCorsHeaders(NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        ));
    }
}


// import connectDB from "@/app/lib/mongodb";
// import Clan from "@/app/models/ClanModel";
// import ClanWar from "@/app/models/ClanWar";
// import MobileUser from "@/app/models/MobileUserModel";
// import UserStreak from "@/app/models/UserStreak";
// import mongoose from 'mongoose';
// import { NextResponse } from "next/server";

// const VersionSchema = new mongoose.Schema({
//     key: { type: String, default: 'latest_app_version' },
//     appVersion: { type: String, required: true },
//     runtimeVersion: { type: String, required: true },
//     critical: { type: Boolean, default: false },
// }, { timestamps: true });

// const VersionModel = mongoose.models.Version || mongoose.model('Version', VersionSchema);

// const calculatePeakLevel = (totalPurchased) => {
//     if (!totalPurchased || totalPurchased < 1) return 0;
//     if (totalPurchased < 1000) return 1;
//     if (totalPurchased < 5000) return 2;
//     if (totalPurchased < 10000) return 3;
//     if (totalPurchased < 25000) return 4;
//     if (totalPurchased < 50000) return 5;
//     if (totalPurchased < 100000) return 6;
//     if (totalPurchased < 250000) return 7;
//     if (totalPurchased < 500000) return 8;
//     if (totalPurchased < 1000000) return 9;
//     return 10;
// };

// const getRankDetails = (points) => {
//     if (points >= 300000) return { title: "The Akatsuki", next: 1000000, color: "#ef4444" };
//     if (points >= 100000) return { title: "The Espada", next: 300000, color: "#e0f2fe" };
//     if (points >= 50000) return { title: "Phantom Troupe", next: 100000, color: "#a855f7" };
//     if (points >= 20000) return { title: "Upper Moon", next: 50000, color: "#60a5fa" };
//     if (points >= 5000) return { title: "Squad 13", next: 20000, color: "#10b981" };
//     return { title: "Wandering Ronin", next: 5000, color: "#94a3b8" };
// };

// function addCorsHeaders(response) {
//     response.headers.set("Access-Control-Allow-Origin", "*");
//     response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
//     response.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
//     return response;
// }

// export async function OPTIONS() {
//     return addCorsHeaders(new NextResponse(null, { status: 204 }));
// }

// export async function POST(req) {
//     try {
//         await connectDB();
//         const { deviceId, pushToken, platform } = await req.json();

//         if (!deviceId) return addCorsHeaders(NextResponse.json({ error: "Missing deviceId" }, { status: 400 }));

//         const now = new Date();
//         const sixtyDaysAgo = new Date(now);
//         sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
//         const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

//         // 1️⃣ Fetch or Create User Base
//         let user = await MobileUser.findOne({ deviceId }).lean();
//         let isNewUser = false;

//         if (!user) {
//             let randNum = Math.floor(Math.random() * 10000000);
//             const newUser = await MobileUser.create({ deviceId, username: `User${randNum}` });
//             user = newUser.toObject();
//             isNewUser = true;
//         }

//         // 2️⃣ Process Inventory Expirations
//         let validInventory = user.inventory || [];
//         let inventoryNeedsUpdate = false;
//         if (validInventory.length > 0) {
//             validInventory = validInventory.filter(item => {
//                 if (item.expiresAt && new Date(item.expiresAt) < now) {
//                     inventoryNeedsUpdate = true;
//                     return false;
//                 }
//                 return true;
//             });
//             if (inventoryNeedsUpdate) user.inventory = validInventory;
//         }

//         // 3️⃣ Construct User Updates
//         let updateQuery = { $set: { lastActive: now } };
//         if (pushToken) updateQuery.$set.pushToken = pushToken;
//         if (platform) updateQuery.$set.platform = platform;
//         if (inventoryNeedsUpdate) updateQuery.$set.inventory = validInventory;

//         const lastLogEntry = user?.activityLog?.[user.activityLog?.length - 1];
//         const shouldLog = isNewUser || !lastLogEntry || new Date(lastLogEntry) < oneHourAgo;

//         if (shouldLog) {
//             updateQuery.$inc = { appOpens: 1 };
//             updateQuery.$push = { activityLog: now };
//             updateQuery.$pull = { activityLog: { $lt: sixtyDaysAgo } };
//         }

//         // 4️⃣ Fast Clan Lookup (Lightweight Phase 2 Logic)
//         // Find if the user is in ANY clan, grabbing just the essentials.
//         const userClanBase = await Clan.findOne({
//             $or: [
//                 { leader: user._id },
//                 { viceLeader: user._id },
//                 { members: user._id }
//             ]
//         }).select("tag name leader viceLeader rank totalPoints spendablePoints joinRequests latestMessage messages").lean();

//         let userClanData = null;
//         let totalWarActions = 0;
//         let fullData = 0;
//         let cCoins = 0;
//         let clanRank = 0;
//         let latestMessageAt = null;

//         // If they are in a clan, calculate roles, grab their points, and check notifications
//         if (userClanBase) {
//             let userRole = "member";
//             if (userClanBase.leader?.toString() === user._id.toString()) userRole = "leader";
//             else if (userClanBase.viceLeader?.toString() === user._id.toString()) userRole = "viceleader";

//             userClanData = {
//                 tag: userClanBase.tag,
//                 name: userClanBase.name,
//                 role: userRole,
//                 clanId: userClanBase._id,
//                 rank: userClanBase.rank
//             };

//             fullData = userClanBase.joinRequests?.length || 0;
//             cCoins = userClanBase.spendablePoints || 0;
//             clanRank = userClanBase.rank || 0;

//             latestMessageAt = userClanBase.latestMessage?.createdAt ||
//                 userClanBase.messages?.[userClanBase.messages?.length - 1]?.date ||
//                 null;

//             // Run lightweight counts for wars instead of pulling entire documents
//             const [pendingWars, negotiatingWars] = await Promise.all([
//                 ClanWar.countDocuments({ status: 'PENDING', defenderTag: userClanBase.tag }),
//                 ClanWar.countDocuments({ status: 'NEGOTIATING', $or: [{ challengerTag: userClanBase.tag }, { defenderTag: userClanBase.tag }] })
//             ]);

//             totalWarActions = pendingWars + negotiatingWars;
//         }

//         // 5️⃣ Execute Parallel DB Lookups & Updates
//         const [updateResult, streakDoc, versionConfig] = await Promise.all([
//             MobileUser.updateOne({ _id: user._id }, updateQuery),
//             UserStreak.findOne({ userId: user._id }).lean(),
//             VersionModel.findOne({ key: 'latest_app_version' }).lean()
//         ]);

//         // 6️⃣ Process Active Events (Hardcoded for zero-latency)
//         const rawEvents = [
//             {
//                 id: 'trivia_lore_check',
//                 type: "quiz",
//                 title: 'The Meaning of the System',
//                 description: 'Prove your knowledge of THE SYSTEM to unlock 500 OC.',
//                 eventType: 'quiz',
//                 promoImage: 'https://res.cloudinary.com/donakg9he/image/upload/v1778879732/ChatGPT_Image_May_6_2026_12_13_46_PM_yb2isc.png',
//                 icon: 'help-circle',
//                 themeColor: '#8b5cf6',
//                 startsAt: new Date('2026-05-16T07:00:00Z').toISOString(),
//                 endsAt: new Date('2026-05-23T23:59:59Z').toISOString(),
//             },
//             {
//                 id: 'gacha_400_cache',
//                 type: "gacha",
//                 gachaType: "GRID",
//                 title: '400 SYNCED: MAIN EVENT',
//                 description: 'To celebrate, the limited-time Surge Event is live! Drop in, take your spins, and cash in your fragments for the ultra-rare Cyan Surge items before they vanish!',
//                 startsAt: new Date('2026-05-17T00:00:00Z').toISOString(),
//                 eventType: 'seasonal',
//                 tokenName: '400 SYNCED',
//                 tokenVisual: {
//                     svgCode: `
//                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
//                             <defs>
//                                 <linearGradient id="b" x1="0%" y1="0%" x2="0%" y2="100%">
//                                 <stop offset="0%" stop-color="#07519e"/>
//                                 <stop offset="100%" stop-color="#02152e"/>
//                                 </linearGradient>
//                                 <linearGradient id="d" x1="0%" y1="0%" x2="0%" y2="100%">
//                                 <stop offset="0%" stop-color="#3bf7db"/>
//                                 <stop offset="45%" stop-color="#21bbf3"/>
//                                 <stop offset="100%" stop-color="#0b38b3"/>
//                                 </linearGradient>
//                             </defs>
//                             <g transform="translate(500 500)">
//                                 <path fill="#02152e" d="m0 0-480-380 60-40zm0 0 480-320-80-80zm0 0-450 380 90 40zm0 0 460 350-60 80zm0 0-520-80 20 100zm0 0 520-50-20-70z"/>
//                                 <path fill="#21bbf3" d="m0 0-460-360 60-30z"/>
//                                 <path fill="#3bf7db" d="m0 0 450-300-70-70z"/>
//                                 <path fill="#21bbf3" d="m0 0-420 360 80 30z"/>
//                                 <path fill="#3bf7db" d="m0 0 440 330-60 70z"/>
//                                 <circle cx="-420" cy="-200" r="8" fill="#02152e"/>
//                                 <circle cx="-400" cy="-220" r="12" fill="#21bbf3"/>
//                                 <circle cx="430" cy="-180" r="10" fill="#02152e"/>
//                                 <circle cx="450" cy="180" r="15" fill="#3bf7db"/>
//                                 <circle cx="-380" cy="220" r="9" fill="#02152e"/>
//                             </g>
//                             <g transform="translate(515 520)">
//                                 <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="#000000" stroke="#000000" stroke-width="40" stroke-linejoin="round" opacity="0.2"/>
//                             </g>
//                             <g transform="translate(500 500)">
//                                 <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="#000000" stroke="#000" stroke-width="40" stroke-linejoin="round"/>
//                                 <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="none" stroke="#fff" stroke-width="20" stroke-linejoin="round"/>
//                                 <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="url(#b)"/>
//                                 <path d="m-170-150-30-150m-50 210-120-150m540 90 30-150" fill="none" stroke="#3bf7db" stroke-width="8" stroke-linecap="round" opacity=".8"/>
//                             </g>
//                             <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" x="15" y="20" fill="#000000" stroke="#000" stroke-width="45" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">400</text>
//                             <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="#000000" stroke="#000" stroke-width="45" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">400</text>
//                             <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="none" stroke="#fff" stroke-width="18" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">400</text>
//                             <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="url(#d)" transform="translate(500 540)skewX(-14)">400</text>
//                             <g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" transform="translate(500 540)skewX(-14)">
//                                 <path d="m-160-280 40 160M-220 10l40 50m170-320 20 110m170-110 20 110"/>
//                                 <circle cx="-130" cy="-80" r="4" fill="#fff" stroke="none"/>
//                                 <circle cx="20" cy="-110" r="4" fill="#fff" stroke="none"/>
//                                 <circle cx="210" cy="-110" r="4" fill="#fff" stroke="none"/>
//                             </g>
//                         </svg>
//                     `
//                 },
//                 icon: 'flare',
//                 themeColor: '#8bf755',
//                 endsAt: new Date('2026-06-01T00:00:00Z').toISOString(),
//             }
//         ];

//         const activeEvents = rawEvents
//             .filter(event => !event.endsAt || new Date(event.endsAt) > now)
//             .map(event => ({
//                 ...event,
//                 isComing: event.startsAt && new Date(event.startsAt) > now,
//                 status: (event.startsAt && new Date(event.startsAt) > now) ? 'coming_soon' : 'active',
//             }));

//         const systemVersion = versionConfig || { appVersion: "1.0.0", runtimeVersion: "v1", critical: false };

//         // 7️⃣ Build Final Master Payload
//         return addCorsHeaders(NextResponse.json({
//             success: true,
//             system: {
//                 appVersion: systemVersion.appVersion,
//                 runtimeVersion: systemVersion.runtimeVersion,
//                 critical: systemVersion.critical
//             },
//             activity: {
//                 recorded: shouldLog,
//                 pushTokenUpdated: !!pushToken
//             },
//             user: {
//                 ...user,
//                 country: user.country || "Unknown",
//                 securityLevel: user.securityLevel || 0,
//                 inventory: validInventory
//             },
//             coins: {
//                 balance: user.coins || 0,
//                 tokens: user.tokens || 0,
//                 totalPurchasedCoins: user.totalPurchasedCoins || 0,
//                 peakLevel: calculatePeakLevel(user.totalPurchasedCoins || 0)
//             },
//             streak: {
//                 streak: streakDoc?.streak || 0,
//                 lastPostDate: streakDoc?.lastPostDate || null,
//                 expiresAt: streakDoc?.expiresAt || null,
//                 canRestore: !streakDoc && (user.lastStreak > 0),
//                 recoverableStreak: user.lastStreak || 0
//             },
//             clan: {
//                 userInClan: !!userClanData,
//                 userClan: userClanData,
//                 fullData: fullData,
//                 cCoins: cCoins,
//                 clanRank: clanRank,
//                 latestMessageAt: latestMessageAt,
//                 totalWarActions: totalWarActions
//             },
//             events: activeEvents
//         }));

//     } catch (err) {
//         console.error("Bootstrap Error:", err);
//         return addCorsHeaders(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }));
//     }
// }