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
if (!targetLeader || targetLeader.deviceId !== deviceId) return NextResponse.json({ message: "Access Denied: Only Clan Leaders." }, { status: 403 });

// ⚡️ FEATURE LOCK: PRIME / VERIFIED CLANS ONLY
if (!targetClan.verifiedClan) {
return NextResponse.json({ message: "This feature is currently locked for Prime Clans only." }, { status: 403 });
}

// ⚡️ LIMIT CHECK: MAX 5 PUBLIC QUIZZES GLOBALLY
if (visibility?.toUpperCase() === "PUBLIC") {
const activePublicCount = await QuizEvent.countDocuments({
visibility: "PUBLIC",
status: { $in: ["COMING_SOON", "LIVE"] }
});
if (activePublicCount >= 5) {
return NextResponse.json({ message: "The global limit for public events (5) has been reached. Try again later or set visibility to PRIVATE." }, { status: 429 });
}
}

const duplicateConflict = await QuizEvent.findOne({ clanId, status: { $in: ["COMING_SOON", "LIVE"] } }).lean();
if (duplicateConflict) return NextResponse.json({ message: "Your clan already has an active Quiz." }, { status: 409 });

const now = new Date();
const scheduledTime = new Date(scheduledStartTime);

// ⚡️ TIMELINE: 1 Hour Grace Period from Scheduled Time. 
// If not started within this window, the DB TTL automatically purges it.
const maxLifespan = new Date(scheduledTime.getTime() + 1 * 60 * 60 * 1000);

if (scheduledTime < now || scheduledTime > new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
return NextResponse.json({ message: "Start time must be within the next 24 hours." }, { status: 400 });
}

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

// ⚡️ GLOBAL CHRONOLOGICAL CHECK: Organically completes quiz if time runs out
if (event.status !== "COMPLETED" && event.status !== "CANCELLED") {
const isTimeUp = event.endsAt && now > event.endsAt;
const hasExceededFailsafe = now > event.expiresAt;

if (isTimeUp || hasExceededFailsafe) {
event.status = event.quizQuestions.length > 0 && event.status === "LIVE" ? "COMPLETED" : "CANCELLED";
// ⚡️ TIMELINE: 12 Hours Leaderboard Viewing Period after completion
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

// ⚡️ TIMELINE: Set Max Quiz Duration based on mode to calculate endsAt
if (event.deliveryMode === "STREAMED") {
const streamGapMs = (event.streamGapMinutes || 5) * 60 * 1000;
event.endsAt = new Date(now.getTime() + (event.quizQuestions.length * streamGapMs));
event.currentStreamIndex = 0;
event.quizQuestions[0].releasedAt = now;
if (event.quizQuestions.length > 1) {
event.quizQuestions[1].releasedAt = new Date(now.getTime() + streamGapMs);
}
} else {
event.endsAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours default batch
}

// Remove the 1-hour grace period TTL and set the Leaderboard + Failsafe TTL
event.expiresAt = new Date(event.endsAt.getTime() + 12 * 60 * 60 * 1000);
await event.save();

if (event.acknowledgedBy && event.acknowledgedBy.length > 0) {
try {
const registeredUsers = await MobileUser.find({ deviceId: { $in: event.acknowledgedBy }, pushToken: { $ne: null } }).select("deviceId pushToken").lean();
const notifyPromises = registeredUsers.map(u =>
// Fixed: Added eventId to the deep link
sendPillParallel([u.pushToken], `🟢 Quiz LIVE: ${event.title}`, `The quiz in ${event.clanName} has just started! Jump in now to secure your spot.`, { screen: `/screens/events?id=${eventId}` }, { type: 'event', targetAudience: 'user', targetId: u.deviceId, singleUser: true, groupId: event._id.toString(), expiresInHours: 2 })
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

if (event.deliveryMode === "BATCH") {
if (!Array.isArray(userAnswers)) return NextResponse.json({ message: "Invalid format." }, { status: 400 });

let batchScore = 0;
let batchIndexes = [];
let batchResponses = [];

event.quizQuestions.forEach((q, idx) => {
if (userAnswers[idx] !== undefined && userAnswers[idx] !== -1) {
const isCorrect = userAnswers[idx] === q.correctOptionIndex;
if (isCorrect) batchScore += 1;
batchIndexes.push(idx);
batchResponses.push({ questionIndex: idx, selectedOptionIndex: userAnswers[idx], isCorrect });
}
});

const updateResult = await QuizEvent.updateOne(
{ _id: eventId, "leaderboard.deviceId": { $ne: deviceId } },
{ $push: { leaderboard: { deviceId, username: username.trim(), score: batchScore, answeredQuestionIndexes: batchIndexes, responses: batchResponses } } }
);

if (updateResult.modifiedCount === 0) {
return NextResponse.json({ message: "You have already finished." }, { status: 409 });
}

} else if (event.deliveryMode === "STREAMED") {
if (questionIndex === undefined || answerIndex === undefined) return NextResponse.json({ message: "Parameters missing." }, { status: 400 });

// ⚡️ ORGANIC STREAM PROGRESSION: Allow users to push the stream forward if time has passed
if (questionIndex > event.currentStreamIndex) {
const targetQ = event.quizQuestions[questionIndex];
if (targetQ && targetQ.releasedAt && now >= targetQ.releasedAt) {

const nextReleaseTime = new Date(now.getTime() + (event.streamGapMinutes || 5) * 60 * 1000);
let streamUpdatePayload = { $set: { currentStreamIndex: questionIndex } };

if (questionIndex + 1 < event.quizQuestions.length) {
streamUpdatePayload.$set[`quizQuestions.${questionIndex + 1}.releasedAt`] = nextReleaseTime;
}
// Notice: We do NOT complete the quiz here. Only the moderator or time limit handles that.

// Fire & forget atomic stream update (only the first concurrent request modifies it)
await QuizEvent.updateOne(
{ _id: eventId, currentStreamIndex: { $lt: questionIndex } },
streamUpdatePayload
);
} else {
return NextResponse.json({ message: "Hold up, this question is not active yet." }, { status: 400 });
}
} else if (questionIndex < event.currentStreamIndex) {
return NextResponse.json({ message: "This question has already passed." }, { status: 400 });
}

// Proceed to atomically log their answer
const targetQuestion = event.quizQuestions[questionIndex];
const isCorrect = targetQuestion && targetQuestion.correctOptionIndex === answerIndex;
const userExists = event.leaderboard.some(l => l.deviceId === deviceId);

if (!userExists) {
const insertResult = await QuizEvent.updateOne(
{ _id: eventId, "leaderboard.deviceId": { $ne: deviceId } },
{ $push: { leaderboard: { deviceId, username: username.trim(), score: isCorrect ? 1 : 0, answeredQuestionIndexes: [questionIndex], responses: [{ questionIndex, selectedOptionIndex: answerIndex, isCorrect }] } } }
);
if (insertResult.modifiedCount === 0) return NextResponse.json({ message: "Double submission detected." }, { status: 409 });
} else {
const updateResult = await QuizEvent.updateOne(
{ _id: eventId, "leaderboard.deviceId": deviceId, "leaderboard.answeredQuestionIndexes": { $ne: questionIndex } },
{
$inc: { "leaderboard.$.score": isCorrect ? 1 : 0 },
$push: {
"leaderboard.$.answeredQuestionIndexes": questionIndex,
"leaderboard.$.responses": { questionIndex, selectedOptionIndex: answerIndex, isCorrect }
}
}
);
if (updateResult.modifiedCount === 0) return NextResponse.json({ message: "You already answered." }, { status: 409 });
}
}

// ⚡️ PERFORMANCE FIX: Sort in memory before sending
const updatedEvent = await QuizEvent.findById(eventId).select("leaderboard").lean();
const sortedLeaderboard = updatedEvent.leaderboard.sort((a, b) => b.score - a.score);

return NextResponse.json({ success: true, leaderboard: sortedLeaderboard }, { status: 200 });
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