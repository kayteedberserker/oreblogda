import MobileUser from '@/app/models/MobileUserModel';
import Post from '@/app/models/PostModel'; // Needed for rank calculation
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const packType = searchParams.get('type') || 'author';
    const deviceId = req.headers.get('x-user-deviceId');

    if (!deviceId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch User and their Post Count for Rank Logic
    const user = await MobileUser.findOne({ deviceId });
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Assuming posts are linked to user via their MongoDB _id
    const postCount = await Post.countDocuments({ authorUserId: user._id });
    console.log(postCount);
    
    // 2. Determine Numeric Rank Level
    // Rank 1: Novice_Researcher (< 25)
    // Rank 2: Senior_Researcher (25-50)
    // Rank 3: Novice_Writer (51-100)
    // Rank 4: Senior_Writer (101-150)
    // Rank 5: Elite_Writer (151-200)
    // Rank 6: Master_Writer (> 200)
    let userRankLevel = 1;
    if (postCount > 200) userRankLevel = 6;
    else if (postCount > 150) userRankLevel = 5;
    else if (postCount > 100) userRankLevel = 4;
    else if (postCount > 50) userRankLevel = 3;
    else if (postCount > 25) userRankLevel = 2;

    const packCatalog = {
      author: [
        {
          id: 'chuninpack',
          name: 'The Chunin Pack',
          description: 'Reach Rank 2',
          storeId: 'chuninpack',
          requiredRank: 2, // Added for logic
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
            { 
              type: 'MULTIPLIER', 
              value: 2, 
              duration: 7, 
              label: 'x2 Streak (7 Days)' 
            }
          ],
          visualData: { icon: 'shield-star', rarity: 'Common' }
        },
        {
          id: 'joninpack',
          name: 'The Jonin Pack',
          description: 'Rank 4',
          storeId: 'joninpack',
          requiredRank: 4, // Added for logic
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
            { 
              type: 'BADGE', 
              id: 'green_quill_badge', 
              name: 'The Green Quill',
              visualConfig: {
                svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.24 12.24C21.36 11.12 22 9.63 22 8V2H16C14.37 2 12.88 2.64 11.76 3.76L2 13.52V22H10.48L20.24 12.24Z" fill="currentColor"/></svg>`,
                primaryColor: '#10b981',
                isAnimated: false
              }
            },
            { 
              type: 'MULTIPLIER', 
              value: 2, 
              duration: 7, 
              label: 'x2 Streak (7 Days)' 
            }
          ],
          visualData: { icon: 'medal', rarity: 'Rare' }
        },
        {
          id: 'kagepack',
          name: 'The Kage Pack',
          description: 'Rank 6',
          storeId: 'kagepack',
          requiredRank: 6, // Added for logic
          price: 12.0,
          color: '#FFD700',
          bannerImage: 'https://your-storage.com/banners/kage_bg.jpg',
          rewards: [
            { type: 'OC', amount: 15000, label: '15000 OC' },
            { 
              type: 'WATERMARK', 
              id: 'golden_pen_wm', 
              name: 'The Golden Pen', 
              visualConfig: {
                svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/></svg>`,
                primaryColor: '#FFD700',
                isAnimated: false
              }
            },
            { 
              type: 'BORDER', 
              id: 'uzumaki_swirl_border', 
              name: 'Uzumaki Swirl',
              visualConfig: {
                animationType: 'singleSnake',
                primaryColor: '#FFD700',
                duration: 2500,
                snakeLength: 140,
                isAnimated: true
              }
            },
            { 
              type: 'GLOW', 
              id: 'jade_glow_item', 
              name: 'Jade Glow', 
              visualConfig: {
                svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="currentColor" fill-opacity="0.3"/></svg>`,
                primaryColor: '#00A86B',
                isAnimated: true
              }
            },
            { 
              type: 'BADGE', 
              id: 'red_quill_badge', 
              name: 'The Red Quill',
              visualConfig: {
                svgCode: `<svg viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg"><path d="M20.24 12.24L10.48 22H2V13.52L11.76 3.76C12.88 2.64 14.37 2 16 2H22V8C22 9.63 21.36 11.12 20.24 12.24Z"/></svg>`,
                primaryColor: '#ef4444',
                isAnimated: false
              }
            }
          ],
          visualData: { icon: 'crown', rarity: 'Legendary' }
        }
      ]
    };

    const rawPacks = packCatalog[packType] || [];

    // 3. Map status flags to each pack
    const processedPacks = rawPacks.map(pack => {
      // Check if user already owns any unique digital asset from this pack
      const uniqueRewardIds = pack.rewards
        .filter(r => r.id)
        .map(r => r.id);

      const isPurchased = uniqueRewardIds.some(id => 
        user.inventory && user.inventory.some(invItem => invItem.itemId === id)
      );

      const isLocked = userRankLevel < pack.requiredRank;
      const canPurchase = !isPurchased && !isLocked;

      return {
        ...pack,
        isPurchased,
        isLocked,
        canPurchase,
        currentRankLevel: userRankLevel,
        userPostCount: postCount
      };
    });
    console.log(processedPacks);
    
    return NextResponse.json({ 
      success: true, 
      packs: processedPacks,
      meta: {
        postCount,
        rankLevel: userRankLevel
      }
    });

  } catch (error) {
    console.error("Pack Fetch Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}