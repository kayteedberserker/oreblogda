import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const shopType = searchParams.get('type'); // 'author' or 'clan'
  const isClan = shopType === 'clan';
  const currency = isClan ? 'CC' : 'OC';

  const catalog = {
    themes: [
      {
        id: 'ninja_theme',
        label: isClan ? 'Ninja Way' : 'Way of the Scribe',
        icon: 'leaf',
        items: [
          // --- WATERMARK CATEGORY ---
          {
            id: isClan ? 'scribe_watermark' : 'author_scroll_watermark',
            name: isClan ? 'Scribe Seal' : 'Ancient Manuscript',
            price: isClan ? 850 : 920,
            currency: currency,
            category: 'WATERMARK',
            visualData: { 
              icon: isClan ? 'fountain-pen-tip' : 'scroll-outline', 
              color: isClan ? '#94a3b8' : '#e2e8f0',
              opacity: 0.08,
              size: 280,
              rotation: '-15deg',
              svgCode: isClan 
                ? `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C12 2 10 4 8 8C6 12 6 13 6 15C6 18.31 8.69 21 12 21C15.31 21 18 18.31 18 15C18 13 18 12 16 8C14 4 12 2 12 2ZM12 15C10.9 15 10 14.1 10 13C10 11.9 10.9 11 12 11C13.1 11 14 11.9 14 13C14 14.1 13.1 15 12 15Z" fill="currentColor"/></svg>`
                : `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6C4.89 2 4 2.9 4 4V20C4 21.1 4.89 22 6 22H18C19.11 22 20 21.1 20 20V8L14 2ZM12 18H8V16H12V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z" fill="currentColor"/></svg>`
            }
          },
          // --- BADGE CATEGORY (NEW) ---
          ...(!isClan ? [{
            id: 'hidden_ink_badge',
            name: 'Hidden Ink Mastery',
            price: 500,
            currency: 'OC',
            category: 'BADGE',
            visualData: {
              icon: 'feather',
              color: '#10b981',
              svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.24 12.24C21.36 11.12 22 9.63 22 8V2H16C14.37 2 12.88 2.64 11.76 3.76L2 13.52V22H10.48L20.24 12.24ZM18.5 10C17.67 10 17 9.33 17 8.5C17 7.67 17.67 7 18.5 7C19.33 7 20 7.67 20 8.5C20 9.33 19.33 10 18.5 10Z" fill="currentColor"/></svg>`
            }
          }] : []),
          // --- BACKGROUND CATEGORY ---
          {
            id: isClan ? 'jade_dragon_bg' : 'sage_ink_bg',
            name: isClan ? 'Jade Dragon Aura' : 'Sage Ink Mist',
            price: 1200,
            currency: currency,
            category: 'BACKGROUND',
            visualData: { 
              type: 'shimmer', 
              primaryColor: isClan ? '#10b981' : '#059669', 
              secondaryColor: isClan ? '#34d399' : '#6ee7b7', 
              opacity: 0.15,
              duration: isClan ? 4000 : 6000,
              svgCode: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="jadeGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#10b981;stop-opacity:1" /><stop offset="100%" style="stop-color:#34d399;stop-opacity:1" /></linearGradient></defs><rect width="100" height="60" rx="12" fill="url(#jadeGrad)" /></svg>`
            }
          },
          // --- BORDER CATEGORY ---
          {
            id: isClan ? 'akatsuki_border' : 'editor_choice_border',
            name: isClan ? 'S-Rank Border' : 'Editor Choice',
            price: 400,
            currency: currency,
            category: 'BORDER',
            visualData: { 
              type: 'borderChaser', 
              primaryColor: isClan ? '#ff0000' : '#ef4444',
              animationType: 'singleSnake',
              snakeLength: isClan ? 120 : 180,
              duration: 3000
            }
          },
          {
            id: isClan ? 'circuit_border' : 'author_glow_border',
            name: isClan ? 'Cyber Core' : 'Digital Ink',
            price: 950,
            currency: currency,
            category: 'BORDER',
            visualData: { 
              type: 'borderChaser', 
              primaryColor: isClan ? '#10b981' : '#2dd4bf', 
              animationType: 'pulseCircuit', 
              duration: 2000
            }
          },
          // --- GLOW CATEGORY ---
          {
            id: isClan ? 'electric_aura_glow' : 'creative_spark_glow',
            name: isClan ? 'Electric Aura' : 'Creative Spark',
            price: 750,
            currency: currency,
            category: 'GLOW',
            visualData: { 
              type: 'crestGlow', 
              primaryColor: isClan ? '#22d3ee' : '#818cf8',
              svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="currentColor" fill-opacity="0.3"/></svg>`
            }
          }
        ]
      },
      {
        id: 'pirate_theme',
        label: isClan ? 'Grand Voyage' : 'Epic Saga',
        icon: 'anchor',
        items: [
          // --- BACKGROUND CATEGORY ---
          {
            id: isClan ? 'crimson_tide_bg' : 'blood_ink_bg',
            name: isClan ? 'Crimson Tide Aura' : 'Blood Ink Wash',
            price: 1500,
            currency: currency,
            category: 'BACKGROUND',
            visualData: { 
              type: 'pulse', 
              primaryColor: '#991b1b', 
              secondaryColor: '#ef4444', 
              opacity: 0.12,
              duration: 5000,
              svgCode: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="crimsonGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#991b1b;stop-opacity:1" /><stop offset="100%" style="stop-color:#ef4444;stop-opacity:1" /></linearGradient></defs><rect width="100" height="60" rx="12" fill="url(#crimsonGrad)" /></svg>`
            }
          },
          // --- BADGE CATEGORY (NEW) ---
          ...(!isClan ? [{
            id: 'world_govt_badge',
            name: 'Global Archives',
            price: 2500,
            currency: 'OC',
            category: 'BADGE',
            visualData: {
              icon: 'earth',
              color: '#38bdf8',
              svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM11 19.93C7.05 19.44 4 16.08 4 12C4 11.38 4.08 10.78 4.21 10.21L9 15V16C9 17.1 9.9 18 11 18V19.93ZM17.9 17.39C17.64 16.58 16.9 16 16 16H15V13C15 12.45 14.55 12 14 12H8V10H10C10.55 10 11 9.55 11 9V7H13C14.1 7 15 6.1 15 5V4.59C17.93 5.78 20 8.65 20 12C20 14.08 19.2 15.97 17.9 17.39Z" fill="currentColor"/></svg>`
            }
          }] : []),
          // --- WATERMARK / SIGIL ---
          {
            id: isClan ? 'jolly_roger_sigil' : 'quill_cross_sigil',
            name: isClan ? 'Pirate King Mark' : 'Storyteller Mark',
            price: 1000,
            currency: currency,
            category: isClan ? 'THEME' : 'WATERMARK',
            visualData: { 
              sigilKey: isClan ? 'skull_bones' : 'quill', 
              color: '#ffffff',
              opacity: 0.1,
              svgCode: isClan 
                ? `<svg viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M12,2C8.69,2 6,4.69 6,8C6,11.31 8.69,14 12,14C15.31,14 18,11.31 18,8C18,4.69 15.31,2 12,2M12,12C9.79,12 8,10.21 8,8C8,5.79 9.79,4 12,4C14.21,4 16,5.79 16,8C16,10.21 14.21,12 12,12Z"/></svg>`
                : `<svg viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M21.7,5.3L18.7,2.3C18.1,1.7 17.1,1.7 16.5,2.3L3,15.8V21H8.2L21.7,7.5C22.3,6.9 22.3,5.9 21.7,5.3Z"/></svg>`
            }
          },
          // --- GLOW ---
          {
            id: isClan ? 'gold_king_glow' : 'legends_radiance',
            name: isClan ? 'Kings Disposition' : 'Legend’s Radiance',
            price: 1500,
            currency: currency,
            category: 'GLOW',
            visualData: { 
              primaryColor: '#facc15',
              svgCode: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#facc15" stroke-width="2" opacity="0.5"/></svg>`
            }
          },
          // --- BORDER ---
          {
            id: isClan ? 'ocean_chaser' : 'horizon_weaver',
            name: isClan ? 'Eternal Blue' : 'Final Horizon',
            price: 300,
            currency: currency,
            category: 'BORDER',
            visualData: { 
              type: 'borderChaser', 
              primaryColor: isClan ? '#0ea5e9' : '#38bdf8',
              animationType: 'singleSnake',
              duration: 5000
            }
          }
        ]
      }
    ]
  };

  return NextResponse.json({ success: true, catalog });
}