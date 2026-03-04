import MobileUser from '@/app/models/MobileUserModel';
import Clan from '@/app/models/ClanModel';
import connectDB from '@/app/lib/mongodb';
import { NextResponse } from 'next/server';

const CC_VALUES = {
"increase_slot": 1500,
"change_name_desc": 200,
"badge_2_days": 1000,
"badge_5_days": 2000,
"badge_7_days": 3000,
"badge_30_days": 10000,
"bounty_card_1": 2000,
};

// Tier hierarchy for Verification
const VERIFIED_TIERS = {
'basic': 1,
'standard': 2,
'premium': 3
};

export async function POST(req) {
try {
await connectDB();
const body = await req.json();
const {
deviceId,
action,
type,
packId,
clanTag,
itemId,
price,
name,
category,
visualConfig, // This comes from your Catalog GET request
rewards      // Sent from the frontend catalog (like your Author route)
} = body;

const user = await MobileUser.findOne({ deviceId });
if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

const clan = clanTag
? await Clan.findOne({ tag: clanTag.toUpperCase() })
: await Clan.findOne({ $or: [{ leader: user._id }, { viceLeader: user._id }] });

if (!clan) return NextResponse.json({ success: false, error: 'Clan not found' }, { status: 404 });

const isAuthorized = clan.leader.equals(user._id) || (clan.viceLeader && clan.viceLeader.equals(user._id));

// --- 🛒 ACTION: PURCHASE DYNAMIC STORE ITEMS ---
if (action === 'buy_item') {
if (!isAuthorized) return NextResponse.json({ success: false, error: 'Only Leaders/Vice-Leaders can buy items' }, { status: 403 });
if (!itemId || !price || !category) return NextResponse.json({ success: false, error: 'Missing item data' }, { status: 400 });

// 1. Handle Slots Upgrade
if (category === "UPGRADE" || type === "UPGRADE") {
if (clan.maxSlots >= 13) {
return NextResponse.json({ success: false, error: 'Author Slots full' }, { status: 400 });
}
if ((clan.spendablePoints || 0) < price) {
return NextResponse.json({ success: false, error: 'Insufficient CC in Treasury' }, { status: 400 });
}
clan.spendablePoints -= price;
clan.maxSlots += 1;
await clan.save();
return NextResponse.json({
success: true,
newBalance: clan.spendablePoints,
message: "Author Slot increased",
});
}

// 2. Handle Verification Badges
if (category === "VERIFIED") {
if ((clan.spendablePoints || 0) < price) {
return NextResponse.json({ success: false, error: 'Insufficient CC' }, { status: 400 });
}

const parts = itemId.split('_'); 
const newTier = parts[1]; 
const days = parseInt(parts[2]); 

const currentTier = clan.activeCustomizations?.verifiedTier || 'none';
const currentTierLevel = VERIFIED_TIERS[currentTier] || 0;
const newTierLevel = VERIFIED_TIERS[newTier];

const now = new Date();
let newExpiry = (clan.verifiedUntil && clan.verifiedUntil > now) 
? new Date(clan.verifiedUntil) 
: now;

if (newTierLevel > currentTierLevel) {
newExpiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
if (!clan.activeCustomizations) clan.activeCustomizations = {};
clan.activeCustomizations.verifiedTier = newTier;
} else if (newTierLevel === currentTierLevel) {
newExpiry.setDate(newExpiry.getDate() + days);
} else {
return NextResponse.json({ 
success: false, 
error: `You already have a higher tier (${currentTier}) active!` 
}, { status: 400 });
}

clan.spendablePoints -= price;
clan.verifiedUntil = newExpiry;

if (!clan.activeCustomizations) clan.activeCustomizations = {};
clan.activeCustomizations.verifiedBadgeXml = visualConfig?.svgCode;
clan.activeCustomizations.verifiedTier = newTier;

await clan.save();
return NextResponse.json({
success: true,
newBalance: clan.spendablePoints,
verifiedUntil: clan.verifiedUntil,
tier: newTier
});
}

// 3. Handle Other Permanent Items
if ((clan.spendablePoints || 0) < price) {
return NextResponse.json({ success: false, error: 'Insufficient CC in Treasury' }, { status: 400 });
}
if (clan.specialInventory?.some(i => i.itemId === itemId)) {
return NextResponse.json({ success: false, error: 'Item already in Clan Arsenal' }, { status: 400 });
}

clan.spendablePoints -= price;
if (!clan.specialInventory) clan.specialInventory = [];
clan.specialInventory.push({
itemId,
name: name || 'Unnamed Clan Item',
category,
visualConfig: {
svgCode: visualConfig?.svgCode || '',
primaryColor: visualConfig?.primaryColor || visualConfig?.color || '#3b82f6',
secondaryColor: visualConfig?.secondaryColor || null,
animationType: visualConfig?.animationType || null,
duration: visualConfig?.duration || 3000,
snakeLength: visualConfig?.snakeLength || 120,
isAnimated: !!(visualConfig?.animated || visualConfig?.animationType)
},
acquiredAt: new Date(),
isEquipped: false
});

await clan.save();
return NextResponse.json({
success: true,
newBalance: clan.spendablePoints,
inventory: clan.specialInventory
});
}

// --- ACTION: PURCHASE CLAN PACKS (Refactored to match Author logic) ---
if (action === 'purchase_pack') {
const packData = rewards; // Array of rewards passed from the frontend
if (!packData || !Array.isArray(packData)) {
return NextResponse.json({ success: false, error: 'Pack rewards missing' }, { status: 400 });
}

if (clan.purchasedPacks?.includes(packId)) {
return NextResponse.json({ success: false, error: 'Pack already owned by Clan' }, { status: 400 });
}

packData.forEach(reward => {
// 1. Process Clan Coins (CC)
if (reward.type === 'CC') {
clan.spendablePoints = (clan.spendablePoints || 0) + reward.amount;
}

// 2. Process Verification Days (Clans use verifiedUntil)
if (reward.type === 'VERIFIED_DAYS' || reward.type === 'BADGE_DAYS') {
const now = new Date();
const currentExpiry = (clan.verifiedUntil && clan.verifiedUntil > now) 
? new Date(clan.verifiedUntil) 
: now;
currentExpiry.setDate(currentExpiry.getDate() + reward.amount);
clan.verifiedUntil = currentExpiry;
}

// 3. Process Clan Inventory (Frames, Borders, etc.)
const inventoryCategories = ['WATERMARK', 'BADGE', 'BORDER', 'GLOW', 'FUNCTIONAL', 'FRAME', 'THEME'];
if (inventoryCategories.includes(reward.type)) {
const alreadyHasItem = clan.specialInventory?.some(inv => inv.itemId === reward.id);
if (!alreadyHasItem) {
if (!clan.specialInventory) clan.specialInventory = [];
clan.specialInventory.push({
itemId: reward.id,
name: reward.name,
category: reward.type,
visualConfig: {
svgCode: reward.visualConfig?.svgCode || '',
primaryColor: reward.visualConfig?.primaryColor || '#ffffff',
secondaryColor: reward.visualConfig?.secondaryColor || null,
animationType: reward.visualConfig?.animationType || null,
duration: reward.visualConfig?.duration || 3000,
isAnimated: reward.visualConfig?.isAnimated || false
},
acquiredAt: new Date(),
isEquipped: false
});
}
}
});

if (!clan.purchasedPacks) clan.purchasedPacks = [];
clan.purchasedPacks.push(packId);

await clan.save();
return NextResponse.json({ 
success: true, 
newBalance: clan.spendablePoints, 
inventory: clan.specialInventory 
});
}

// --- ACTION: BUY CC TIERS ---
if (action === 'buy_coins') {
const matchedNumbers = type.match(/\d+/);
const amount = matchedNumbers ? parseInt(matchedNumbers[0], 10) : null;
if (!amount || isNaN(amount)) return NextResponse.json({ success: false, error: 'Invalid CC amount' }, { status: 400 });

clan.spendablePoints = (clan.spendablePoints || 0) + (amount / 10);
await clan.save();
return NextResponse.json({ success: true, newBalance: clan.spendablePoints });
}

// --- ACTION: SPEND ---
if (action === 'spend') {
if (!isAuthorized) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
const cost = CC_VALUES[type];
if (!cost) return NextResponse.json({ success: false, error: 'Invalid item' }, { status: 400 });
if ((clan.spendablePoints || 0) < cost) return NextResponse.json({ success: false, error: 'Insufficient CC' }, { status: 400 });

clan.spendablePoints -= cost;
await clan.save();
return NextResponse.json({ success: true, newBalance: clan.spendablePoints });
}

return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

} catch (error) {
console.error("Clan API Internal Error:", error);
return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
}
}