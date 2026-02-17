import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import Post from "@/app/models/PostModel"; 
import { NextResponse } from "next/server";
import geoip from "geoip-lite";

const generateUniqueTag = async (name) => {
    // 1. Split into words to find the longest "Main" name
    const words = name.split(/\s+/);
    
    // 2. Find the longest word based on letters only (The "Core" name)
    let longestWord = words.reduce((a, b) => {
        const aClean = a.replace(/[^a-zA-Z]/g, '');
        const bClean = b.replace(/[^a-zA-Z]/g, '');
        return aClean.length >= bClean.length ? a : b;
    });

    // 3. Extract all numbers and decimals from the entire string
    const numbersMatch = name.match(/[\d.]+/g);
    const combinedNumbers = numbersMatch ? numbersMatch.join('') : "";

    // 4. Combine: LONGESTWORD + NUMBERS (Cleaned)
    let base = (longestWord.replace(/[^a-zA-Z]/g, '') + combinedNumbers).toUpperCase();
    
    // Fallback for safety
    if (base.length < 1) base = "SHINOBI";

    let finalTag = `${base}-CLAN`;
    
    // 5. Check uniqueness for the "Prime" tag
    const existingBase = await Clan.findOne({ tag: finalTag });
    
    if (!existingBase) {
        return finalTag; 
    }

    // 6. Collision loop: Inject random "Division" number middle-style
    let isUnique = false;
    while (!isUnique) {
        const randomNum = Math.floor(Math.random() * 99 + 1).toString().padStart(2, '0');
        
        // This results in: FORTITUDE9.8-07-CLAN
        finalTag = `${base}-${randomNum}-CLAN`;

        const existing = await Clan.findOne({ tag: finalTag });
        if (!existing) {
            isUnique = true;
        }
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

        // 3. Query Post model for the actual number of posts
        const actualPostCount = await Post.countDocuments({ 
            authorUserId: user._id,
            status: "approved" 
        });

        // 4. Requirements Configuration
        const MIN_POSTS = 50;
        const MIN_STREAK = 10;
        const userStreak = user.lastStreak || 0;

        if (actualPostCount < MIN_POSTS || userStreak < MIN_STREAK) {
            return NextResponse.json({ 
                message: "Requirement failed: Insufficient Legacy",
                requirements: { minPosts: MIN_POSTS, minStreak: MIN_STREAK },
                current: { posts: actualPostCount, streak: userStreak }
            }, { status: 403 });
        }

        if (!name || name.trim().length < 2) {
            return NextResponse.json({ message: "Clan name too short" }, { status: 400 });
        }

        // 5. Name Uniqueness Check
        const nameExists = await Clan.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, "i") } });
        if (nameExists) {
            return NextResponse.json({ message: "This name is already claimed" }, { status: 409 });
        }

        const uniqueTag = await generateUniqueTag(name);

        const newClan = await Clan.create({
            name: name.trim(),
            tag: uniqueTag,
            description,
            logo,
            leader: user._id,
            members: [user._id], 
            maxSlots: 5,
            isRecruiting: true,
            rank: 1, 
            country: country, // 🔹 Saved Country
            totalPoints: 200,
            spendablePoints: 200,
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
