import { sendPillParallel } from "@/app/lib/messagePillService";
import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import Tournament from "@/app/models/Tournament";
import { NextResponse } from "next/server";

// ⚡️ HELPER: Single source of truth for rebuilding the global leaderboard
function rebuildLeaderboard(tournament) {
    const aggregateCalcMap = {};
    tournament.matches.forEach((matchItem) => {
        if (!matchItem.trackPerformance || !matchItem.results) return;
        matchItem.results.forEach((res) => {
            if (!aggregateCalcMap[res.targetId]) {
                aggregateCalcMap[res.targetId] = {
                    targetId: res.targetId,
                    displayName: res.displayName,
                    totalMatchesPlayed: 0,
                    totalKills: 0,
                    highestPlacement: res.position,
                    finalAccumulatedScore: 0
                };
            }
            const cache = aggregateCalcMap[res.targetId];
            cache.totalMatchesPlayed += 1;
            cache.totalKills += res.kills;
            cache.finalAccumulatedScore += res.calculatedScore;
            if (res.position < cache.highestPlacement) cache.highestPlacement = res.position;
        });
    });
    return Object.values(aggregateCalcMap).sort((a, b) => b.finalAccumulatedScore - a.finalAccumulatedScore);
}

export async function POST(req) {
    await connectDB();
    try {
        const body = await req.json();
        const { clanId, title, description, visibility, gameName, formatType, teamFormat, groupingId, leaderboardWeights } = body;

        const deviceId = req.headers.get("x-user-deviceId");
        if (!deviceId) return NextResponse.json({ message: "Authentication missing." }, { status: 401 });
        if (!clanId || !title) return NextResponse.json({ message: "Missing required details." }, { status: 400 });

        const targetClan = await Clan.findOne({ tag: clanId }).lean();
        const targetLeader = await MobileUser.findOne({ deviceId }).lean();

        if (!targetClan) return NextResponse.json({ message: "Clan not found." }, { status: 404 });

        if (!targetLeader || targetLeader.deviceId !== deviceId) {
            return NextResponse.json({ message: "Access Denied: Only Leaders can do this." }, { status: 403 });
        }

        if (!targetClan.verifiedClan) {
            return NextResponse.json({ message: "This feature is currently locked for Prime Clans only." }, { status: 403 });
        }

        const upperFormat = formatType?.toUpperCase() === "LEAGUE" ? "LEAGUE" : "SINGLE_MATCH";

        if (visibility?.toUpperCase() === "PUBLIC") {
            const activePublicCount = await Tournament.countDocuments({
                visibility: "PUBLIC",
                formatType: upperFormat,
                status: { $in: ["REGISTRATION", "LIVE"] }
            });
            if (activePublicCount >= 5) {
                return NextResponse.json({ message: `The global limit for public ${upperFormat} events (5) has been reached. Try again later or set visibility to PRIVATE.` }, { status: 429 });
            }
        }

        if (upperFormat === "LEAGUE") {
            const leagueConflict = await Tournament.findOne({ clanId, formatType: "LEAGUE", status: { $in: ["REGISTRATION", "LIVE"] } }).lean();
            if (leagueConflict) return NextResponse.json({ message: "An active League is already running for your clan." }, { status: 409 });
        }

        const initialMatches = [];
        if (upperFormat === "SINGLE_MATCH") {
            initialMatches.push({
                matchNumber: 1,
                matchName: "Match 1",
                status: "PENDING",
                scheduledAt: new Date(),
                trackPerformance: body.trackPerformance !== undefined ? body.trackPerformance : true,
                lobbyConfig: { roomId: null, roomPin: null, additionalInstructions: null },
                participants: [],
                results: []
            });
        }

        const maxLifespan = new Date(Date.now() + (upperFormat === "LEAGUE" ? 30 * 24 : 48) * 60 * 60 * 1000);

        const newTournament = await Tournament.create({
            clanId, clanName: targetClan.name, leaderDeviceId: deviceId, moderatedBy: [deviceId],
            title, description, visibility: visibility?.toUpperCase() === "PRIVATE" ? "PRIVATE" : "PUBLIC",
            gameName: gameName || "Bloodstrike", formatType: upperFormat, teamFormat: teamFormat?.toUpperCase() === "TEAM" ? "TEAM" : "SOLO",
            status: "REGISTRATION", groupingId: upperFormat === "SINGLE_MATCH" ? (groupingId || null) : null,
            expiresAt: maxLifespan,
            leaderboardWeights: leaderboardWeights || { pointsPerKill: 1, pointsPerMatchPlayed: 0, placementScoring: { "1": 15, "2": 12, "3": 10, "4": 8, "5": 6 } },
            matches: initialMatches, liveLeaderboard: [], participants: [], blacklistedDeviceIds: []
        });

        return NextResponse.json({ success: true, data: newTournament }, { status: 201 });
    } catch (err) {
        console.error("⛔ TOURNAMENT_POST_FAIL:", err);
        return NextResponse.json({ message: "Server error during creation." }, { status: 500 });
    }
}

export async function PATCH(req) {
    await connectDB();
    try {
        const body = await req.json();
        const { eventId, action, matchNumber, matchName, username, teamName, ...payload } = body;

        const deviceId = req.headers.get("x-user-deviceId");
        if (!deviceId) return NextResponse.json({ message: "Authentication missing." }, { status: 401 });
        if (!eventId || !action) return NextResponse.json({ message: "Missing request details." }, { status: 400 });

        const tournament = await Tournament.findById(eventId);
        if (!tournament) return NextResponse.json({ message: "Tournament not found." }, { status: 404 });

        const isLeader = tournament.leaderDeviceId === deviceId;
        const isModerator = tournament.moderatedBy.includes(deviceId);

        switch (action.toUpperCase()) {
            case "REGISTER_MATCH": {
                if (tournament.status === "COMPLETED" || tournament.status === "CANCELLED") {
                    return NextResponse.json({ message: "Tournament has already concluded." }, { status: 400 });
                }

                if (!matchNumber || !username) return NextResponse.json({ message: "Match number and Player Name required." }, { status: 400 });
                if (tournament.blacklistedDeviceIds.includes(deviceId)) return NextResponse.json({ message: "You are restricted from joining this event." }, { status: 403 });

                const targetMatch = tournament.matches.find(m => m.matchNumber === matchNumber);
                if (!targetMatch) return NextResponse.json({ message: "Match not found." }, { status: 404 });
                if (targetMatch.status !== "REGISTRATION") return NextResponse.json({ message: "Registration is not open for this match." }, { status: 400 });

                if (targetMatch.participants.find(p => p.deviceId === deviceId)) return NextResponse.json({ message: "Already registered for this match." }, { status: 409 });
                targetMatch.participants.push({ deviceId, username, teamName: teamName || null });

                if (!tournament.participants.find(p => p.deviceId === deviceId)) {
                    tournament.participants.push({ deviceId, username, teamName: teamName || null });
                }

                await tournament.save();
                return NextResponse.json({ success: true, message: `Registered for ${targetMatch.matchName || `Match ${matchNumber}`}!` }, { status: 200 });
            }

            case "UPDATE_MODERATORS": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });
                if (payload.moderators && Array.isArray(payload.moderators)) {
                    let newMods = payload.moderators;
                    if (!newMods.includes(tournament.leaderDeviceId)) newMods.push(tournament.leaderDeviceId);
                    tournament.moderatedBy = newMods;
                    await tournament.save();
                }
                return NextResponse.json({ success: true, message: "Moderators updated." }, { status: 200 });
            }

            case "UPDATE_TOURNAMENT": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });
                if (payload.title) tournament.title = payload.title;
                if (payload.description) tournament.description = payload.description;
                if (payload.gameName) tournament.gameName = payload.gameName;
                if (payload.leaderboardWeights) tournament.leaderboardWeights = payload.leaderboardWeights;
                await tournament.save();
                return NextResponse.json({ success: true, message: "Settings saved." }, { status: 200 });
            }

            case "ADD_MATCH": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });
                if (tournament.formatType !== "LEAGUE") return NextResponse.json({ message: "Cannot add matches to a single event." }, { status: 400 });
                if (tournament.status === "COMPLETED" || tournament.status === "CANCELLED") return NextResponse.json({ message: "Cannot add matches to a concluded league." }, { status: 400 });

                const nextNumber = tournament.matches.length > 0
                    ? Math.max(...tournament.matches.map(m => m.matchNumber)) + 1
                    : 1;

                tournament.matches.push({
                    matchNumber: nextNumber,
                    matchName: matchName || `Match ${nextNumber}`,
                    status: "PENDING",
                    scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : new Date(),
                    trackPerformance: payload.trackPerformance !== undefined ? payload.trackPerformance : true,
                    lobbyConfig: { roomId: null, roomPin: null, additionalInstructions: null },
                    participants: [], results: []
                });

                await tournament.save();
                return NextResponse.json({ success: true, message: `${matchName || 'New Match'} added to schedule.` }, { status: 200 });
            }

            case "UPDATE_MATCH_CONFIG": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });
                if (!matchNumber) return NextResponse.json({ message: "Match number required." }, { status: 400 });

                const targetMatch = tournament.matches.find(m => m.matchNumber === matchNumber);
                if (!targetMatch) return NextResponse.json({ message: "Match not found." }, { status: 404 });

                if (matchName !== undefined) targetMatch.matchName = matchName;
                if (payload.roomId !== undefined) targetMatch.lobbyConfig.roomId = payload.roomId;
                if (payload.roomPin !== undefined) targetMatch.lobbyConfig.roomPin = payload.roomPin;
                if (payload.additionalInstructions !== undefined) targetMatch.lobbyConfig.additionalInstructions = payload.additionalInstructions;

                let newlyLiveMatch = false;
                let participantIdsForNotification = [];

                if (payload.status && ["PENDING", "REGISTRATION", "LIVE", "COMPLETED", "CANCELLED"].includes(payload.status.toUpperCase())) {
                    const newStatus = payload.status.toUpperCase();

                    if (newStatus === "LIVE" && targetMatch.status !== "LIVE") {
                        newlyLiveMatch = true;
                        participantIdsForNotification = targetMatch.participants.map(p => p.deviceId);
                    }

                    targetMatch.status = newStatus;
                }

                // ⚡️ RELIABILITY FIX: Save DB state first before dispatching notifications
                await tournament.save();

                if (newlyLiveMatch && participantIdsForNotification.length > 0) {
                    try {
                        const users = await MobileUser.find({ deviceId: { $in: participantIdsForNotification }, pushToken: { $ne: null } }).select("deviceId pushToken").lean();
                        const notifyPromises = users.map(u =>
                            // Fixed: Added eventId to the deep link
                            sendPillParallel([u.pushToken], `⚔️ Match LIVE: ${targetMatch.matchName || `Match ${matchNumber}`}`, `The lobby is open! Check the event page for room details.`, { screen: `/screens/events?id=${eventId}` }, { type: 'event', targetAudience: 'user', targetId: u.deviceId, singleUser: true, groupId: `match_${matchNumber}_${eventId}`, expiresInHours: 2 })
                        );
                        await Promise.all(notifyPromises);
                    } catch (e) { console.error("Live match notification error:", e); }
                }

                return NextResponse.json({ success: true, message: `Match details saved.` }, { status: 200 });
            }

            case "DELETE_MATCH": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });
                if (!matchNumber) return NextResponse.json({ message: "Match number required." }, { status: 400 });

                tournament.matches = tournament.matches.filter(m => m.matchNumber !== matchNumber);

                // ⚡️ DRY OPTIMIZATION: Rebuild leaderboard using the unified helper
                tournament.liveLeaderboard = rebuildLeaderboard(tournament);

                await tournament.save();
                return NextResponse.json({ success: true, message: `Match deleted successfully.` }, { status: 200 });
            }

            case "LOG_MATCH_RESULTS": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });
                if (!matchNumber) return NextResponse.json({ message: "Match number required." }, { status: 400 });

                const targetMatch = tournament.matches.find(m => m.matchNumber === matchNumber);
                if (!targetMatch) return NextResponse.json({ message: "Match not found." }, { status: 404 });

                if (targetMatch.status === "COMPLETED") {
                    return NextResponse.json({ message: "Scores for this match are already locked." }, { status: 400 });
                }

                if (targetMatch.status !== "LIVE") return NextResponse.json({ message: "Match must be LIVE to grade players." }, { status: 400 });
                if (!payload.rawResults || !Array.isArray(payload.rawResults)) return NextResponse.json({ message: "Invalid score data." }, { status: 400 });

                const kWeight = tournament.leaderboardWeights?.pointsPerKill ?? 1;
                const mWeight = tournament.leaderboardWeights?.pointsPerMatchPlayed ?? 0;
                const placementScoring = tournament.leaderboardWeights.placementScoring;

                const processedResults = payload.rawResults.map((row) => {
                    const posStr = String(row.position);
                    const positionBonus = placementScoring instanceof Map ? (placementScoring.get(posStr) || 0) : (placementScoring[posStr] || 0);
                    const killBonus = (parseInt(row.kills) || 0) * kWeight;
                    return { targetId: row.targetId, displayName: row.displayName, position: parseInt(row.position), kills: parseInt(row.kills) || 0, calculatedScore: positionBonus + killBonus + mWeight };
                });

                targetMatch.results = processedResults;
                targetMatch.loggedByDeviceId = deviceId;
                targetMatch.loggedAt = new Date();
                targetMatch.status = "COMPLETED";

                // ⚡️ DRY OPTIMIZATION: Rebuild leaderboard using the unified helper
                tournament.liveLeaderboard = rebuildLeaderboard(tournament);

                if (tournament.formatType === "SINGLE_MATCH") {
                    tournament.status = "COMPLETED";
                    tournament.expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
                }

                await tournament.save();

                const participantIds = targetMatch.participants.map(p => p.deviceId);
                if (participantIds.length > 0) {
                    try {
                        const users = await MobileUser.find({ deviceId: { $in: participantIds }, pushToken: { $ne: null } }).select("deviceId pushToken").lean();
                        const notifyPromises = users.map(u =>
                            // Fixed: Added eventId to the deep link
                            sendPillParallel([u.pushToken], `🏆 Match Concluded`, `Scores for ${targetMatch.matchName || `Match ${matchNumber}`} are in! Check your standings.`, { screen: `/screens/events?id=${eventId}` }, { type: 'event', targetAudience: 'user', targetId: u.deviceId, singleUser: true, groupId: `res_${matchNumber}_${eventId}`, expiresInHours: 6 })
                        );
                        await Promise.all(notifyPromises);
                    } catch (e) { console.error("Match result notification error:", e); }
                }

                return NextResponse.json({ success: true, message: "Scores locked in successfully." }, { status: 200 });
            }

            case "BLACKLIST_USER": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });
                const { targetDeviceId } = payload;
                if (!targetDeviceId) return NextResponse.json({ message: "Target player ID required." }, { status: 400 });

                if (!tournament.blacklistedDeviceIds.includes(targetDeviceId)) tournament.blacklistedDeviceIds.push(targetDeviceId);

                tournament.participants = tournament.participants.filter(p => p.deviceId !== targetDeviceId);
                tournament.matches.forEach(match => {
                    if (match.status === "PENDING" || match.status === "REGISTRATION") {
                        match.participants = match.participants.filter(p => p.deviceId !== targetDeviceId);
                    }
                });

                await tournament.save();
                return NextResponse.json({ success: true, message: "Player removed and banned from league." }, { status: 200 });
            }

            case "TERMINATE": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });

                tournament.status = "CANCELLED";
                tournament.expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

                await tournament.save();
                return NextResponse.json({ success: true, message: "Event cancelled successfully." }, { status: 200 });
            }

            case "SET_TOURNAMENT_STATUS": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });
                if (!["REGISTRATION", "LIVE", "COMPLETED", "CANCELLED"].includes(payload.status?.toUpperCase())) return NextResponse.json({ message: "Invalid status." }, { status: 400 });
                tournament.status = payload.status.toUpperCase();
                await tournament.save();
                return NextResponse.json({ success: true, currentStatus: tournament.status }, { status: 200 });
            }

            default: return NextResponse.json({ message: "Unknown action." }, { status: 400 });
        }
    } catch (err) {
        console.error("⛔ TOURNAMENT_PATCH_CRASH:", err);
        return NextResponse.json({ message: "Server error during update." }, { status: 500 });
    }
}