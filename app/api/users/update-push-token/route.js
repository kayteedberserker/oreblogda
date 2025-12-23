const express = require('express');
const router = express.Router();
const User = require('./models/User'); // Adjust path to your User model

// Endpoint to update the push token for account migration
router.post('/api/users/update-push-token', async (req, res) => {
    const { deviceId, pushToken } = req.body;

    if (!deviceId || !pushToken) {
        return res.status(400).json({ message: "Missing deviceId or pushToken" });
    }

    try {
        // Find user by deviceId and update their token
        const user = await User.findOneAndUpdate(
            { deviceId: deviceId },
            { pushToken: pushToken },
            { new: true, upsert: true } // Create if doesn't exist, return updated doc
        );

        console.log(`✅ Updated Push Token for User: ${deviceId}`);
        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error("❌ Error updating push token:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

module.exports = router;