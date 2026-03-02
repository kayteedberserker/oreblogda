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
        svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L12 2L13.71 3.86L16.25 3.51L17.33 5.82L19.78 6.55L19.74 9.1L21.49 10.95L20.25 13.2L21 15.65L18.81 17.07L18.15 19.52L15.73 20L13.91 21.75L12 21L10.09 21.75L8.27 20L5.85 19.52L5.19 17.07L3 15.65L3.75 13.2L2.51 10.95L4.26 9.1L4.22 6.55L6.67 5.82L7.75 3.51L10.29 3.86Z" fill="#ef4444" fill-opacity="0.3" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12L11 14L15 10" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      }
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
        svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L12 2L13.71 3.86L16.25 3.51L17.33 5.82L19.78 6.55L19.74 9.1L21.49 10.95L20.25 13.2L21 15.65L18.81 17.07L18.15 19.52L15.73 20L13.91 21.75L12 21L10.09 21.75L8.27 20L5.85 19.52L5.19 17.07L3 15.65L3.75 13.2L2.51 10.95L4.26 9.1L4.22 6.55L6.67 5.82L7.75 3.51L10.29 3.86Z" fill="#ef4444" fill-opacity="0.3" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12L11 14L15 10" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      }
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
        svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L12 2L13.71 3.86L16.25 3.51L17.33 5.82L19.78 6.55L19.74 9.1L21.49 10.95L20.25 13.2L21 15.65L18.81 17.07L18.15 19.52L15.73 20L13.91 21.75L12 21L10.09 21.75L8.27 20L5.85 19.52L5.19 17.07L3 15.65L3.75 13.2L2.51 10.95L4.26 9.1L4.22 6.55L6.67 5.82L7.75 3.51L10.29 3.86Z" fill="#facc15" fill-opacity="0.3" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12L11 14L15 10" stroke="#facc15" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      }
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
        svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L12 2L13.71 3.86L16.25 3.51L17.33 5.82L19.78 6.55L19.74 9.1L21.49 10.95L20.25 13.2L21 15.65L18.81 17.07L18.15 19.52L15.73 20L13.91 21.75L12 21L10.09 21.75L8.27 20L5.85 19.52L5.19 17.07L3 15.65L3.75 13.2L2.51 10.95L4.26 9.1L4.22 6.55L6.67 5.82L7.75 3.51L10.29 3.86Z" fill="#facc15" fill-opacity="0.3" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12L11 14L15 10" stroke="#facc15" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      }
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
      iconsvg: `<svg xmlns="http://www.w3.org/2000/svg" width="237" height="212" viewBox="0 0 237 212" version="1.1">
  <defs>
    <filter id="finalFireGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur result="blur">
        <animate attributeName="stdDeviation" values="1;2;1" dur="3s" repeatCount="indefinite" />
      </feGaussianBlur>
      <feFlood flood-color="#ff0000" result="color" />
      <feComposite in="color" in2="blur" operator="in" result="glow" />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <g filter="url(#finalFireGlow)">
    <g fill="#a30000">
      <path d="M 75.571 1.571 C 73.223 3.920, 73.654 6.040, 77.453 10.819 C 81.243 15.586, 82.253 19.407, 84.090 35.912 C 85.587 49.364, 84.738 87.387, 82.569 104 C 77.908 139.706, 63.191 166.884, 38.424 185.525 C 34.423 188.536, 30.936 191, 30.675 191 C 30.414 191, 27.796 192.618, 24.857 194.596 C 21.917 196.574, 15.351 200.436, 10.265 203.178 C 5.179 205.920, 0.776 208.554, 0.481 209.032 C 0.185 209.509, 0.816 210.366, 1.882 210.937 C 7.265 213.818, 36.258 205.844, 57.500 195.640 C 69.235 190.003, 83.319 179.329, 90.361 170.735 C 97.363 162.190, 105.914 146.325, 110.414 133.529 C 110.948 132.009, 113.175 135.555, 120.145 149.029 C 130.753 169.534, 137.052 180.268, 147.709 196 C 158.675 212.187, 158.975 212.323, 182 211.496 C 209.787 210.498, 232.249 207.180, 235.895 203.534 C 238.597 200.832, 236.139 199.033, 220.877 192.544 C 204.301 185.497, 191.830 178.968, 181.036 171.686 C 168.736 163.387, 146.446 139.738, 124.233 111.416 L 117.108 102.332 119.063 88.916 C 120.138 81.537, 121.488 68.975, 122.063 61 C 124.463 27.725, 124.471 27.673, 127.332 23.461 C 131.998 16.596, 130.238 10.957, 122.500 7.979 C 105.157 1.303, 79.361 -2.219, 75.571 1.571 Z">
        <animate attributeName="fill" values="#a30000;#d40000;#a30000" dur="2s" repeatCount="indefinite" />
      </path>
      <path d="M 158.667 37.667 C 158.300 38.033, 158 39.559, 158 41.057 C 158 48.725, 146.889 81.330, 138.816 97.354 C 133.135 108.628, 136.980 108.763, 155.043 97.926 C 170.124 88.878, 188.766 76.558, 193.875 72.265 C 200.297 66.867, 197.790 61.694, 182.944 49.711 C 171.612 40.566, 161.022 35.311, 158.667 37.667 Z"/>
      <path d="M 21.750 61.571 C 20.242 63.104, 21.128 66.161, 27.577 81.676 C 34.953 99.424, 41.004 111.336, 45.274 116.516 C 47.613 119.354, 48.834 120, 51.861 120 C 56.536 120, 63.747 116.374, 66.441 112.669 C 69.132 108.969, 69.153 98.005, 66.485 89.500 C 63.493 79.962, 52.587 70.640, 37.106 64.387 C 30.626 61.769, 22.941 60.360, 21.750 61.571 Z"/>
    </g>
    <animate attributeName="opacity" values="1;0.9;1" dur="0.5s" repeatCount="indefinite" />
  </g>
  <animateTransform attributeName="transform" type="scale" values="1;1.005;1" dur="4s" repeatCount="indefinite" transform-origin="center" additive="sum" />
</svg>`,
      items: [] 
    }
  ]
};

/**
 * GET Route Handler
 * Usage: /api/shop?type=clan or /api/shop?type=author
 */
export async function GET(req) {
  try {
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
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Invalid request' },
      { status: 400 }
    );
  }
}
