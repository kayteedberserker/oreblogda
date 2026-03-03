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
      label: 'The Will of Fire',
      // Optimized for React Native: Removed SMIL animations and complex filters
      iconsvg: `<svg xmlns="http://www.w3.org/2000/svg" width="237" height="212" viewBox="0 0 237 212">
  <g>
    <path fill="#d40000" d="M 75.571 1.571 C 73.223 3.920, 73.654 6.040, 77.453 10.819 C 81.243 15.586, 82.253 19.407, 84.090 35.912 C 85.587 49.364, 84.738 87.387, 82.569 104 C 77.908 139.706, 63.191 166.884, 38.424 185.525 C 34.423 188.536, 30.936 191, 30.675 191 C 30.414 191, 27.796 192.618, 24.857 194.596 C 21.917 196.574, 15.351 200.436, 10.265 203.178 C 5.179 205.920, 0.776 208.554, 0.481 209.032 C 0.185 209.509, 0.816 210.366, 1.882 210.937 C 7.265 213.818, 36.258 205.844, 57.500 195.640 C 69.235 190.003, 83.319 179.329, 90.361 170.735 C 97.363 162.190, 105.914 146.325, 110.414 133.529 C 110.948 132.009, 113.175 135.555, 120.145 149.029 C 130.753 169.534, 137.052 180.268, 147.709 196 C 158.675 212.187, 158.975 212.323, 182 211.496 C 209.787 210.498, 232.249 207.180, 235.895 203.534 C 238.597 200.832, 236.139 199.033, 220.877 192.544 C 204.301 185.497, 191.830 178.968, 181.036 171.686 C 168.736 163.387, 146.446 139.738, 124.233 111.416 L 117.108 102.332 119.063 88.916 C 120.138 81.537, 121.488 68.975, 122.063 61 C 124.463 27.725, 124.471 27.673, 127.332 23.461 C 131.998 16.596, 130.238 10.957, 122.500 7.979 C 105.157 1.303, 79.361 -2.219, 75.571 1.571 Z" />
    <path fill="#d40000" d="M 158.667 37.667 C 158.300 38.033, 158 39.559, 158 41.057 C 158 48.725, 146.889 81.330, 138.816 97.354 C 133.135 108.628, 136.980 108.763, 155.043 97.926 C 170.124 88.878, 188.766 76.558, 193.875 72.265 C 200.297 66.867, 197.790 61.694, 182.944 49.711 C 171.612 40.566, 161.022 35.311, 158.667 37.667 Z" />
    <path fill="#d40000" d="M 21.750 61.571 C 20.242 63.104, 21.128 66.161, 27.577 81.676 C 34.953 99.424, 41.004 111.336, 45.274 116.516 C 47.613 119.354, 48.834 120, 51.861 120 C 56.536 120, 63.747 116.374, 66.441 112.669 C 69.132 108.969, 69.153 98.005, 66.485 89.500 C 63.493 79.962, 52.587 70.640, 37.106 64.387 C 30.626 61.769, 22.941 60.360, 21.750 61.571 Z" />
  </g>
</svg>`
    },
    {
      id: 'yin_yang',
      label: 'Yin and Yang',
      // Optimized for React Native: Transparent background + simplified Blue Stroke for Glow
      iconsvg: `<svg xmlns="http://www.w3.org/2000/svg" width="225" height="225" viewBox="0 0 225 225">
  <g>
    <path 
      stroke="#0055ff" 
      stroke-width="2" 
      fill="#0c0c0c" 
      fill-rule="evenodd"
      d="M 93 34.043 C 65.246 41.194, 43.577 62.044, 34.843 90 C 32.823 96.466, 32.500 99.569, 32.500 112.500 C 32.500 125.431, 32.823 128.534, 34.843 135 C 43.301 162.073, 62.927 181.699, 90 190.157 C 96.466 192.177, 99.569 192.500, 112.500 192.500 C 125.431 192.500, 128.534 192.177, 135 190.157 C 162.073 181.699, 181.699 162.073, 190.157 135 C 192.177 128.534, 192.500 125.431, 192.500 112.500 C 192.500 99.569, 192.177 96.466, 190.157 90 C 181.363 61.851, 159.599 41.037, 131.590 33.990 C 120.949 31.313, 103.502 31.337, 93 34.043 M 96.358 37.548 C 66.099 44.188, 42.393 68.975, 36.981 99.633 C 35.448 108.314, 36.159 124.081, 38.462 132.500 C 42.422 146.977, 52.682 162.613, 64.223 171.759 C 70.700 176.892, 79.682 182.256, 83.914 183.519 C 86.041 184.153, 85.880 183.778, 82.564 180.370 C 65.591 162.922, 67.892 133.716, 87.399 118.988 C 94.406 113.698, 101.642 111.239, 113.372 110.161 C 129.198 108.706, 139.897 101.740, 145.943 88.956 C 152.603 74.875, 150.279 59.778, 139.679 48.260 C 134.455 42.584, 129.809 39.615, 122.972 37.584 C 116.590 35.689, 104.905 35.673, 96.358 37.548 M 107.452 62.406 C 103.301 64.214, 101 68.078, 101 73.242 C 101 78.179, 102.863 81.361, 107.011 83.506 C 112.320 86.251, 119.046 84.628, 122.439 79.783 C 124.506 76.833, 124.428 69.583, 122.296 66.328 C 120.547 63.660, 115.453 60.969, 112.282 61.039 C 111.302 61.061, 109.129 61.676, 107.452 62.406 M 105.095 142.574 C 100.804 146.184, 99.348 151.503, 101.342 156.276 C 103.130 160.555, 108.141 163.991, 112.602 163.996 C 120.105 164.005, 126.304 155.480, 123.959 148.376 C 121.304 140.332, 111.385 137.281, 105.095 142.574 Z" 
    />
  </g>
</svg>`
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
