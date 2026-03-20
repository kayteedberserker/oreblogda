import MobileUser from '@/app/models/MobileUserModel';
import connectDB from '@/app/lib/mongodb';
import { NextResponse } from 'next/server';

// ==========================================
// 🌙 EID AL-FITR CELEBRATION LOOT POOL
// Base Drop Rates: MYTHIC (2.5%), EPIC (25%), RARE (72.5%)
// ==========================================
const GACHA_POOL = [
    // 👑 MYTHIC (2.5%) - The Grand Prize
    { id: 'eid_mythic_crescent', name: 'Golden Crescent', category: 'WATERMARK', tier: 'MYTHIC', baseDropRate: 2.5, visualConfig: { color: '#facc15', svgCode: `
            <?xml version="1.0" encoding="utf-8"?>
<!-- Generator: Adobe Illustrator 27.5.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
	 viewBox="0 0 2200 2200" style="enable-background:new 0 0 2200 2200;" xml:space="preserve">
<g id="Objects" transform="translate(2200, 0) scale(-1, 1)">
	<path style="fill:#F4B23D;" d="M1927.317,1054.792c-63.412,301.248-330.699,527.391-650.811,527.391
		c-366.778,0-665.084-298.305-665.084-665.084c0-320.111,226.143-587.399,527.391-650.811c12.918-2.719,20.043,14.541,8.951,21.699
		c-151.246,97.596-251.381,267.601-251.381,460.991c-0.001,302.903,245.342,548.245,548.244,548.245
		c193.39,0,363.395-100.135,460.991-251.381C1912.776,1034.749,1930.036,1041.874,1927.317,1054.792z"/>
	<path style="fill:#F4B23D;" d="M1491.855,565.276c-131.511,15.564-144.128,28.181-159.692,159.692
		c-15.564-131.511-28.181-144.128-159.692-159.692c131.511-15.564,144.128-28.181,159.692-159.692
		C1347.727,537.095,1360.344,549.712,1491.855,565.276z"/>
	<path style="fill:#F4B23D;" d="M501.591,1100.75c-131.511,15.564-144.128,28.181-159.692,159.692
		c-15.564-131.511-28.181-144.128-159.692-159.692c131.511-15.564,144.128-28.181,159.692-159.692
		C357.463,1072.569,370.08,1085.186,501.591,1100.75z"/>
	<path style="fill:#F4B23D;" d="M2017.793,1585.006c-131.511,15.564-144.128,28.181-159.692,159.692
		c-15.564-131.511-28.181-144.128-159.692-159.692c131.511-15.564,144.128-28.181,159.692-159.692
		C1873.665,1556.825,1886.282,1569.442,2017.793,1585.006z"/>
	<path style="fill:#F4B23D;" d="M941.808,1774.308C810.297,1789.872,797.68,1802.489,782.116,1934
		c-15.564-131.511-28.181-144.128-159.692-159.692c131.511-15.564,144.128-28.181,159.692-159.692
		C797.68,1746.127,810.297,1758.744,941.808,1774.308z"/>
	<path style="fill:#F4B23D;" d="M1829.098,475.982c-46.945,5.556-51.449,10.06-57.005,57.005
		c-5.556-46.945-10.06-51.449-57.005-57.005c46.945-5.556,51.449-10.06,57.005-57.005
		C1777.649,465.923,1782.153,470.427,1829.098,475.982z"/>
	<path style="fill:#F4B23D;" d="M1443.35,1742.769c-46.945,5.556-51.449,10.06-57.005,57.005
		c-5.556-46.945-10.06-51.449-57.005-57.005c46.945-5.556,51.449-10.06,57.005-57.005
		C1391.901,1732.71,1396.405,1737.213,1443.35,1742.769z"/>
	<path style="fill:#F4B23D;" d="M1382.612,945.37c-85.911,10.167-94.154,18.41-104.321,104.321
		c-10.167-85.911-18.41-94.154-104.321-104.321c85.911-10.167,94.154-18.41,104.321-104.321
		C1288.459,926.961,1296.701,935.203,1382.612,945.37z"/>
	<path style="fill:#F4B23D;" d="M1754.377,834.646c-85.911,10.167-94.154,18.41-104.321,104.321
		c-10.167-85.911-18.41-94.154-104.321-104.321c85.911-10.167,94.154-18.41,104.321-104.321
		C1660.224,816.237,1668.466,824.479,1754.377,834.646z"/>
	<path style="fill:#F4B23D;" d="M595.35,612.611c-64.586,7.644-70.782,13.84-78.426,78.426
		c-7.644-64.586-13.84-70.782-78.426-78.426c64.586-7.643,70.782-13.84,78.426-78.426
		C524.567,598.771,530.764,604.967,595.35,612.611z"/>
	<path style="fill:#F4B23D;" d="M679.874,1460.897c-64.586,7.644-70.782,13.84-78.426,78.426
		c-7.644-64.586-13.84-70.782-78.426-78.426c64.586-7.644,70.782-13.84,78.426-78.426
		C609.091,1447.058,615.288,1453.254,679.874,1460.897z"/>
</g>
</svg>

        ` } },
    
    // 🟣 EPIC (25% Total) - High-tier permanent cosmetics
    { id: 'eid_epic_fanoos', name: 'Fanoos Lantern', category: 'BADGE', tier: 'EPIC', baseDropRate: 8.3, visualConfig: { color: '#fb923c', 
        svgCode: `
        <svg viewBox="0 0 24 24"><path d="M10 2h4v2h-4V2zm5.5 3H8.5L7 9h10l-1.5-4zM6 10v9.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V10H6zm3.5 9v-7h1v7h-1zm4 0v-7h1v7h-1z" fill="#fb923c"/></svg>
        ` } },
    { id: 'eid_epic_aura', name: 'Lunar Aura', category: 'GLOW', tier: 'EPIC', baseDropRate: 8.3, visualConfig: { primaryColor: '#fde047', isAnimated: true, svgCode: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#fde047" fill-opacity="0.4" stroke="#facc15" stroke-width="1.5"/></svg>` } },
    { id: 'eid_epic_starlight_border', name: 'Starlight Frame', category: 'BORDER', tier: 'EPIC', baseDropRate: 8.4, visualConfig: { primaryColor: '#facc15', secondaryColor: '#fb923c', animationType: 'borderChaser', duration: 1500 } },
    
    // 🔵 RARE (72.5% Total) - Temporary cosmetics & standard consumables
    { id: 'eid_rare_dates', name: 'Dates of Fortune (50 OC)', category: 'CONSUMABLE', tier: 'RARE', baseDropRate: 15.0, rewardAmount: 50, visualConfig: { primaryColor: '#8B4513', svgCode: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#8B4513"/><text x="12" y="16" fill="white" font-size="10" font-weight="bold" text-anchor="middle">OC</text></svg>`} },
    { id: 'eid_rare_zakat', name: 'Eidi Pouch (100 OC)', category: 'CONSUMABLE', tier: 'RARE', baseDropRate: 12.5, rewardAmount: 100, visualConfig: { primaryColor: '#22c55e', svgCode: `<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="#22c55e" fill-opacity="0.8" stroke="#16a34a"/></svg>`} },
    
    // ⏳ TEMPORARY ITEMS
    { id: 'eid_rare_henna_glow', name: 'Henna Traces (7 Days)', category: 'GLOW', tier: 'RARE', baseDropRate: 15.0, expiresInDays: 7, visualConfig: { primaryColor: '#a0522d', svgCode: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#a0522d" fill-opacity="0.4" stroke="#8b4513" stroke-dasharray="2,2" stroke-width="2"/></svg>` } },
    { id: 'eid_rare_night_bg', name: 'Desert Night (14 Days)', category: 'BACKGROUND', tier: 'RARE', baseDropRate: 15.0, expiresInDays: 14, visualConfig: { primaryColor: '#1e3a8a', secondaryColor: '#0f172a', svgCode: `<svg viewBox="0 0 100 60"><rect width="100%" height="100%" fill="#1e3a8a"/></svg>` } },
    { id: 'eid_rare_crescent_border', name: 'Fading Crescent (7 Days)', category: 'BORDER', tier: 'RARE', baseDropRate: 15.0, expiresInDays: 7, visualConfig: { primaryColor: '#3b82f6', animationType: 'singleSnake', duration: 4000 } }
];

// ==========================================
// ⚡️ GET HANDLER: SERVE PRIZE POOL TO FRONTEND
// ==========================================
export async function GET(req) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const deviceId = searchParams.get('deviceId');
        
        let ownedIds = [];
        let pityCount = 0; // ⚡️ NEW

        if (deviceId) {
            const user = await MobileUser.findOne({ deviceId }).lean();
            if (user) {
                if (user.inventory) ownedIds = user.inventory.map(i => i.itemId);
                pityCount = user.gachaPityCounter || 0; // ⚡️ Fetch Pity
            }
        }

        return NextResponse.json({ 
            success: true, 
            pool: GACHA_POOL,
            ownedIds: ownedIds,
            pityCount: pityCount // ⚡️ Return to App
        });
    } catch (error) {
        console.error("Failed to fetch Gacha Pool:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ==========================================
// ⚡️ MAIN POST HANDLER (WITH PITY SYSTEM)
// ==========================================
export async function POST(req) {
    try {
        await connectDB();
        const { deviceId, pullType } = await req.json();

        if (!deviceId || !pullType) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const pulls = pullType === '6x' ? 6 : 1;
        const cost = pullType === '6x' ? 500 : 100;

        if ((user.coins || 0) < cost) {
            return NextResponse.json({ error: 'Insufficient OC for this summon.' }, { status: 400 });
        }

        user.coins -= cost;
        let rewardsGained = [];
        let currentInventoryIds = user.inventory?.map(i => i.itemId) || [];

        for (let i = 0; i < pulls; i++) {
            
            // ⚡️ 1. INCREMENT PITY COUNTER
            user.gachaPityCounter = (user.gachaPityCounter || 0) + 1;

            const availableItems = GACHA_POOL.filter(item => 
                item.category === 'CONSUMABLE' || !currentInventoryIds.includes(item.id)
            );

            const mythicItems = availableItems.filter(i => i.tier === 'MYTHIC');
            const epicItems = availableItems.filter(i => i.tier === 'EPIC');
            const rareItems = availableItems.filter(i => i.tier === 'RARE');

            let selectedItem;

            // ⚡️ 2. CHECK PITY TRIGGER (50 PULLS)
            // If they hit 50 pulls AND they don't already own the Mythic item
            if (user.gachaPityCounter >= 50 && mythicItems.length > 0) {
                selectedItem = mythicItems[Math.floor(Math.random() * mythicItems.length)];
                user.gachaPityCounter = 0; // Reset Pity!
            } else {
                // NORMAL ROLL LOGIC
                let pMythic = mythicItems.length > 0 ? 2.5 : 0;
                let pEpic = epicItems.length > 0 ? 25 : 0;
                if (pMythic === 0 && pEpic > 0) pEpic += 2.5;
                let pRare = 100 - pMythic - pEpic; 

                const roll = Math.random() * 100;
                if (roll <= pMythic) {
                    selectedItem = mythicItems[Math.floor(Math.random() * mythicItems.length)];
                } else if (roll <= pMythic + pEpic) {
                    selectedItem = epicItems[Math.floor(Math.random() * epicItems.length)];
                } else {
                    selectedItem = rareItems[Math.floor(Math.random() * rareItems.length)];
                }
            }

            // Fallback
            if (!selectedItem) selectedItem = GACHA_POOL.find(i => i.category === 'CONSUMABLE');

            // ⚡️ 3. If they naturally pulled a Mythic, reset the pity counter!
            if (selectedItem.tier === 'MYTHIC') {
                user.gachaPityCounter = 0;
            }

            // 4. Apply Reward
            if (selectedItem.category === 'CONSUMABLE') {
                user.coins += selectedItem.rewardAmount;
            } else {
                currentInventoryIds.push(selectedItem.id);
                
                let expiryDate = null;
                if (selectedItem.expiresInDays) {
                    expiryDate = new Date();
                    expiryDate.setDate(expiryDate.getDate() + selectedItem.expiresInDays);
                }

                user.inventory.push({
                    itemId: selectedItem.id,
                    name: selectedItem.name,
                    category: selectedItem.category,
                    visualConfig: selectedItem.visualConfig,
                    acquiredAt: new Date(),
                    expiresAt: expiryDate
                });
            }
            
            rewardsGained.push({ ...selectedItem, isDuplicate: false });
        }

        await user.save();

        return NextResponse.json({ 
            success: true, 
            newBalance: user.coins,
            inventory: user.inventory,
            rewards: rewardsGained,
            pityCount: user.gachaPityCounter // ⚡️ Send new pity to app
        });

    } catch (error) {
        console.error("Gacha Error:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}