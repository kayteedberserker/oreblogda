import mongoose from "mongoose";

const TournamentSchema = new mongoose.Schema({
    // 🏛️ Faction/Host Ownership (THE CONTAINER)
    clanId: { type: String, required: true, index: true },
    clanName: { type: String, required: true },
    leaderDeviceId: { type: String, required: true },

    // 🛡️ Staff Permissions Layer
    moderatedBy: [{ type: String }],

    // 📝 Metadata info
    title: { type: String, required: true },
    description: { type: String, required: true },
    visibility: { type: String, enum: ["PUBLIC", "PRIVATE"], default: "PUBLIC", index: true },
    gameName: { type: String, default: "Bloodstrike" },

    // 🧠 STRUCTURAL SYSTEM TOGGLES
    formatType: { type: String, enum: ["SINGLE_MATCH", "LEAGUE"], default: "SINGLE_MATCH", index: true },
    teamFormat: { type: String, enum: ["SOLO", "TEAM"], default: "SOLO" },
    status: { type: String, enum: ["REGISTRATION", "LIVE", "COMPLETED", "CANCELLED"], default: "REGISTRATION", index: true },

    groupingId: { type: String, default: null, index: true },

    // ⚡️ NEW: Master tournament expiration timer
    expiresAt: { type: Date, required: true },

    leaderboardWeights: {
        pointsPerKill: { type: Number, default: 1 },
        pointsPerMatchPlayed: { type: Number, default: 0 },
        placementScoring: {
            type: Map,
            of: Number,
            default: { "1": 15, "2": 12, "3": 10, "4": 8, "5": 6, "6": 5, "7": 4, "8": 3, "9": 2, "10": 1 }
        }
    },

    matches: [{
        matchNumber: { type: Number, required: true },
        matchName: { type: String },
        status: { type: String, enum: ["PENDING", "REGISTRATION", "LIVE", "COMPLETED", "CANCELLED"], default: "PENDING" },

        scheduledAt: { type: Date, default: Date.now },

        trackPerformance: { type: Boolean, default: true },

        lobbyConfig: {
            roomId: { type: String, default: null },
            roomPin: { type: String, default: null },
            additionalInstructions: { type: String, default: null }
        },

        participants: [{
            deviceId: { type: String, required: true },
            username: { type: String, required: true },
            teamName: { type: String, default: null },
            registeredAt: { type: Date, default: Date.now }
        }],

        loggedByDeviceId: { type: String },
        loggedAt: { type: Date },
        results: [{
            targetId: { type: String, required: true },
            displayName: { type: String, required: true },
            position: { type: Number, required: true },
            kills: { type: Number, default: 0 },
            calculatedScore: { type: Number, required: true }
        }]
    }],

    liveLeaderboard: [{
        targetId: { type: String, required: true },
        displayName: { type: String, required: true },
        totalMatchesPlayed: { type: Number, default: 0 },
        totalKills: { type: Number, default: 0 },
        highestPlacement: { type: Number, default: 999 },
        finalAccumulatedScore: { type: Number, default: 0 }
    }],

    participants: [{
        deviceId: { type: String, required: true },
        username: { type: String, required: true },
        teamName: { type: String, default: null },
        registeredAt: { type: Date, default: Date.now }
    }],

    blacklistedDeviceIds: [{ type: String }]
}, { timestamps: true });

export default mongoose.models.Tournament || mongoose.model("Tournament", TournamentSchema);