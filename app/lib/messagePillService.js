import connectDB from "@/app/lib/mongodb";
import MessagePillModel from "../models/MessagePillModel";

export async function createMessagePill({
    text,
    type = 'system', 
    link = null,
    targetAudience = 'global', 
    targetId = null,
    priority = 0,
    expiresInHours = null,
    replaceExistingType = false 
}) {
    try {
        await connectDB();
        
        let expiresAt = null;
        if (expiresInHours) {
            expiresAt = new Date(Date.now() + (expiresInHours * 60 * 60 * 1000));
        }

        let finalText = text;

        // ⚡️ ANTI-STACKING & ACCUMULATION LOGIC
        // We ensure a targetId exists, but we allow both 'user' and 'clan' audiences to pass through
        if (replaceExistingType && targetId) {
            
            // Check if it's one of our accumulating types
            if (type === 'aura_gain' || type === 'clan_points') {
                // 1. Find the existing pill for this specific user or clan
                const existingPill = await MessagePillModel.findOne({
                    targetAudience: targetAudience,
                    targetId: targetId,
                    type: type
                });

                if (existingPill) {
                    // 2. Extract the numbers from both strings
                    const oldMatch = existingPill.text.match(/\d+/);
                    const newMatch = text.match(/\d+/);

                    if (oldMatch && newMatch) {
                        const oldAmount = parseInt(oldMatch[0], 10);
                        const newAmount = parseInt(newMatch[0], 10);
                        const totalAmount = oldAmount + newAmount;
                        
                        // 3. Format the text dynamically based on which type is accumulating
                        finalText = type === 'aura_gain' 
                            ? `+${totalAmount} Aura Gained.`
                            : `+${totalAmount} Clan Points Gained.`;
                    }
                    
                    // 4. Delete the old pill (so we can create a fresh one at the top of the queue)
                    await MessagePillModel.deleteOne({ _id: existingPill._id });
                }
            } else {
                // Standard replace behavior for other types (e.g., overriding an old War Update with a new one)
                await MessagePillModel.deleteMany({
                    targetAudience: targetAudience,
                    targetId: targetId,
                    type: type
                });
            }
        }

        // ⚡️ Create the pill using the dynamically calculated `finalText`
        const newPill = await MessagePillModel.create({
            text: finalText,
            type,
            link,
            targetAudience,
            targetId: targetAudience !== 'global' ? targetId : null,
            priority,
            isActive: true,
            expiresAt
        });

        return newPill;
    } catch (err) {
        console.error("MessagePill Creation Service Error:", err);
        return null;
    }
}