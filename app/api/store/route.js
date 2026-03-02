import { NextResponse } from 'next/server';

// --- ✍️ AUTHOR CATALOG (OC) ---
const AUTHOR_CATALOG = {
  themes: [
    {
      id: 'scribe_basics',
      label: 'Way of the Scribe',
      icon: 'pencil',
      items: [] // Items to be added one by one
    }
  ],
  standaloneItems: [] 
};

// --- 🛡️ CLAN CATALOG (CC) ---
const CLAN_CATALOG = {
  // Non-themed items like Upgrades and Verification
  standaloneItems: [
    // --- VERIFIED BADGES (BASIC - BLUE) ---
    {
      id: 'verified_basic_7d',
      name: 'Basic Verification (7D)',
      price: 200,
      category: 'VERIFIED',
      durationDays: 7,
      visualData: {
        glowColor: '#3b82f6',
        tier: 'basic',
        svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L12 2L13.71 3.86L16.25 3.51L17.33 5.82L19.78 6.55L19.74 9.1L21.49 10.95L20.25 13.2L21 15.65L18.81 17.07L18.15 19.52L15.73 20L13.91 21.75L12 21L10.09 21.75L8.27 20L5.85 19.52L5.19 17.07L3 15.65L3.75 13.2L2.51 10.95L4.26 9.1L4.22 6.55L6.67 5.82L7.75 3.51L10.29 3.86Z" fill="#3b82f6" fill-opacity="0.15" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12L11 14L15 10" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      }
    },
    {
      id: 'verified_basic_30d',
      name: 'Basic Verification (30D)',
      price: 700,
      category: 'VERIFIED',
      durationDays: 30,
      visualData: {
        glowColor: '#3b82f6',
        tier: 'basic',
        svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L12 2L13.71 3.86L16.25 3.51L17.33 5.82L19.78 6.55L19.74 9.1L21.49 10.95L20.25 13.2L21 15.65L18.81 17.07L18.15 19.52L15.73 20L13.91 21.75L12 21L10.09 21.75L8.27 20L5.85 19.52L5.19 17.07L3 15.65L3.75 13.2L2.51 10.95L4.26 9.1L4.22 6.55L6.67 5.82L7.75 3.51L10.29 3.86Z" fill="#3b82f6" fill-opacity="0.15" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12L11 14L15 10" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      }
    },
    // --- VERIFIED BADGES (STANDARD - RED) ---
    {
      id: 'verified_standard_7d',
      name: 'Elite Verification (7D)',
      price: 500,
      category: 'VERIFIED',
      durationDays: 7,
      visualData: {
        glowColor: '#ef4444',
        tier: 'standard',
        svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L12 2L13.71 3.86L16.25 3.51L17.33 5.82L19.78 6.55L19.74 9.1L21.49 10.95L20.25 13.2L21 15.65L18.81 17.07L18.15 19.52L15.73 20L13.91 21.75L12 21L10.09 21.75L8.27 20L5.85 19.52L5.19 17.07L3 15.65L3.75 13.2L2.51 10.95L4.26 9.1L4.22 6.55L6.67 5.82L7.75 3.51L10.29 3.86Z" fill="#ef4444" fill-opacity="0.3" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12L11 14L15 10" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
    
    },
    {
      id: 'verified_standard_30d',
      name: 'Elite Verification (30D)',
      price: 1800,
      category: 'VERIFIED',
      durationDays: 30,
      visualData: {
        glowColor: '#ef4444',
        tier: 'standard',
        svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L12 2L13.71 3.86L16.25 3.51L17.33 5.82L19.78 6.55L19.74 9.1L21.49 10.95L20.25 13.2L21 15.65L18.81 17.07L18.15 19.52L15.73 20L13.91 21.75L12 21L10.09 21.75L8.27 20L5.85 19.52L5.19 17.07L3 15.65L3.75 13.2L2.51 10.95L4.26 9.1L4.22 6.55L6.67 5.82L7.75 3.51L10.29 3.86Z" fill="#ef4444" fill-opacity="0.3" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12L11 14L15 10" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
    },
    // --- VERIFIED BADGES (PREMIUM - GOLD) ---
    {
      id: 'verified_premium_7d',
      name: 'Godly Verification (7D)',
      price: 1200,
      category: 'VERIFIED',
      durationDays: 7,
      visualData: {
        glowColor: '#facc15',
        tier: 'premium',
        svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L12 2L13.71 3.86L16.25 3.51L17.33 5.82L19.78 6.55L19.74 9.1L21.49 10.95L20.25 13.2L21 15.65L18.81 17.07L18.15 19.52L15.73 20L13.91 21.75L12 21L10.09 21.75L8.27 20L5.85 19.52L5.19 17.07L3 15.65L3.75 13.2L2.51 10.95L4.26 9.1L4.22 6.55L6.67 5.82L7.75 3.51L10.29 3.86Z" fill="#facc15" fill-opacity="0.3" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12L11 14L15 10" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
    },
    {
      id: 'verified_premium_30d',
      name: 'Godly Verification (30D)',
      price: 4000,
      category: 'VERIFIED',
      durationDays: 30,
      visualData: {
        glowColor: '#facc15',
        tier: 'premium',
        svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L12 2L13.71 3.86L16.25 3.51L17.33 5.82L19.78 6.55L19.74 9.1L21.49 10.95L20.25 13.2L21 15.65L18.81 17.07L18.15 19.52L15.73 20L13.91 21.75L12 21L10.09 21.75L8.27 20L5.85 19.52L5.19 17.07L3 15.65L3.75 13.2L2.51 10.95L4.26 9.1L4.22 6.55L6.67 5.82L7.75 3.51L10.29 3.86Z" fill="#facc15" fill-opacity="0.3" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12L11 14L15 10" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
    },
    // --- CLAN UPGRADES ---
    {
      id: 'increase_slot_1',
      name: 'Expand Garrison (+1 Slot)',
      price: 1500,
      category: 'UPGRADE',
      visualData: {
        icon: 'person-add',
        color: '#10b981',
        svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.5" cy="7" r="4" stroke="currentColor" stroke-width="2"/><line x1="20" y1="8" x2="20" y2="14" stroke="#10b981" stroke-width="2" stroke-linecap="round"/><line x1="17" y1="11" x2="23" y2="11" stroke="#10b981" stroke-width="2" stroke-linecap="round"/></svg>`
      }
    }
  ],
  themes: [
    {
      id: 'ninja_way',
      label: 'The Ninja Way',
      // Dynamic SVG for the fire icon
      iconsvg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 21C15.866 21 19 17.866 19 14C19 12.38 18.44 10.89 17.5 9.72C16.94 9.02 16.27 8.41 15.5 7.91C15.21 7.72 14.86 7.82 14.67 8.11C14.48 8.4 14.58 8.75 14.87 8.94C15.41 9.29 15.89 9.72 16.3 10.23C16.91 10.98 17.29 11.91 17.29 12.92C17.29 15.35 15.33 17.31 12.91 17.31C10.48 17.31 8.52 15.35 8.52 12.92C8.52 11.53 9.17 10.3 10.19 9.5C10.45 9.3 10.51 8.93 10.31 8.67C10.11 8.41 9.74 8.35 9.48 8.55C8.12 9.61 7.23 11.26 7.23 13.11C7.23 17.03 10.45 20.25 14.37 20.25C14.54 20.25 14.71 20.24 14.87 20.22C14.07 20.72 13.1 21 12 21ZM12 3C12 3 12 7 9 9C10 7 11 4 11 3C11 2.45 11.45 2 12 2C12.55 2 13 2.45 13 3C13 4 14 7 15 9C12 7 12 3 12 3Z" fill="currentColor"/></svg>`,
      items: [] 
    }
  ]
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const shopType = searchParams.get('type'); // 'author' or 'clan'

  if (shopType === 'clan') {
    return NextResponse.json({ 
      success: true, 
      currency: 'CC',
      catalog: CLAN_CATALOG 
    });
  }

  // Default to Author shop
  return NextResponse.json({ 
    success: true, 
    currency: 'OC',
    catalog: AUTHOR_CATALOG 
  });
}