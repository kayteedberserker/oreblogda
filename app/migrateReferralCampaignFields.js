import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";

async function migrateReferralCampaignFields() {
    await connectDB();

    const result = await MobileUser.updateMany(
        {
            $or: [
                {
                    eventPoints: {
                        $exists: false,
                    },
                },
                {
                    eventSpinTokens: {
                        $exists: false,
                    },
                },
                {
                    gachaPityCounters: {
                        $exists: false,
                    },
                },
                {
                    referralCampaigns: {
                        $exists: false,
                    },
                },
            ],
        },
        [
            {
                $set: {
                    eventPoints: {
                        $ifNull: [
                            "$eventPoints",
                            {},
                        ],
                    },
                    eventSpinTokens: {
                        $ifNull: [
                            "$eventSpinTokens",
                            {},
                        ],
                    },
                    gachaPityCounters: {
                        $ifNull: [
                            "$gachaPityCounters",
                            {},
                        ],
                    },
                    referralCampaigns: {
                        $ifNull: [
                            "$referralCampaigns",
                            {},
                        ],
                    },
                },
            },
        ]
    );

    console.log({
        acknowledged:
            result.acknowledged,
        matchedCount:
            result.matchedCount,
        modifiedCount:
            result.modifiedCount,
    });
}

migrateReferralCampaignFields()
    .then(() => {
        console.log(
            "Referral campaign field migration complete."
        );
        process.exit(0);
    })
    .catch(error => {
        console.error(
            "Referral campaign migration failed:",
            error
        );
        process.exit(1);
    });
