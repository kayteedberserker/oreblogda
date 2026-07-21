import connectDB from "@/app/lib/mongodb";
import ClanFollower from "@/app/models/ClanFollower";
import Clan from '@/app/models/ClanModel';
import ClanWar from "@/app/models/ClanWar";
import MessagePillModel from "@/app/models/MessagePillModel";
import MobileUser from "@/app/models/MobileUserModel";
import QuizEvent from "@/app/models/QuizEvent";
import ShoutoutEvent from "@/app/models/ShoutoutEvent";
import Tournament from "@/app/models/Tournament";
import UserStreak from "@/app/models/UserStreak";
import mongoose from 'mongoose';
import { NextResponse } from "next/server";

const VersionSchema = new mongoose.Schema({
    key: { type: String, default: 'latest_app_version' },
    appVersion: { type: String, required: true },
    runtimeVersion: { type: String, required: true },
    critical: { type: Boolean, default: false },
}, { timestamps: true });

const VersionModel = mongoose.models.Version || mongoose.model('Version', VersionSchema);

const calculatePeakLevel = (totalPurchased) => {
    if (!totalPurchased || totalPurchased < 1) return 0;
    if (totalPurchased < 1000) return 1;
    if (totalPurchased < 5000) return 2;
    if (totalPurchased < 10000) return 3;
    if (totalPurchased < 25000) return 4;
    if (totalPurchased < 50000) return 5;
    if (totalPurchased < 100000) return 6;
    if (totalPurchased < 250000) return 7;
    if (totalPurchased < 500000) return 8;
    if (totalPurchased < 1000000) return 9;
    return 10;
};

function addCorsHeaders(response) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
    return response;
}

export async function OPTIONS() { return addCorsHeaders(new NextResponse(null, { status: 204 })); }

export async function POST(req) {
    try {
        await connectDB();
        const { deviceId, pushToken, platform, referredBy, userId, clanId } = await req.json();

        if (!deviceId) return addCorsHeaders(NextResponse.json({ error: "Missing deviceId" }, { status: 400 }));

        const now = new Date();
        const sixtyDaysAgo = new Date(now);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        let user = await MobileUser.findOne({ deviceId }).lean();
        let isNewUser = false;

        if (!user) {
            let randNum = Math.floor(Math.random() * 10000000);
            const newUser = await MobileUser.create({ deviceId, username: `User${randNum}` });
            user = newUser.toObject();
            isNewUser = true;
        }

        let validInventory = user.inventory || [];
        let inventoryNeedsUpdate = false;

        if (validInventory.length > 0) {
            validInventory = validInventory.filter(item => {
                if (item.expiresAt && new Date(item.expiresAt) < now) {
                    inventoryNeedsUpdate = true;
                    return false;
                }
                return true;
            });
            if (inventoryNeedsUpdate) user.inventory = validInventory;
        }

        let updateQuery = { $set: { lastActive: now } };
        let hasReturned = false;

        if (!isNewUser && user.lastActive) {
            const daysSinceLastActive = (now.getTime() - new Date(user.lastActive).getTime()) / (1000 * 60 * 60 * 24);

            if (daysSinceLastActive >= 28) {
                hasReturned = true;

                const doubleStreakDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                updateQuery.$set.doubleStreakUntil = doubleStreakDate;
                user.doubleStreakUntil = doubleStreakDate;

                const existingHype = validInventory.find(item => item.itemId === 'hype_free');
                if (existingHype) {
                    existingHype.itemCount = (existingHype.itemCount || 1) + 2;
                } else {
                    validInventory.push({
                        itemId: `hype_free`, name: `Free Hype`, category: 'HYPE', rarity: 'RARE',
                        hypeType: 'FREE', visualConfig: { primaryColor: '#22c55e', isAnimated: false },
                        itemCount: 2, acquiredAt: now, expiresAt: null, isConsumable: true
                    });
                }
                inventoryNeedsUpdate = true;

                user.unlockedTitles = user.unlockedTitles || [];
                const hasResurrectedTitle = user.unlockedTitles.some(t => t.name === 'Resurrected');

                if (!hasResurrectedTitle) {
                    const resTitle = { name: 'Resurrected', tier: 'Epic' };
                    user.unlockedTitles.push(resTitle);
                    user.equippedTitle = resTitle;
                    updateQuery.$set.unlockedTitles = user.unlockedTitles;
                    updateQuery.$set.equippedTitle = resTitle;
                }
            }
        }

        if (pushToken) updateQuery.$set.pushToken = pushToken;
        if (platform) updateQuery.$set.platform = platform;
        if (inventoryNeedsUpdate) updateQuery.$set.inventory = validInventory;

        const lastLogEntry = user?.activityLog?.[user.activityLog?.length - 1];
        const shouldLog = isNewUser || !lastLogEntry || new Date(lastLogEntry) < oneHourAgo;

        if (shouldLog) {
            updateQuery.$inc = { appOpens: 1 };
            let newActivityLog = user.activityLog || [];
            newActivityLog.push(now);
            newActivityLog = newActivityLog.filter(date => new Date(date) >= sixtyDaysAgo);
            updateQuery.$set.activityLog = newActivityLog;
        }

        // =======================================================================
        // ⚡️ HOISTED CLAN DATA & VISIBILITY CLEARANCE ENGINE
        // =======================================================================
        let userClanData = null;
        let allowedClanTagsArray = [];

        if (user._id) {
            const [clan, followedClans] = await Promise.all([
                Clan.findOne({
                    $or: [{ leader: user._id }, { viceLeader: user._id }, { members: user._id }]
                }).select("tag name leader rank viceLeader spendablePoints joinRequests latestMessage messages").lean(),
                ClanFollower.find({ userId: user._id }).select("clanTag").lean()
            ]);

            const allowedClanTags = new Set();

            if (clan) {
                allowedClanTags.add(clan.tag); // Add user's primary clan

                let userRole = "member";
                if (clan.leader?.toString() === user._id.toString()) userRole = "leader";
                else if (clan.viceLeader?.toString() === user._id.toString()) userRole = "viceleader";

                const [pendingWars, negotiatingWars] = await Promise.all([
                    ClanWar.countDocuments({ status: 'PENDING', defenderTag: clan.tag }),
                    ClanWar.countDocuments({ status: 'NEGOTIATING', $or: [{ challengerTag: clan.tag }, { defenderTag: clan.tag }] })
                ]);

                userClanData = {
                    tag: clan.tag,
                    name: clan.name,
                    role: userRole,
                    clanId: clan._id,
                    rank: clan.rank,
                    cCoins: clan.spendablePoints || 0,
                    fullData: clan.joinRequests?.length || 0,
                    latestMessageAt: clan.latestMessage?.createdAt || clan.messages?.[clan.messages?.length - 1]?.date || null,
                    totalWarActions: pendingWars + negotiatingWars
                };
            }

            // Add all followed clans to clearance
            followedClans.forEach(f => allowedClanTags.add(f.clanTag));
            allowedClanTagsArray = Array.from(allowedClanTags);
        }

        // ⚡️ THE MASTER SECURITY FILTER
        const eventVisibilityFilter = {
            $or: [
                { visibility: "PUBLIC" },
                { visibility: { $exists: false } }, // Failsafe for legacy docs
                { visibility: "PRIVATE", clanId: { $in: allowedClanTagsArray } }, // Clearance granted
                { leaderDeviceId: deviceId }, // Creator override
                { moderatedBy: deviceId }     // Mod override
            ]
        };

        const audienceConditions = [{ targetAudience: 'global' }];
        if (user._id) audienceConditions.push({ targetAudience: 'user', targetId: user._id.toString() });
        if (deviceId) audienceConditions.push({ targetAudience: 'user', targetId: deviceId });
        if (clanId) audienceConditions.push({ targetAudience: 'clan', targetId: clanId });

        const [
            updateResult,
            streakDoc,
            versionConfig,
            activeShoutouts,
            activeQuizzes,
            activeTournaments,
            activePills
        ] = await Promise.all([
            MobileUser.updateOne({ _id: user._id }, updateQuery),
            UserStreak.findOne({ userId: user._id }).lean(),
            VersionModel.findOne({ key: 'latest_app_version' }).lean(),
            ShoutoutEvent.find({ expiresAt: { $gt: now }, ...eventVisibilityFilter }).lean(),
            QuizEvent.find({ status: { $in: ["COMING_SOON", "LIVE"] }, ...eventVisibilityFilter }).lean(),
            Tournament.find({ status: { $in: ["REGISTRATION", "LIVE"] }, ...eventVisibilityFilter }).lean(),
            MessagePillModel.aggregate([
                { $match: { isActive: true, $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }, { $or: audienceConditions }] } },
                { $sort: { priority: -1, createdAt: -1 } },
                { $group: { _id: { $cond: { if: { $and: [{ $ne: ["$groupId", null] }, { $ne: ["$groupId", ""] }] }, then: { $concat: ["group_", "$groupId"] }, else: { $concat: ["typelink_", "$type", "_", { $ifNull: ["$link", "nolink"] }] } } }, doc: { $first: "$$ROOT" } } },
                { $replaceRoot: { newRoot: "$doc" } },
                { $sort: { priority: -1, createdAt: -1 } },
                { $limit: 25 }
            ])
        ]);

        const allModDeviceIds = new Set();
        [...activeShoutouts, ...activeQuizzes, ...activeTournaments].forEach(event => {
            if (event.moderatedBy) {
                event.moderatedBy.forEach(id => allModDeviceIds.add(id));
            }
        });

        const moderatorUsers = await MobileUser.find({
            deviceId: { $in: Array.from(allModDeviceIds) }
        }, 'deviceId username profilePic country').lean();

        const modMap = {};
        moderatorUsers.forEach(mod => {
            modMap[mod.deviceId] = {
                deviceId: mod.deviceId,
                username: mod.username,
                country: mod.country,
                profilePic: mod.profilePic || null
            };
        });

        const formattedShoutouts = activeShoutouts.map(e => ({
            ...e,
            id: e._id.toString(),
            type: "SHOUTOUT",
            imageUrl: e.media?.url || null,
            targetUrl: e.externalLink || null,
            isModerator: e.leaderDeviceId === deviceId || (e.moderatedBy || []).includes(deviceId),
            moderatorDetails: (e.moderatedBy || []).map(id => modMap[id]).filter(Boolean),
            startsAt: e.createdAt,
            endsAt: e.expiresAt,
            status: "active"
        }));

        const formattedQuizzes = activeQuizzes.map(e => {
            const isCompleted = e.status === "COMPLETED" || e.status === "CANCELLED";
            const isModerator = e.leaderDeviceId === deviceId || (e.moderatedBy || []).includes(deviceId);

            const safeQuestions = (e.quizQuestions || []).map(q => {
                const safeQ = { ...q };
                if (!isCompleted && !isModerator) {
                    delete safeQ.correctOptionIndex;
                }
                return safeQ;
            });

            const userEntry = (e.leaderboard || []).find(l => l.deviceId === deviceId);
            const userResponses = userEntry?.responses || [];
            const prefilledAnswers = {};
            userResponses.forEach(r => {
                prefilledAnswers[r.questionIndex] = r.selectedOptionIndex;
            });

            return {
                ...e,
                id: e._id.toString(),
                type: "QUIZ",
                isModerator,
                moderatorDetails: (e.moderatedBy || []).map(id => modMap[id]).filter(Boolean),
                startsAt: e.scheduledStartTime,
                endsAt: e.expiresAt,
                status: e.status.toLowerCase(),
                quizQuestions: safeQuestions,
                currentStreamIndex: e.currentStreamIndex ?? 0,
                deliveryMode: e.deliveryMode || "BATCH",
                streamGapMinutes: e.streamGapMinutes || null,
                acknowledgeCount: e.acknowledgeCount || 0,
                acknowledgedBy: e.acknowledgedBy || [],
                participants: e.participants || [],
                leaderboard: [...(e.leaderboard || [])]
                    .sort((a, b) => b.score - a.score),
                userResponses: prefilledAnswers
            };
        });

        const formattedTournaments = activeTournaments.map(tournament => {
            const today = new Date();
            const startOfWeek = new Date(today);
            const day = startOfWeek.getDay();
            const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
            startOfWeek.setDate(diff);
            startOfWeek.setHours(0, 0, 0, 0);

            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            const weeklyMatches = tournament.matches.filter(m => new Date(m.scheduledAt) >= startOfWeek);
            const monthlyMatches = tournament.matches.filter(m => new Date(m.scheduledAt) >= startOfMonth);

            const aggregateMatches = (matchesToAggregate) => {
                const calcMap = {};
                matchesToAggregate.forEach(matchItem => {
                    if (matchItem.status !== "COMPLETED" || !matchItem.trackPerformance || !matchItem.results) return;
                    matchItem.results.forEach((res) => {
                        if (!calcMap[res.targetId]) {
                            calcMap[res.targetId] = {
                                targetId: res.targetId,
                                displayName: res.displayName,
                                totalMatchesPlayed: 0,
                                totalKills: 0,
                                highestPlacement: res.position,
                                finalAccumulatedScore: 0
                            };
                        }
                        const cache = calcMap[res.targetId];
                        cache.totalMatchesPlayed += 1;
                        cache.totalKills += res.kills;
                        cache.finalAccumulatedScore += res.calculatedScore;
                        if (res.position < cache.highestPlacement) cache.highestPlacement = res.position;
                    });
                });

                return Object.values(calcMap).sort((a, b) => {
                    if (b.finalAccumulatedScore !== a.finalAccumulatedScore) {
                        return b.finalAccumulatedScore - a.finalAccumulatedScore;
                    }

                    if (a.highestPlacement !== b.highestPlacement) {
                        return a.highestPlacement - b.highestPlacement;
                    }

                    return b.totalKills - a.totalKills;
                });
            };

            const weeklyLeaderboard = aggregateMatches(weeklyMatches);
            const monthlyLeaderboard = aggregateMatches(monthlyMatches);

            const enrichedMatches = tournament.matches.map(match => {
                let matchLeaderboard = [];
                if (match.status === "COMPLETED") {
                    matchLeaderboard = [...match.results].sort((a, b) => {
                        if (b.calculatedScore !== a.calculatedScore) {
                            return b.calculatedScore - a.calculatedScore;
                        }

                        if (a.position !== b.position) {
                            return a.position - b.position;
                        }

                        return b.kills - a.kills;
                    });
                } else {
                    matchLeaderboard = match.participants.map(player => ({
                        targetId: player.deviceId,
                        displayName: player.username,
                        position: "-",
                        kills: 0,
                        calculatedScore: 0
                    }));
                }
                return { ...match, liveMatchLeaderboard: matchLeaderboard, results: matchLeaderboard, };
            });

            return {
                ...tournament,
                id: tournament._id.toString(),
                type: "TOURNAMENT",
                isModerator: tournament.leaderDeviceId === deviceId || (tournament.moderatedBy || []).includes(deviceId),
                moderatorDetails: (tournament.moderatedBy || []).map(id => modMap[id]).filter(Boolean),
                status: tournament.status.toLowerCase(),
                matches: enrichedMatches,
                weeklyLeaderboard,
                monthlyLeaderboard
            };
        });

        const dynamicEvents = [...formattedShoutouts, ...formattedQuizzes, ...formattedTournaments];
        const systemVersion = versionConfig || { appVersion: "1.0.0", runtimeVersion: "v1", critical: false };

        const safeInventoryPayload = validInventory.map(item => {
            const safeItem = item.toObject ? item.toObject() : { ...item };
            if (safeItem.visualConfig) { safeItem.visualConfig = { ...safeItem.visualConfig }; delete safeItem.visualConfig.svgCode; }
            if (safeItem.visualData) { safeItem.visualData = { ...safeItem.visualData }; delete safeItem.visualData.svgCode; }
            return safeItem;
        });

        let referredClan = null;
        if (referredBy) {
            const referrer = await MobileUser.findOne({ referralCode: referredBy }).lean();
            if (referrer) {
                const clan = await Clan.findOne({
                    $or: [{ leader: referrer._id }, { viceLeader: referrer._id }, { members: referrer._id }]
                }).lean();

                if (clan) {
                    let isAlreadyFollowingOrMember = false;

                    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
                        const followerRecord = await ClanFollower.findOne({ clanTag: clan.tag, userId: userId }).lean();
                        if (followerRecord) isAlreadyFollowingOrMember = true;

                        if (!isAlreadyFollowingOrMember) {
                            if (clan.leader?.toString() === userId || clan.viceLeader?.toString() === userId || clan.members?.some(m => m.toString() === userId)) {
                                isAlreadyFollowingOrMember = true;
                            }
                        }
                    }

                    if (!isAlreadyFollowingOrMember) {
                        const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];
                        let hash = 0;
                        for (let i = 0; i < clan.tag.length; i++) { hash = clan.tag.charCodeAt(i) + ((hash << 5) - hash); }
                        const dynamicColor = colors[Math.abs(hash) % colors.length];

                        referredClan = {
                            name: clan.name,
                            tag: clan.tag,
                            description: clan.description || "You've been linked via a direct alliance referral. Sync immediately to access dedicated pools and shared clan multipliers.",
                            color: dynamicColor,
                            rank: clan.rank || 1,
                            referrerName: referrer.username || "Unknown Author",
                            referrerImage: referrer.profilePic?.url || null
                        };
                    }
                }
            }
        }

        return addCorsHeaders(NextResponse.json({
            success: true,
            system: { appVersion: systemVersion.appVersion, runtimeVersion: systemVersion.runtimeVersion, critical: systemVersion.critical },
            activity: { recorded: shouldLog, pushTokenUpdated: !!pushToken, hasReturned },
            user: { ...user, country: user.country || "Unknown", securityLevel: user.securityLevel || 0, inventory: safeInventoryPayload },
            coins: {
                balance: user.coins || 0, tokens: user.tokens || 0, clanBalance: user.clanCoins || 0, totalPurchasedCoins: user.totalPurchasedCoins || 0,
                peakLevel: calculatePeakLevel(user.totalPurchasedCoins || 0), doubleStreakUntil: user.doubleStreakUntil || null
            },
            streak: {
                streak: streakDoc?.streak || 0, lastPostDate: streakDoc?.lastPostDate || null, expiresAt: streakDoc?.expiresAt || null,
                frozenUntil: streakDoc?.frozenUntil || null, canRestore: !streakDoc && (user.lastStreak > 0), recoverableStreak: user.lastStreak || 0
            },
            events: dynamicEvents,
            referredClan,
            pills: activePills,
            userClan: userClanData
        }));

    } catch (err) {
        console.error("Bootstrap Error:", err);
        return addCorsHeaders(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }));
    }
}