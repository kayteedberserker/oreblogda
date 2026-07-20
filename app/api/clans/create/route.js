import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import geoip from "geoip-lite";
import { NextResponse } from "next/server";

const generateUniqueTag = async (name) => {
    // 1. Define ignore words
    const ignoreWords = new Set(['clan', 'the', 'is', 'am', 'we', 'are', 'of', 'and', 'in', 'to', 'for']);

    // 2. Clean, split, and filter input (Keeps alphanumeric)
    const words = name
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 0 && !ignoreWords.has(word.toLowerCase()));

    if (words.length === 0) {
        words.push("SHINOBI");
    }

    let base = "";
    const fullCombined = words.join('').toUpperCase();

    // Max base length is 12 (17 total limit - 5 characters for "-CLAN")
    if (fullCombined.length <= 12) {
        base = fullCombined;
    } else if (words.length > 1) {
        // 3a. Multi-word over limit: Take first 2 letters from EACH word
        const acronymParts = words.map(word => word.substring(0, 2).toUpperCase());
        base = acronymParts.join('').substring(0, 12);
    } else {
        // 3b. Single massive word over limit: Just chop it safely
        base = fullCombined.substring(0, 12);
    }

    let finalTag = `${base}-CLAN`;

    // 4. Check uniqueness
    const existingBase = await Clan.findOne({ tag: finalTag });
    if (!existingBase) {
        return finalTag;
    }

    // 5. Collision loop: Append random 4-digit number (Max total 17 chars)
    let isUnique = false;
    let attempts = 0; // Failsafe to prevent infinite server hanging

    while (!isUnique && attempts < 50) {
        attempts++;
        // Use a 4-digit number (1000-9999) to drastically reduce collision chances
        const randomNum = Math.floor(Math.random() * 9000 + 1000).toString();

        // We need 10 chars for the suffix: "-XXXX-CLAN"
        // So the safeBase can only be 7 characters long max (7 + 10 = 17)
        const safeBase = base.substring(0, 7);
        finalTag = `${safeBase}-${randomNum}-CLAN`;

        const existing = await Clan.findOne({ tag: finalTag });
        if (!existing) {
            isUnique = true;
        }
    }

    // Extreme fallback if somehow 50 random 4-digit numbers collide
    if (!isUnique) {
        const timestampSuffix = Date.now().toString().slice(-4);
        finalTag = `${base.substring(0, 7)}-${timestampSuffix}-CLAN`;
    }

    return finalTag;
};

export async function POST(req) {
    await connectDB();
    try {
        const body = await req.json();
        const { name, description, logo, deviceId } = body;

        // --- 🔹 COUNTRY DETECTION 🔹 ---
        let country = req.headers.get("x-user-country");

        // 1. Find the user
        const user = await MobileUser.findOne({ deviceId });
        if (!user) {
            return NextResponse.json({ message: "User profile not found" }, { status: 404 });
        }

        // 🔹 Fallback Logic for Country
        if (!country || country === "Unknown") {
            // Use user's profile country if available
            if (user.country) {
                country = user.country;
            } else {
                // Last resort: IP detection
                const forwarded = req.headers.get("x-forwarded-for");
                const ip = forwarded ? forwarded.split(/, /)[0] : "127.0.0.1";
                const geo = geoip.lookup(ip);
                country = geo ? geo.country : "Global";
            }
        }

        // 2. CHECK TOTAL CLAN LIMIT
        const existingClan = await Clan.findOne({
            $or: [{ leader: user._id }, { members: user._id }]
        });

        if (existingClan) {
            const isLeader = existingClan.leader.toString() === user._id.toString();
            return NextResponse.json({
                message: isLeader
                    ? `You are already the Leader of [${existingClan.name}].`
                    : `You are already a member of [${existingClan.name}]. Leave it to start your own.`
            }, { status: 403 });
        }

        if (!name || name.trim().length < 2) {
            return NextResponse.json({ message: "Clan name too short" }, { status: 400 });
        }

        const normalizedName = name.trim();
        const safeRegexName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // 🧠 CREATE CANONICAL CORE (Strips spaces/symbols, uppercase only)
        const cleanNameCore = normalizedName.toUpperCase().replace(/[^A-Z0-9]/g, "");

        // 🛡️ 3. CANONICAL COLLISION CHECK (Premium Factions with Active Locks ONLY)
        // Optimized into a single database trip via $or logic block
        const identityCollision = await Clan.findOne({
            canonicalName: cleanNameCore,
            $or: [
                { nameLockedUntil: { $gt: new Date() } },
                { verifiedClan: true, primeLevel: { $in: [2, 3] } }
            ]
        });

        if (identityCollision) {
            return NextResponse.json({
                message: `Identity lock active. A variation of '${normalizedName}' is reserved by a premium faction.`
            }, { status: 403 });
        }

        // 🛡️ 4. STANDARD EXACT MATCH CHECK (For Unlocked Names)
        const nameExists = await Clan.findOne({
            name: { $regex: new RegExp(`^${safeRegexName}$`, "i") }
        });

        if (nameExists) {
            return NextResponse.json({ message: "This exact name is already claimed by an active faction." }, { status: 409 });
        }

        // 🛡️ 5. PREVENT CLAN CREATION IF A PLAYER HAS LOCKED THIS NAME
        const exactPlayerLock = await MobileUser.findOne({
            _id: { $ne: user._id },
            nameLockedUntil: { $gt: new Date() },
            canonicalUsername: cleanNameCore
        });

        if (exactPlayerLock) {
            return NextResponse.json({
                message: `Identity lock active. The name '${normalizedName}' is reserved by a premium operator.`
            }, { status: 403 });
        }

        const uniqueTag = await generateUniqueTag(name);

        // 🧠 CREATE TAG CANONICAL CORE
        const cleanTagCore = uniqueTag.toUpperCase().replace(/[^A-Z0-9]/g, "");

        const newClan = await Clan.create({
            name: normalizedName,
            canonicalName: cleanNameCore, // ⚡️ CRITICAL: Saved on creation
            tag: uniqueTag,
            canonicalTag: cleanTagCore,   // ⚡️ CRITICAL: Saved on creation
            description,
            logo,
            leader: user._id,
            members: [user._id],
            maxSlots: 5,
            isRecruiting: true,
            rank: 1,
            country: country, // 🔹 Saved Country
            totalPoints: 200,
            spendablePoints: 0,
            stats: {
                totalPosts: 0,
                views: 0,
                likes: 0,
                shares: 0,
                comments: 0
            },
            lastActive: new Date()
        });

        return NextResponse.json({ success: true, clan: newClan }, { status: 201 });
    } catch (err) {
        console.error("Clan Creation Error:", err);
        return NextResponse.json({ message: "Server error during foundation" }, { status: 500 });
    }
}