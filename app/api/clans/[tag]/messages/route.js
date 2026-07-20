import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
// TODO: Adjust this path to match your notification helper file location
import { sendPillParallel } from "@/app/lib/messagePillService";

// Helper function to check if a user belongs to the clan
const verifyClanMembership = (user, clan) => {
    const userId = user._id;
    const isLeader = clan.leader?.equals(userId);
    const isViceLeader = clan.viceLeader?.equals(userId);
    const isMember = clan.members?.some(memberId => memberId.equals(userId));

    return isLeader || isViceLeader || isMember;
};

export async function GET(req, { params }) {
    const awaitedParams = await params;
    const tag = awaitedParams.tag;
    const deviceId = req.headers.get("x-user-deviceId") || "";

    if (!deviceId) {
        return NextResponse.json({ success: false, message: "Device ID identifier required" }, { status: 401 });
    }

    await connectDB();
    try {
        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });

        const clan = await Clan.findOne({ tag: tag.toUpperCase() }).select('messages leader viceLeader members');
        if (!clan) return NextResponse.json({ success: false, message: "Clan not found" }, { status: 404 });

        if (!verifyClanMembership(user, clan)) {
            return NextResponse.json({ success: false, message: "Access Denied: You are not a member of this clan" }, { status: 403 });
        }

        const isClanLeader = clan.leader?.equals(user._id);

        // 🚀 Map messages to include frontend rendering flags
        const formattedMessages = clan.messages.map(msg => {
            const msgObj = msg.toObject ? msg.toObject() : msg;
            const isMyPost = msgObj.authorUserId?.toString() === user._id.toString() || msgObj.authorId === user.deviceId;

            return {
                ...msgObj,
                isMyPost,
                canDelete: isMyPost || isClanLeader // Leader can delete anything
            };
        });

        return NextResponse.json({ success: true, messages: formattedMessages });
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(req, { params }) {
    const awaitedParams = await params;
    const tag = awaitedParams.tag;
    const deviceId = req.headers.get("x-user-deviceId") || "";

    if (!deviceId) {
        return NextResponse.json({ success: false, message: "Device ID identifier required" }, { status: 401 });
    }

    await connectDB();
    try {
        const body = await req.json();
        const { text, replyToCommentId, replyToName, replyToText } = body;

        if (!text || !text.trim()) {
            return NextResponse.json({ success: false, message: "Text is required" }, { status: 400 });
        }

        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });

        const clan = await Clan.findOne({ tag: tag.toUpperCase() });
        if (!clan) return NextResponse.json({ success: false, message: "Clan not found" }, { status: 404 });

        if (!verifyClanMembership(user, clan)) {
            return NextResponse.json({ success: false, message: "Transmission Blocked: Non-member status" }, { status: 403 });
        }

        const newMessage = {
            _id: new mongoose.Types.ObjectId(),
            authorId: user.deviceId,
            authorUserId: user._id,
            authorName: user.username,
            text: text.trim(),
            replyToCommentId: replyToCommentId || null,
            replyToName: replyToName || null,
            replyToText: replyToText || null,
            date: new Date()
        };

        // Initialize messages array if it doesn't exist for some reason
        if (!clan.messages) clan.messages = [];

        clan.messages.push(newMessage);

        // 🚀 Keep data size healthy: Cap the log to the last 250 messages
        if (clan.messages.length > 250) {
            clan.messages = clan.messages.slice(-250);
        }

        await clan.save();

        // 🚀 Asynchronous Notification Dispatch (wrapped to prevent crash out if dispatch hitches)
        try {
            const memberIds = [clan.leader, clan.viceLeader, ...clan.members].filter(
                id => id && id.toString() !== user._id.toString()
            );

            const recipients = await MobileUser.find({
                _id: { $in: memberIds },
                pushToken: { $exists: true, $ne: null }
            }).select("pushToken");

            const tokens = [...new Set(recipients.map(r => r.pushToken))];

            if (tokens.length > 0) {
                await sendPillParallel(
                    tokens,
                    `${clan.name || 'Clan'} Hall`,
                    `${user.username}: ${text.trim().slice(0, 100)}`,
                    { screen: "/clanprofile?tab=hall", clanTag: clan.tag, type: "CLAN_CHAT" },
                    { type: 'clan_message', targetAudience: 'clan', targetId: clan.tag, link: `/clanprofile?tab=hall`, priority: 4 }
                );
            }
        } catch (pushErr) {
            console.error("Push Notification Dispatch Error:", pushErr);
        }

        // 🚀 Return the formatted new message directly so the frontend doesn't have to guess
        const formattedNewMessage = {
            ...newMessage,
            isMyPost: true,
            canDelete: true
        };

        return NextResponse.json({ success: true, message: formattedNewMessage });
    } catch (error) {
        console.log(error.message);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    const awaitedParams = await params;
    const tag = awaitedParams.tag;
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('id');
    const deviceId = req.headers.get("x-user-deviceId") || "";

    if (!deviceId) {
        return NextResponse.json({ success: false, message: "Device ID identifier required" }, { status: 401 });
    }
    if (!messageId) {
        return NextResponse.json({ success: false, message: "Message ID required" }, { status: 400 });
    }

    await connectDB();
    try {
        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });

        const clan = await Clan.findOne({ tag: tag.toUpperCase() });
        if (!clan) return NextResponse.json({ success: false, message: "Clan not found" }, { status: 404 });

        if (!verifyClanMembership(user, clan)) {
            return NextResponse.json({ success: false, message: "Transmission Blocked: Non-member status" }, { status: 403 });
        }

        const targetMessage = clan.messages.find(msg => msg._id.toString() === messageId);
        if (!targetMessage) {
            return NextResponse.json({ success: false, message: "Message archive not found" }, { status: 404 });
        }

        const isClanLeader = clan.leader?.equals(user._id);
        const isMessageAuthor = targetMessage.authorUserId?.equals(user._id) || targetMessage.authorId === user.deviceId;

        if (!isClanLeader && !isMessageAuthor) {
            return NextResponse.json({ success: false, message: "Purge Denied: Unauthorized access clearances" }, { status: 403 });
        }

        clan.messages = clan.messages.filter(msg => msg._id.toString() !== messageId);
        await clan.save();

        return NextResponse.json({ success: true, message: "Message deleted successfully" });
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}