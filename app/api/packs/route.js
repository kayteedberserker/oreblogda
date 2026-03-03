import MobileUser from '@/app/models/MobileUserModel';
import Post from '@/app/models/PostModel';
import Clan from '@/app/models/ClanModel';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const packType = searchParams.get('type') || 'author'; 
    const deviceId = req.headers.get('x-user-deviceId');

    if (!deviceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await MobileUser.findOne({ deviceId });
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    let userRankLevel = 1;
    let postCount = 0;
    let targetClan = null;
    let isAuthorizedToBuy = true;

    if (packType === 'author') {
      postCount = await Post.countDocuments({ authorUserId: user._id });
      if (postCount > 200) userRankLevel = 6;
      else if (postCount > 150) userRankLevel = 5;
      else if (postCount > 100) userRankLevel = 4;
      else if (postCount > 50) userRankLevel = 3;
      else if (postCount > 25) userRankLevel = 2;
      else userRankLevel = 1;
    } else if (packType === 'clan') {
      targetClan = await Clan.findOne({ members: user._id });
      if (!targetClan) {
        return NextResponse.json({ success: false, error: "You must be in a clan to view clan packs" }, { status: 403 });
      }
      userRankLevel = targetClan.rank || 1;
      const userIdStr = user._id.toString();
      isAuthorizedToBuy = targetClan.leader?.toString() === userIdStr || targetClan.viceLeader?.toString() === userIdStr;
    }

    const packCatalog = {
      // --- AUTHOR PACKS (UNCHANGED) ---
      author: [
        {
          id: 'chuninpack',
          name: 'The Chunin Pack',
          description: 'Reach Rank 2',
          storeId: 'chuninpack',
          requiredRank: 2,
          price: 1.5,
          color: '#808080',
          bannerImage: 'https://your-storage.com/banners/chunin_bg.jpg',
          rewards: [
            { type: 'OC', amount: 1500, label: '1500 OC' },
            { 
              type: 'WATERMARK', 
              id: 'iron_pen_wm', 
              name: 'The Iron Pen', 
              label: 'Metallic Grey Watermark',
              visualConfig: {
                svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.12 19.93L12 21.05L10.88 19.93C7.05 19.44 4 16.08 4 12C4 11.38 4.08 10.78 4.21 10.21L9 15V16C9 17.1 9.9 18 11 18V19.93ZM17.9 17.39C17.64 16.58 16.9 16 16 16H15V13C15 12.45 14.55 12 14 12H8V10H10C10.55 10 11 9.55 11 9V7H13C14.1 7 15 6.1 15 5V4.59C17.93 5.78 20 8.65 20 12C20 14.08 19.2 15.97 17.9 17.39Z" fill="currentColor"/></svg>`,
                primaryColor: '#808080',
                isAnimated: false
              }
            },
            { type: 'MULTIPLIER', value: 2, duration: 7, label: 'x2 Streak (7 Days)' }
          ],
          visualData: { icon: 'shield-star', rarity: 'Common' }
        },
        {
          id: 'joninpack',
          name: 'The Jonin Pack',
          description: 'Rank 4',
          storeId: 'joninpack',
          requiredRank: 4,
          price: 5.0,
          color: '#C0C0C0',
          bannerImage: 'https://your-storage.com/banners/jonin_bg.jpg',
          rewards: [
            { type: 'OC', amount: 5500, label: '5500 OC' },
            { 
              type: 'WATERMARK', 
              id: 'silver_pen_wm', 
              name: 'The Silver Pen', 
              label: 'Shimmering Silver Watermark',
              visualConfig: {
                svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6C4.89 2 4 2.9 4 4V20C4 21.1 4.89 22 6 22H18C19.11 22 20 21.1 20 20V8L14 2ZM12 18H8V16H12V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z" fill="currentColor"/></svg>`,
                primaryColor: '#C0C0C0',
                isAnimated: false
              }
            },
            { type: 'BADGE', id: 'green_quill_badge', name: 'The Green Quill', visualConfig: { svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.24 12.24C21.36 11.12 22 9.63 22 8V2H16C14.37 2 12.88 2.64 11.76 3.76L2 13.52V22H10.48L20.24 12.24Z" fill="currentColor"/></svg>`, primaryColor: '#10b981', isAnimated: false }},
            { type: 'MULTIPLIER', value: 2, duration: 7, label: 'x2 Streak (7 Days)' }
          ],
          visualData: { icon: 'medal', rarity: 'Rare' }
        },
        {
          id: 'kagepack',
          name: 'The Kage Pack',
          description: 'Rank 6',
          storeId: 'kagepack',
          requiredRank: 6,
          price: 12.0,
          color: '#FFD700',
          bannerImage: 'https://your-storage.com/banners/kage_bg.jpg',
          rewards: [
            { type: 'OC', amount: 15000, label: '15000 OC' },
            { type: 'WATERMARK', id: 'golden_pen_wm', name: 'The Golden Pen', visualConfig: { svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/></svg>`, primaryColor: '#FFD700', isAnimated: false }},
            { type: 'BORDER', id: 'uzumaki_swirl_border', name: 'Uzumaki Swirl', visualConfig: { animationType: 'singleSnake', primaryColor: '#FFD700', duration: 2500, snakeLength: 140, isAnimated: true }},
            { type: 'BADGE', id: 'red_quill_badge', name: 'The Red Quill', visualConfig: { svgCode: `<svg viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg"><path d="M20.24 12.24L10.48 22H2V13.52L11.76 3.76C12.88 2.64 14.37 2 16 2H22V8C22 9.63 21.36 11.12 20.24 12.24Z"/></svg>`, primaryColor: '#ef4444', isAnimated: false }}
          ],
          visualData: { icon: 'crown', rarity: 'Legendary' }
        }
      ],
      // --- UPDATED CLAN PACKS (AS PER BOOK & VERIFICATION TIERS) ---
      clan: [
        {
          id: 'wandering_ronin_pack',
          name: 'Wandering Ronin Pack',
          description: 'Basic Clan Starter Pack',
          storeId: 'wandering_ronin_pack',
          requiredRank: 1, 
          price: 2.0,
          color: '#808080',
          rewards: [
            { type: 'CC', amount: 500, label: '500 CC' },
            { type: 'BACKGROUND', id: 'iron_banner_bg', name: 'Iron Banner', visualConfig: { svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" fill="#808080"/></svg>`, primaryColor: '#808080', isAnimated: false }},
            { type: 'UPGRADE', id: 'slot_upgrade_2', value: 2, label: '+2 Member Slots' },
            { type: 'MULTIPLIER', value: 2, duration: 7, label: 'x2 Clan Point Multiplier (7 Days)' },
            { type: 'GLOW', id: 'simple_green_glow', name: 'Simple Green Glow', visualConfig: { primaryColor: '#22c55e' }}
          ],
          visualData: { icon: 'sword', rarity: 'Common' }
        },
        {
          id: 'squad_13_pack',
          name: 'Squad 13 Pack',
          description: 'Reach Clan Rank 2',
          storeId: 'squad_13_pack',
          requiredRank: 2,
          price: 6.0,
          color: '#CD7F32',
          rewards: [
            { type: 'CC', amount: 1200, label: '1200 CC' },
            { type: 'BACKGROUND', id: 'bronze_banner_bg', name: 'Bronze Banner', visualConfig: { svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" fill="#CD7F32"/></svg>`, primaryColor: '#CD7F32', isAnimated: false }},
            { type: 'UPGRADE', id: 'slot_upgrade_2_squad', value: 2, label: '+2 Member Slots' },
            { type: 'MULTIPLIER', value: 2, duration: 7, label: 'x2 Multiplier (7 Days)' }
          ],
          visualData: { icon: 'account-group', rarity: 'Uncommon' }
        },
        {
          id: 'upper_moon_pack',
          name: 'Upper Moon Pack',
          description: 'Rank 3 - Shining Silver',
          storeId: 'upper_moon_pack',
          requiredRank: 3,
          price: 10.0,
          color: '#C0C0C0',
          rewards: [
            { type: 'CC', amount: 2500, label: '2500 CC' },
            { type: 'BACKGROUND', id: 'silver_banner_bg', name: 'Silver Banner', visualConfig: { primaryColor: '#C0C0C0', isAnimated: false }},
            { type: 'BADGE', id: 'blue_moon_badge', name: 'Blue Moon', visualConfig: { svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3C10.45 3 8.97 3.46 7.71 4.31C11.16 5.86 13.5 9.18 13.5 13C13.5 16.82 11.16 20.14 7.71 21.69C8.97 22.54 10.45 23 12 23C17.52 23 22 18.52 22 13C22 7.48 17.52 3 12 3Z" fill="#3b82f6"/></svg>`, primaryColor: '#3b82f6' }},
            { 
                type: 'PERK', id: 'verified_standard_7', label: 'Elite Verification (7 Days)',
                visualConfig: { tier: 'standard', glowColor: '#ef4444', svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L12 2L13.71 3.86L16.25 3.51L17.33 5.82L19.78 6.55L19.74 9.1L21.49 10.95L20.25 13.2L21 15.65L18.81 17.07L18.15 19.52L15.73 20L13.91 21.75L12 21L10.09 21.75L8.27 20L5.85 19.52L5.19 17.07L3 15.65L3.75 13.2L2.51 10.95L4.26 9.1L4.22 6.55L6.67 5.82L7.75 3.51L10.29 3.86Z" fill="#ef4444" fill-opacity="0.3" stroke="#ef4444" stroke-width="2"/><path d="M9 12L11 14L15 10" stroke="#ef4444" stroke-width="2.5"/></svg>` }
            }
          ],
          visualData: { icon: 'moon-waning-crescent', rarity: 'Rare' }
        },
        {
          id: 'phantom_troupe_pack',
          name: 'Phantom Troupe Pack',
          description: 'Rank 4 - Obsidian Theme',
          storeId: 'phantom_troupe_pack',
          requiredRank: 4,
          price: 20.0,
          color: '#1a1a1a',
          rewards: [
            { type: 'CC', amount: 5000, label: '5000 CC' },
            { type: 'BACKGROUND', id: 'obsidian_banner', name: 'Obsidian Banner', visualConfig: { primaryColor: '#2e1065', isAnimated: false }},
            { type: 'BADGE', id: 'spider_badge', name: 'The Spider', visualConfig: { svgCode: `<svg viewBox="0 0 24 24" fill="#ffffff" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C11.45 2 11 2.45 11 3V4.07C10.3 4.21 9.64 4.47 9.05 4.83L8.29 4.07C7.9 3.68 7.27 3.68 6.88 4.07C6.49 4.46 6.49 5.09 6.88 5.48L7.64 6.24C7.28 6.83 7.02 7.49 6.88 8.19H5.81C5.26 8.19 4.81 8.64 4.81 9.19C4.81 9.74 5.26 10.19 5.81 10.19H6.88C7.02 10.89 7.28 11.55 7.64 12.14L6.88 12.9C6.49 13.29 6.49 13.92 6.88 14.31C7.27 14.7 7.9 14.7 8.29 14.31L9.05 13.55C9.64 13.91 10.3 14.17 11 14.31V15.38C11 15.93 11.45 16.38 12 16.38C12.55 16.38 13 15.93 13 15.38V14.31C13.7 14.17 14.36 13.91 14.95 13.55L15.71 14.31C16.1 14.7 16.73 14.7 17.12 14.31C17.51 13.92 17.51 13.29 17.12 12.9L16.36 12.14C16.72 11.55 16.98 10.89 17.12 10.19H18.19C18.74 10.19 19.19 9.74 19.19 9.19C19.19 8.64 18.74 8.19 18.19 8.19H17.12C16.98 7.49 16.72 6.83 16.36 6.24L17.12 5.48C17.51 5.09 17.51 4.46 17.12 4.07C16.73 3.68 16.1 3.68 15.71 4.07L14.95 4.83C14.36 4.47 13.7 4.21 13 4.07V3C13 2.45 12.55 2 12 2Z"/></svg>`, primaryColor: '#ffffff' }},
            { type: 'WATERMARK', id: 'spider_wm', name: 'The Spider', visualConfig: { primaryColor: '#ffffff' }},
            { 
                type: 'PERK', id: 'verified_standard_7_pt', label: 'Elite Verification (7 Days)',
                visualConfig: { tier: 'standard', glowColor: '#ef4444', svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L12 2L13.71 3.86L16.25 3.51L17.33 5.82L19.78 6.55L19.74 9.1L21.49 10.95L20.25 13.2L21 15.65L18.81 17.07L18.15 19.52L15.73 20L13.91 21.75L12 21L10.09 21.75L8.27 20L5.85 19.52L5.19 17.07L3 15.65L3.75 13.2L2.51 10.95L4.26 9.1L4.22 6.55L6.67 5.82L7.75 3.51L10.29 3.86Z" fill="#ef4444" fill-opacity="0.3" stroke="#ef4444" stroke-width="2"/><path d="M9 12L11 14L15 10" stroke="#ef4444" stroke-width="2.5"/></svg>` }
            }
          ],
          visualData: { icon: 'spider', rarity: 'Epic' }
        },
        {
          id: 'the_espada_pack',
          name: 'The Espada Pack',
          description: 'Rank 5 - Jade Hollow',
          storeId: 'the_espada_pack',
          requiredRank: 5,
          price: 30.0,
          color: '#00A86B',
          rewards: [
            { type: 'CC', amount: 7000, label: '7000 CC' },
            { type: 'BACKGROUND', id: 'jade_banner_bg', name: 'Jade Banner', visualConfig: { primaryColor: '#00A86B' }},
            { type: 'BADGE', id: 'hollow_mask_badge', name: 'Hollow Mask', visualConfig: { primaryColor: '#ffffff' }},
            { type: 'WATERMARK', id: 'hollow_mask_wm', name: 'The Hollow Mask', visualConfig: { primaryColor: '#ffffff' }},
            { 
                type: 'PERK', id: 'verified_standard_30', label: 'Elite Verification (30 Days)',
                visualConfig: { tier: 'standard', glowColor: '#ef4444', svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L12 2L13.71 3.86L16.25 3.51L17.33 5.82L19.78 6.55L19.74 9.1L21.49 10.95L20.25 13.2L21 15.65L18.81 17.07L18.15 19.52L15.73 20L13.91 21.75L12 21L10.09 21.75L8.27 20L5.85 19.52L5.19 17.07L3 15.65L3.75 13.2L2.51 10.95L4.26 9.1L4.22 6.55L6.67 5.82L7.75 3.51L10.29 3.86Z" fill="#ef4444" fill-opacity="0.3" stroke="#ef4444" stroke-width="2"/><path d="M9 12L11 14L15 10" stroke="#ef4444" stroke-width="2.5"/></svg>` }
            },
            { type: 'GLOW', id: 'orange_glow', name: 'Orange Glow', visualConfig: { primaryColor: '#f97316' }}
          ],
          visualData: { icon: 'skull', rarity: 'Legendary' }
        },
        {
          id: 'the_akatsuki_pack',
          name: 'The Akatsuki Pack',
          description: 'Rank 6 - Mythic Theme',
          storeId: 'the_akatsuki_pack',
          requiredRank: 6,
          price: 50.0,
          color: '#FF0000',
          rewards: [
            { type: 'CC', amount: 10000, label: '10,000 CC' },
            { type: 'BACKGROUND', id: 'red_banner_bg', name: 'Red Banner', visualConfig: { primaryColor: '#FF0000', isAnimated: true }},
            { type: 'BADGE', id: 'red_cloud_badge', name: 'The Red Cloud', visualConfig: { svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="#FF0000"/></svg>`, primaryColor: '#FF0000', isAnimated: false }},
            { 
                type: 'PERK', id: 'verified_premium_30', label: 'Godly Verification (30 Days)',
                visualConfig: { tier: 'premium', glowColor: '#facc15', svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L12 2L13.71 3.86L16.25 3.51L17.33 5.82L19.78 6.55L19.74 9.1L21.49 10.95L20.25 13.2L21 15.65L18.81 17.07L18.15 19.52L15.73 20L13.91 21.75L12 21L10.09 21.75L8.27 20L5.85 19.52L5.19 17.07L3 15.65L3.75 13.2L2.51 10.95L4.26 9.1L4.22 6.55L6.67 5.82L7.75 3.51L10.29 3.86Z" fill="#facc15" fill-opacity="0.3" stroke="#facc15" stroke-width="2"/><path d="M9 12L11 14L15 10" stroke="#facc15" stroke-width="2.5"/></svg>` }
            },
            { type: 'GLOW', id: 'pineapple_glow', name: 'Yellow Glow', visualConfig: { primaryColor: '#facc15' }},
            { type: 'WATERMARK_PULL', id: 'akatsuki_random_wm', label: 'Random Akatsuki Watermark' }
          ],
          visualData: { icon: 'cloud', rarity: 'Mythic' }
        }
      ]
    };

    const rawPacks = packCatalog[packType] || [];

    const processedPacks = rawPacks.map(pack => {
      let isPurchased = false;

      if (packType === 'clan') {
        isPurchased = targetClan.purchasedPacks?.includes(pack.id) || false;
      } else {
        const uniqueRewardIds = pack.rewards.filter(r => r.id).map(r => r.id);
        isPurchased = uniqueRewardIds.some(id => 
          user.inventory && user.inventory.some(invItem => invItem.itemId === id)
        );
      }

      const isLocked = userRankLevel < pack.requiredRank;
      const canPurchase = !isPurchased && !isLocked && isAuthorizedToBuy;

      return {
        ...pack,
        isPurchased,
        isLocked,
        canPurchase,
        isAuthorizedToBuy,
        currentRankLevel: userRankLevel,
        userPostCount: postCount
      };
    });

    return NextResponse.json({ 
      success: true, 
      packs: processedPacks,
      meta: {
        postCount,
        rankLevel: userRankLevel,
        type: packType,
        clanTag: targetClan?.tag || null
      }
    });

  } catch (error) {
    console.error("Pack Fetch Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
            }
