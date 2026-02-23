import mongoose from 'mongoose';
// Import the model file to trigger registration
import MobileUser from "app/models/MobileUserModel";

const clanFollowerSchema = new mongoose.Schema({
    clanTag: { 
        type: String, 
        required: true, 
        index: true 
    },
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        // Force Mongoose to recognize the model by referencing the imported variable
        ref: MobileUser.modelName || 'MobileUser', 
        required: true 
    },
    followedAt: { 
        type: Date, 
        default: Date.now 
    }
}, { timestamps: true });

// Ensure a user can't follow the same clan twice
clanFollowerSchema.index({ clanTag: 1, userId: 1 }, { unique: true });

// Check for existing model to prevent re-compilation errors during Next.js HMR
export default mongoose.models.ClanFollower || mongoose.model('ClanFollower', clanFollowerSchema);
