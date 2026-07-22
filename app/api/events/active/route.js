import connectDB from "@/app/lib/mongodb";
import ClanFollower from "@/app/models/ClanFollower";
import Clan from '@/app/models/ClanModel';
import MobileUser from '@/app/models/MobileUserModel';
import QuizEvent from "@/app/models/QuizEvent";
import ShoutoutEvent from "@/app/models/ShoutoutEvent";
import Tournament from "@/app/models/Tournament";
import mongoose from 'mongoose';
import { NextResponse } from 'next/server';

export async function GET(request) {
    await connectDB();
    try {
        const now = new Date();
        const { searchParams } = new URL(request.url);
        const referredBy = searchParams.get('referredBy');
        const userId = searchParams.get('userId');
        const deviceId = searchParams.get('deviceId');

        // =======================================================================
        // ⚡️ RAW EVENTS (MANUAL CONFIG)
        // =======================================================================
        const rawEvents = [
            {
                id: "claim-3k-posts-event",
                type: "CLAIM",
                title: "3K Posts Celebration!",
                description:
                    "Oreblogda has officially reached 3,000 community posts! Thank you for every post, comment, and moment shared. Celebrate this milestone by claiming 100 OC and an exclusive mystery reward. 3,000 posts ago, Oreblogda was just an idea. Today, it's a growing community. Thank you for helping us reach this milestone!",
                isSystem: true,
                rewards: {
                    oc: 100,
                    mysteryItem: true
                },
                startsAt: new Date('2026-07-22T19:00:00Z').toISOString(),
                themeColor: '#F59E0B',
                endsAt: new Date('2026-07-25T23:59:59Z').toISOString(),
                visibility: "PUBLIC"
            }
        ];
        const activeEvents = rawEvents
            .filter(event => (event.endsAt ? new Date(event.endsAt) > now : true))
            .map(event => {
                let isComing = false;
                let currentStatus = 'active';
                if (event.startsAt && new Date(event.startsAt) > now) {
                    isComing = true;
                    currentStatus = 'coming_soon';
                }
                return { ...event, isComing, status: currentStatus };
            });

        // =======================================================================
        // ⚡️ VISIBILITY CLEARANCE ENGINE
        // =======================================================================
        let allowedClanTagsArray = [];

        if (deviceId && userId && mongoose.Types.ObjectId.isValid(userId)) {
            const [clan, followedClans] = await Promise.all([
                Clan.findOne({
                    $or: [{ leader: userId }, { viceLeader: userId }, { members: userId }]
                }).select("tag").lean(),
                ClanFollower.find({ userId: userId }).select("clanTag").lean()
            ]);

            const allowedClanTags = new Set();
            if (clan) allowedClanTags.add(clan.tag);
            followedClans.forEach(f => allowedClanTags.add(f.clanTag));
            allowedClanTagsArray = Array.from(allowedClanTags);
        }

        // ⚡️ THE MASTER SECURITY FILTER
        const eventVisibilityFilter = {
            $or: [
                { visibility: "PUBLIC" },
                { visibility: { $exists: false } },
                { visibility: "PRIVATE", clanId: { $in: allowedClanTagsArray } },
                { leaderDeviceId: deviceId },
                { moderatedBy: deviceId }
            ]
        };

        // =======================================================================
        // ⚡️ FETCH LIVE SECURE DATABASE EVENTS
        // =======================================================================
        const [activeShoutouts, activeQuizzes, activeTournaments] = await Promise.all([
            ShoutoutEvent.find({ expiresAt: { $gt: now }, ...eventVisibilityFilter }).lean(),
            QuizEvent.find({ status: { $in: ["COMING_SOON", "LIVE", "COMPLETED", "CANCELLED"] }, ...eventVisibilityFilter }).lean(),
            Tournament.find({ status: { $in: ["REGISTRATION", "LIVE", "COMPLETED"] }, ...eventVisibilityFilter }).lean()
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

        const allDynamicEvents = [...activeEvents, ...formattedShoutouts, ...formattedQuizzes, ...formattedTournaments];

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
                        const followerRecord = await mongoose.models.ClanFollower.findOne({ clanTag: clan.tag, userId: userId }).lean();
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

        return NextResponse.json({
            success: true,
            events: allDynamicEvents,
            referredClan
        });

    } catch (error) {
        console.error("Failed to fetch active events:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}