import { sendPillParallel } from "@/app/lib/messagePillService";
import connectDB from "@/app/lib/mongodb";
import ClanFollower from "@/app/models/ClanFollower";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import QuizEvent from "@/app/models/QuizEvent";
import { NextResponse } from "next/server";

export async function POST(req) {
    await connectDB();
    try {
        const body = await req.json();
        const { clanId, title, description, visibility, deliveryMode, streamGapMinutes, scheduledStartTime, quizQuestions } = body;

        const deviceId = req.headers.get("x-user-deviceId");
        if (!deviceId) return NextResponse.json({ message: "Authentication missing." }, { status: 401 });
        if (!clanId || !title || !description || !scheduledStartTime) return NextResponse.json({ message: "Missing primary details." }, { status: 400 });

        const targetClan = await Clan.findOne({ tag: clanId }).lean();
        const targetLeader = await MobileUser.findOne({ deviceId }).lean();

        if (!targetClan) return NextResponse.json({ message: "Clan not found." }, { status: 404 });
        if (targetLeader.deviceId !== deviceId) return NextResponse.json({ message: "Access Denied: Only Clan Leaders." }, { status: 403 });

        const duplicateConflict = await QuizEvent.findOne({ clanId, status: { $in: ["COMING_SOON", "LIVE"] } }).lean();
        if (duplicateConflict) return NextResponse.json({ message: "Your clan already has an active Quiz." }, { status: 409 });

        const now = new Date();
        const scheduledTime = new Date(scheduledStartTime);
        const maxLifespan = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        if (scheduledTime < now || scheduledTime > maxLifespan) return NextResponse.json({ message: "Start time must be within the next 24 hours." }, { status: 400 });

        const newQuiz = await QuizEvent.create({
            clanId, clanName: targetClan.name, leaderDeviceId: deviceId, moderatedBy: [deviceId],
            title, description, visibility: visibility?.toUpperCase() === "PRIVATE" ? "PRIVATE" : "PUBLIC",
            status: "COMING_SOON", deliveryMode: deliveryMode === "STREAMED" ? "STREAMED" : "BATCH",
            streamGapMinutes: deliveryMode === "STREAMED" ? Math.min(parseInt(streamGapMinutes) || 5, 15) : null,
            scheduledStartTime: scheduledTime, expiresAt: maxLifespan, quizQuestions: quizQuestions || [],
            leaderboard: [], participants: [], blacklistedDeviceIds: [], acknowledgeCount: 0, acknowledgedBy: []
        });

        return NextResponse.json({ success: true, data: newQuiz }, { status: 201 });
    } catch (err) {
        console.error("⛔ QUIZ_CREATION_CRASH:", err);
        return NextResponse.json({ message: "Server error during creation." }, { status: 500 });
    }
}

export async function PATCH(req) {
    await connectDB();
    try {
        const body = await req.json();
        const { eventId, action, username, userAnswers, answerIndex, questionIndex, ...payload } = body;

        const deviceId = req.headers.get("x-user-deviceId");
        if (!deviceId) return NextResponse.json({ message: "Authentication missing." }, { status: 401 });
        if (!eventId || !action) return NextResponse.json({ message: "Missing request details." }, { status: 400 });

        const event = await QuizEvent.findById(eventId);
        if (!event) return NextResponse.json({ message: "Quiz not found." }, { status: 404 });

        const now = new Date();
        if (event.status !== "COMPLETED" && event.status !== "CANCELLED") {
            const isTimeUp = event.endsAt && now > event.endsAt;
            const hasExceededFailsafe = now > event.expiresAt;

            if (isTimeUp || hasExceededFailsafe) {
                event.status = event.quizQuestions.length > 0 && event.status === "LIVE" ? "COMPLETED" : "CANCELLED";
                event.expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);
                await event.save();
                return NextResponse.json({ message: "This quiz has concluded." }, { status: 410 });
            }
        }

        if (event.visibility === "PRIVATE") {
            const isFollower = await ClanFollower.findOne({ userId: deviceId, clanTag: event.clanId }).lean();
            const targetClan = await Clan.findById(event.clanId).lean();
            const isMember = targetClan?.members?.includes(deviceId) || targetClan?.leader === deviceId;
            if (!isFollower && !isMember) return NextResponse.json({ message: "Access Denied: Clan clearance required." }, { status: 403 });
        }

        const isLeader = event.leaderDeviceId === deviceId;
        const isModerator = event.moderatedBy.includes(deviceId);

        switch (action.toUpperCase()) {
            case "UPDATE_MODERATORS": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });
                if (payload.moderators && Array.isArray(payload.moderators)) {
                    let newMods = payload.moderators;
                    if (!newMods.includes(event.leaderDeviceId)) newMods.push(event.leaderDeviceId);
                    event.moderatedBy = newMods;
                    await event.save();
                }
                return NextResponse.json({ success: true, message: "Staff updated." }, { status: 200 });
            }

            case "UPDATE_QUIZ": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });
                if (event.status !== "COMING_SOON") return NextResponse.json({ message: "Cannot modify an active quiz." }, { status: 400 });

                if (payload.title) event.title = payload.title;
                if (payload.description) event.description = payload.description;
                if (payload.deliveryMode) event.deliveryMode = payload.deliveryMode;
                if (payload.streamGapMinutes !== undefined) event.streamGapMinutes = Math.min(payload.streamGapMinutes, 15);

                if (payload.quizQuestions && Array.isArray(payload.quizQuestions)) {
                    if (payload.quizQuestions.length > event.maxQuestions) return NextResponse.json({ message: `Max allowed questions is ${event.maxQuestions}.` }, { status: 400 });
                    event.quizQuestions = payload.quizQuestions;
                }

                await event.save();
                return NextResponse.json({ success: true, message: "Settings updated." }, { status: 200 });
            }

            case "ACKNOWLEDGE": {
                if (event.status !== "COMING_SOON") return NextResponse.json({ message: "Sign-up period is over." }, { status: 400 });
                if (event.acknowledgedBy.includes(deviceId)) return NextResponse.json({ message: "You have already joined." }, { status: 409 });
                if (event.blacklistedDeviceIds?.includes(deviceId)) return NextResponse.json({ message: "You are banned from this event." }, { status: 403 });

                event.acknowledgedBy.push(deviceId);
                event.acknowledgeCount += 1;

                const user = await MobileUser.findOne({ deviceId }).lean();
                if (user && !event.participants.find(p => p.deviceId === deviceId)) {
                    event.participants.push({ deviceId, username: user.username });
                    event.leaderboard.push({ deviceId, username: user.username, score: 0, answeredQuestionIndexes: [], responses: [] });
                }

                await event.save();
                return NextResponse.json({ success: true, message: "You joined the quiz!" }, { status: 200 });
            }

            case "START_QUIZ": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });
                if (event.status !== "COMING_SOON") return NextResponse.json({ message: "Quiz cannot be started now." }, { status: 400 });
                if (event.quizQuestions.length === 0) return NextResponse.json({ message: "Cannot start an empty quiz." }, { status: 400 });

                event.status = "LIVE";
                event.startedAt = now;
                event.endsAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

                if (event.deliveryMode === "STREAMED") {
                    event.currentStreamIndex = 0;
                    event.quizQuestions[0].releasedAt = now;
                    if (event.quizQuestions.length > 1 && event.streamGapMinutes) {
                        event.quizQuestions[1].releasedAt = new Date(now.getTime() + event.streamGapMinutes * 60 * 1000);
                    }
                }

                await event.save();

                if (event.acknowledgedBy && event.acknowledgedBy.length > 0) {
                    try {
                        const registeredUsers = await MobileUser.find({ deviceId: { $in: event.acknowledgedBy }, pushToken: { $ne: null } }).select("deviceId pushToken").lean();
                        const notifyPromises = registeredUsers.map(u =>
                            sendPillParallel([u.pushToken], `🟢 Quiz LIVE: ${event.title}`, `The quiz in ${event.clanName} has just started! Jump in now to secure your spot.`, { screen: "/screens/referralevent" }, { type: 'event', targetAudience: 'user', targetId: u.deviceId, singleUser: true, groupId: event._id.toString(), expiresInHours: 2 })
                        );
                        await Promise.all(notifyPromises);
                    } catch (notifyErr) {
                        console.error("Failed to send quiz start notifications:", notifyErr);
                    }
                }
                return NextResponse.json({ success: true, message: "Quiz is now LIVE!" }, { status: 200 });
            }

            case "SUBMIT_ENTRY": {
                if (event.status !== "LIVE") return NextResponse.json({ message: "Quiz is not accepting answers." }, { status: 400 });
                if (!username?.trim()) return NextResponse.json({ message: "Missing player name." }, { status: 400 });

                let userEntry = event.leaderboard.find(l => l.deviceId === deviceId);
                if (!userEntry) {
                    event.leaderboard.push({ deviceId, username: username.trim(), score: 0, answeredQuestionIndexes: [], responses: [] });
                    userEntry = event.leaderboard[event.leaderboard.length - 1];
                }
                if (!userEntry.responses) userEntry.responses = []; // Failsafe for legacy entries

                if (event.deliveryMode === "BATCH") {
                    if (userEntry.answeredQuestionIndexes.length > 0) return NextResponse.json({ message: "You have already finished." }, { status: 409 });
                    if (!Array.isArray(userAnswers)) return NextResponse.json({ message: "Invalid format." }, { status: 400 });

                    event.quizQuestions.forEach((q, idx) => {
                        if (userAnswers[idx] !== undefined && userAnswers[idx] !== -1) {
                            const isCorrect = userAnswers[idx] === q.correctOptionIndex;
                            if (isCorrect) userEntry.score += 1;
                            userEntry.answeredQuestionIndexes.push(idx);
                            userEntry.responses.push({ questionIndex: idx, selectedOptionIndex: userAnswers[idx], isCorrect });
                        }
                    });
                } else if (event.deliveryMode === "STREAMED") {
                    if (questionIndex === undefined || answerIndex === undefined) return NextResponse.json({ message: "Parameters missing." }, { status: 400 });

                    if (questionIndex > event.currentStreamIndex) {
                        const targetQ = event.quizQuestions[questionIndex];
                        if (targetQ && targetQ.releasedAt && now >= targetQ.releasedAt) {
                            event.currentStreamIndex = questionIndex;
                            if (questionIndex + 1 < event.quizQuestions.length) {
                                event.quizQuestions[questionIndex + 1].releasedAt = new Date(now.getTime() + (event.streamGapMinutes || 5) * 60 * 1000);
                            } else {
                                event.endsAt = new Date(now.getTime() + (event.streamGapMinutes || 5) * 60 * 1000);
                            }
                        } else {
                            return NextResponse.json({ message: "Hold up, this question is not active yet." }, { status: 400 });
                        }
                    } else if (questionIndex < event.currentStreamIndex) {
                        return NextResponse.json({ message: "This question has already passed." }, { status: 400 });
                    }

                    if (userEntry.answeredQuestionIndexes.includes(questionIndex)) return NextResponse.json({ message: "You already answered." }, { status: 409 });

                    const targetQuestion = event.quizQuestions[questionIndex];
                    const isCorrect = targetQuestion && targetQuestion.correctOptionIndex === answerIndex;

                    if (isCorrect) userEntry.score += 1;
                    userEntry.answeredQuestionIndexes.push(questionIndex);
                    userEntry.responses.push({ questionIndex, selectedOptionIndex: answerIndex, isCorrect });
                }

                event.leaderboard.sort((a, b) => b.score - a.score);
                await event.save();
                return NextResponse.json({ success: true, leaderboard: event.leaderboard }, { status: 200 });
            }

            case "STREAM_NEXT": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });
                if (event.deliveryMode !== "STREAMED" || event.status !== "LIVE") return NextResponse.json({ message: "Invalid action." }, { status: 400 });

                if (event.currentStreamIndex + 1 >= event.quizQuestions.length) {
                    event.status = "COMPLETED";
                    event.expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);
                } else {
                    event.currentStreamIndex += 1;
                    event.quizQuestions[event.currentStreamIndex].releasedAt = now;
                    if (event.currentStreamIndex + 1 < event.quizQuestions.length) {
                        event.quizQuestions[event.currentStreamIndex + 1].releasedAt = new Date(now.getTime() + (event.streamGapMinutes || 5) * 60 * 1000);
                    } else {
                        event.endsAt = new Date(now.getTime() + (event.streamGapMinutes || 5) * 60 * 1000);
                    }
                }
                await event.save();
                return NextResponse.json({ success: true, currentStreamIndex: event.currentStreamIndex, status: event.status }, { status: 200 });
            }

            case "BLACKLIST_USER": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });
                const { targetDeviceId } = payload;
                if (!targetDeviceId) return NextResponse.json({ message: "Target player ID required." }, { status: 400 });

                if (!event.blacklistedDeviceIds.includes(targetDeviceId)) event.blacklistedDeviceIds.push(targetDeviceId);
                event.participants = event.participants.filter(p => p.deviceId !== targetDeviceId);
                event.leaderboard = event.leaderboard.filter(p => p.deviceId !== targetDeviceId);

                await event.save();
                return NextResponse.json({ success: true, message: "Player removed and banned." }, { status: 200 });
            }

            case "TERMINATE": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });
                event.status = "COMPLETED";
                event.expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);
                await event.save();
                return NextResponse.json({ success: true, message: "Quiz ended early." }, { status: 200 });
            }

            default: return NextResponse.json({ message: "Unknown action." }, { status: 400 });
        }
    } catch (err) {
        console.error("⛔ QUIZ_PATCH_CRASH:", err);
        return NextResponse.json({ message: "Server error during update." }, { status: 500 });
    }
}