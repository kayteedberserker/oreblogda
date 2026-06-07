import connectDB from "@/app/lib/mongodb"; // Adjust to your DB connection path
import mongoose from "mongoose";
import { NextResponse } from "next/server";

export async function GET(req) {
    await connectDB();
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page")) || 1;
        const limit = parseInt(searchParams.get("limit")) || 10;
        const startingId = searchParams.get("startingId");
        const viewerId = searchParams.get("viewerId");

        const deviceId = req.headers.get("x-user-deviceId") || "";
        const userCountry = req.headers.get("x-user-country") || "Global";

        // ⚡️ NEW: Force all incoming static preferences to lowercase immediately
        const favAnimes = req.headers.get("x-user-animes")?.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) || [];
        const favGenres = req.headers.get("x-user-genres")?.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) || [];
        const favCharacter = req.headers.get("x-user-character")?.trim().toLowerCase() || "";

        const userInterests = [...favAnimes, ...favGenres];
        if (favCharacter) userInterests.push(favCharacter);

        const skip = (page - 1) * limit;

        let query = {
            status: "approved",
            "media.type": "video"
        };

        if (startingId && mongoose.Types.ObjectId.isValid(startingId)) {
            query._id = { $ne: new mongoose.Types.ObjectId(startingId) };
        }

        // 🧠 FETCH DYNAMIC USER AFFINITY
        let safeAffinity = {};
        let safeAuthorAffinity = {};
        let safeCountryAffinity = {};

        if (deviceId) {
            const userProfile = await mongoose.models.MobileUsers.findOne({ deviceId })
                .select("affinityScores authorAffinity countryAffinity")
                .lean();

            if (userProfile) {
                safeAffinity = userProfile.affinityScores || {};
                safeAuthorAffinity = userProfile.authorAffinity || {};
                safeCountryAffinity = userProfile.countryAffinity || {};
            }
        }

        let followedClanTags = [];
        let viewerClanTags = [];

        if (viewerId) {
            const follows = await mongoose.models.ClanFollower.find({ userId: viewerId }).select("clanTag").lean();
            followedClanTags = follows.map(f => f.clanTag);

            const memberships = await mongoose.models.Clan.find({
                $or: [
                    { leader: viewerId },
                    { viceLeader: viewerId },
                    { members: viewerId }
                ]
            }).select("tag _id").lean();

            viewerClanTags = memberships.map(c => c.tag).concat(memberships.map(c => c._id.toString()));
        }

        const CONFIG = {
            likeWeight: 2.0,
            commentWeight: 4.0,
            hypeBaseWeight: 10.0,
            hypeDecayRate: 0.15,

            freshnessBoost: 20,
            freshnessWindow: 3,
            gravityPower: 1.2,

            staticPrefBonus: 3,
            staticLocalBonus: 4,
            clanBonus: 15,
            affinityMultiplier: 1.5,

            tierBasicWeight: 4,
            tierEpicWeight: 7,
            tierLegendaryWeight: 10,
            tierFollowerMultiplier: 1.5,
            partnerClanBonus: 20,
        };

        const now = new Date();

        const pipeline = [
            { $match: query },
            { $unwind: { path: "$media", includeArrayIndex: "mediaIndex" } },
            { $match: { "media.type": "video" } },

            {
                $lookup: {
                    from: "clans",
                    let: { postClanId: "$clanId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $or: [
                                        { $eq: ["$tag", "$$postClanId"] },
                                        { $eq: [{ $toString: "$_id" }, "$$postClanId"] }
                                    ]
                                }
                            }
                        },
                        {
                            $project: {
                                verifiedClan: 1,
                                "activeCustomizations.verifiedTier": 1,
                                verifiedUntil: 1
                            }
                        }
                    ],
                    as: "clanInfo"
                }
            },
            { $unwind: { path: "$clanInfo", preserveNullAndEmptyArrays: true } },

            // 5. Calculate Base Engagement & Match Counts
            {
                $addFields: {
                    ageInHours: {
                        $max: [0.5, { $divide: [{ $subtract: [now, "$createdAt"] }, 3600000] }]
                    },
                    commentsCount: { $size: { $ifNull: ["$comments", []] } },
                    likesCount: { $size: { $ifNull: ["$likes", []] } },
                    hypePointsCount: {
                        $cond: {
                            if: { $eq: [{ $type: { $ifNull: ["$hypePoints", 0] } }, "array"] },
                            then: { $size: { $ifNull: ["$hypePoints", []] } },
                            else: { $ifNull: ["$hypePoints", 0] }
                        }
                    },
                    // ⚡️ NEW: Lowercase the post's interests dynamically so `$setIntersection` can match the lowercased headers
                    matchCount: {
                        $size: {
                            $setIntersection: [
                                {
                                    $map: {
                                        input: { $ifNull: ["$interests", []] },
                                        as: "t",
                                        in: { $toLower: { $trim: { input: "$$t" } } }
                                    }
                                },
                                userInterests
                            ]
                        }
                    },
                    isViewerFollowingClan: {
                        $or: [
                            { $in: ["$clanId", followedClanTags] },
                            { $in: ["$clanTag", followedClanTags] }
                        ]
                    },
                    hasValidBadge: {
                        $and: [
                            { $ne: ["$clanInfo.verifiedUntil", null] },
                            { $gt: ["$clanInfo.verifiedUntil", now] }
                        ]
                    }
                }
            },

            // 6. Apply Bonuses & 🧠 DYNAMIC AFFINITY SCORING
            {
                $addFields: {
                    // 🧠 Tag Affinity
                    tagAffinityTotal: {
                        $sum: {
                            $map: {
                                input: { $ifNull: ["$interests", []] },
                                as: "rawTag",
                                in: {
                                    // ⚡️ NEW: Normalize the tag to lowercase before checking the dictionary
                                    $let: {
                                        vars: {
                                            cleanTag: { $toLower: { $trim: { input: "$$rawTag" } } }
                                        },
                                        in: {
                                            $let: {
                                                vars: {
                                                    dynamicScore: { $ifNull: [{ $getField: { field: "$$cleanTag", input: { $literal: safeAffinity } } }, 0] },
                                                    isStaticMatch: { $in: ["$$cleanTag", userInterests] }
                                                },
                                                in: {
                                                    $cond: [
                                                        { $gt: ["$$dynamicScore", 0] },
                                                        "$$dynamicScore",
                                                        { $cond: ["$$isStaticMatch", CONFIG.staticPrefBonus, 0] }
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    authorAffinityScore: {
                        $ifNull: [{ $getField: { field: { $toString: { $ifNull: ["$authorUserId", "$authorId"] } }, input: { $literal: safeAuthorAffinity } } }, 0]
                    },
                    countryAffinityScore: {
                        $let: {
                            vars: {
                                dynCountry: { $ifNull: [{ $getField: { field: { $ifNull: ["$country", "Global"] }, input: { $literal: safeCountryAffinity } } }, 0] },
                                isStaticCountry: { $eq: ["$country", userCountry] }
                            },
                            in: {
                                $cond: [
                                    { $gt: ["$$dynCountry", 0] },
                                    "$$dynCountry",
                                    { $cond: ["$$isStaticCountry", CONFIG.staticLocalBonus, 0] }
                                ]
                            }
                        }
                    },
                    decayedHypeWeight: {
                        $divide: [
                            CONFIG.hypeBaseWeight,
                            { $max: [1, { $multiply: ["$ageInHours", CONFIG.hypeDecayRate] }] }
                        ]
                    },

                    clanTierBonus: {
                        $cond: [
                            "$hasValidBadge",
                            {
                                $switch: {
                                    branches: [
                                        { case: { $eq: ["$clanInfo.activeCustomizations.verifiedTier", "legendary"] }, then: CONFIG.tierLegendaryWeight },
                                        { case: { $eq: ["$clanInfo.activeCustomizations.verifiedTier", "epic"] }, then: CONFIG.tierEpicWeight },
                                        { case: { $eq: ["$clanInfo.activeCustomizations.verifiedTier", "basic"] }, then: CONFIG.tierBasicWeight }
                                    ],
                                    default: 0
                                }
                            },
                            0
                        ]
                    },
                    partnerClanBonusVal: {
                        $cond: [
                            { $and: ["$isViewerFollowingClan", { $eq: ["$clanInfo.verifiedClan", true] }] },
                            CONFIG.partnerClanBonus,
                            0
                        ]
                    }
                }
            },
            {
                $addFields: {
                    engagementScore: {
                        $add: [
                            { $multiply: [{ $ifNull: ["$likesCount", 0] }, CONFIG.likeWeight] },
                            { $multiply: ["$commentsCount", CONFIG.commentWeight] },
                            {
                                $multiply: [
                                    { $sqrt: { $ifNull: ["$hypePointsCount", 0] } },
                                    "$decayedHypeWeight"
                                ]
                            }
                        ]
                    },
                    relevanceBonus: {
                        $add: [
                            { $multiply: ["$tagAffinityTotal", CONFIG.affinityMultiplier] },
                            { $multiply: ["$authorAffinityScore", CONFIG.affinityMultiplier] },
                            { $multiply: ["$countryAffinityScore", CONFIG.affinityMultiplier] },
                            { $cond: ["$isViewerFollowingClan", CONFIG.clanBonus, 0] },
                            {
                                $cond: [
                                    "$isViewerFollowingClan",
                                    { $multiply: ["$clanTierBonus", CONFIG.tierFollowerMultiplier] },
                                    "$clanTierBonus"
                                ]
                            },
                            "$partnerClanBonusVal"
                        ]
                    },
                    noveltyScore: {
                        $cond: [{ $lt: ["$ageInHours", CONFIG.freshnessWindow] }, CONFIG.freshnessBoost, 0]
                    }
                }
            },
            {
                $addFields: {
                    finalScore: {
                        $divide: [
                            { $add: ["$engagementScore", "$relevanceBonus", "$noveltyScore"] },
                            { $pow: ["$ageInHours", CONFIG.gravityPower] }
                        ]
                    }
                }
            },
            {
                $sort: {
                    isAdminPost: -1,
                    finalScore: -1,
                    createdAt: -1
                }
            },
            { $skip: skip },
            { $limit: limit }
        ];

        const posts = await mongoose.models.Post.aggregate(pipeline);

        let userMap = {};
        let clanMap = {};

        try {
            const uniqueAuthorIds = [...new Set(posts.map(p => (p.authorUserId || p.authorId)?.toString()).filter(Boolean))];
            const uniqueClanTags = [...new Set(posts.map(p => (p.clanTag || p.clanId)?.toString()).filter(Boolean))];

            if (uniqueAuthorIds.length > 0) {
                const users = await mongoose.models.MobileUsers.find({ _id: { $in: uniqueAuthorIds } }).lean();
                users.forEach(u => {
                    const userIdStr = u._id.toString();
                    userMap[userIdStr] = {
                        name: u.username,
                        image: u.profilePic?.url || null,
                        streak: u.lastStreak || 0,
                        rank: u.previousRank || 0,
                        peakLevel: u.peakLevel || 0,
                    };
                });
            }

            if (uniqueClanTags.length > 0) {
                const clans = await mongoose.models.Clan.find({
                    $or: [
                        { tag: { $in: uniqueClanTags } },
                        { _id: { $in: uniqueClanTags.filter(id => id.length === 24) } }
                    ]
                }).lean();
                clans.forEach(c => {
                    if (c.tag) clanMap[c.tag] = c;
                    if (c._id) clanMap[c._id.toString()] = c;
                });
            }
        } catch (popErr) {
            console.error("Bulk Population Error:", popErr);
        }

        const serializedPosts = posts.map((p) => {
            const aId = (p.authorUserId || p.authorId)?.toString();
            const cTag = (p.clanTag || p.clanId)?.toString();

            const rawMessage = p.message || "";
            const feedMessage = rawMessage
                .replace(/s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs, "$1$2$3$4$5$6$8$10")
                .replace(/\n+/g, ' ')
                .trim();

            const postLikes = p.likes || [];
            const hasLiked = deviceId ? postLikes.some(like => (like?.fingerprint === deviceId || like === deviceId)) : false;

            const finalHypeCount = p.hypePointsCount ?? (Array.isArray(p.hypePoints) ? p.hypePoints.length : (p.hypePoints || 0));

            return {
                _id: p._id.toString(),
                videoId: `${p._id.toString()}_${p.mediaIndex}`,
                mediaUrl: p.media.url,
                title: p.title,
                authorUserId: p.authorUserId || p.authorId,
                content: feedMessage.length > 150 ? feedMessage.slice(0, 150) + "..." : feedMessage,
                stats: {
                    likes: p.likesCount ?? (p.likes?.length || 0),
                    comments: p.commentsCount ?? (p.comments?.length || 0),
                    hype: finalHypeCount,
                    shares: p.shares || 0,
                    views: p.views || 0,
                },
                isLiked: hasLiked,
                authorData: userMap[aId] || null,
                clanData: clanMap[cTag] || null
            };
        });

        return NextResponse.json({
            posts: serializedPosts,
            page,
            limit
        }, { status: 200 });

    } catch (err) {
        console.error("GET Video Feed Error:", err);
        return NextResponse.json({ message: "Failed to fetch video feed" }, { status: 500 });
    }
}