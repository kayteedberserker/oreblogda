// achievements.js
export const ACHIEVEMENT_CATEGORIES = {
    POWER: "Power & Ranks",
    ACTIVITY: "Grind & Content",
    SOCIAL: "Hype & Respect",
    CLAN: "Squad & Warfare",
    WEALTH: "OC & Patrons",
};

// Define what each achievement type means in terms of user data
// These should correspond to fields that exist in the user model or can be calculated
const ACHIEVEMENT_TYPE_DEFINITIONS = {
    // POWER types
    rank_up: "Number of times user has ranked up (tracked in user.rank_ups)",
    rank: "Current user rank (user.rank)",
    aura: "Total aura points accumulated (user.aura)",
    leaderboard_top: "Current leaderboard position (user.leaderboard_position)",
    weekly_win: "Number of weekly leaderboard wins (user.weekly_wins)",
    peak_score: "Highest score achieved (user.peak_score)",

    // ACTIVITY types
    posts_total: "Total number of posts made (user.posts_total)",
    streak: "Current posting streak in days (user.streak)",
    cat_memes: "Posts in memes category (user.cat_memes)",
    cat_news: "Posts in news category (user.cat_news)",
    cat_reviews: "Posts in reviews category (user.cat_reviews)",
    cat_fanart: "Posts in fanart category (user.cat_fanart)",
    cat_polls: "Posts in polls category (user.cat_polls)",
    unique_cats: "Number of different categories posted in (user.unique_cats)",
    total_views: "Total views across all posts (user.total_views)",
    max_views_on_post: "Highest views on a single post (user.max_views_on_post)",
    post_at_night: "Has posted between 2-4 AM (user.post_at_night)",
    account_age: "Account age in days (user.account_age_days)",

    // SOCIAL types
    respect_given: "Number of respect votes given (user.respect_given)",
    comments: "Total comments made (user.comments)",
    hype_given: "Number of hype actions given (user.hype_given)",
    hype_received: "Hype received on a single post (user.hype_received)",
    hype_received_total: "Total hype received across all posts (user.hype_received_total)",
    respect_given_total: "Total respect votes given (user.respect_given_total)",
    respect_received: "Total respect votes received (user.respect_received)",
    comment_replies: "Total replies received on comments (user.comment_replies)",
    followers: "Number of followers (user.followers)",
    featured_posts: "Number of posts that got featured (user.featured_posts)",
    hype_chain: "Hyped 10 posts in under 1 minute (user.hype_chain)",

    // CLAN types
    join_clan: "Has joined a clan (user.join_clan)",
    clan_posts: "Posts made in clan (user.clan_posts)",
    clan_points_contrib: "Points contributed to clan (user.clan_points_contrib)",
    create_clan: "Has created a clan (user.create_clan)",
    rank_s_no_clan: "Reached S-Rank without being in a clan",
    clan_followers: "Number of clan followers (user.clan_followers)",
    days_in_clan: "Days spent in current clan (user.days_in_clan)",

    // WEALTH types
    buy_oc: "Has purchased OC at least once (user.buy_oc)",
    oc_bought_total: "Total OC purchased (user.oc_bought_total)",
    oc_spent_total: "Total OC spent (user.oc_spent_total)",
    hype_purchased: "Times hyped using purchased OC (user.hype_purchased)",
    oc_balance: "Current OC balance (user.oc_balance)",
    peak_badge_unlock: "Has unlocked the Peak Badge (user.peak_badge_unlock)",

    // SPECIAL types
    view_no_interact: "Views without interacting (user.view_no_interact)",
    regain_streak: "Regained a 30-day streak after losing it (user.regain_streak)"
};

const ACTION_TYPES = {
    like: ['hype_given', 'hype_received_total', 'respect_given_total', 'hype_chain'],
    view: ['view_no_interact'], // simplified since we removed view achievements
    comment: ['comments', 'comment_replies'],
    post: ['post_at_night'], // simplified
    clan_join: ['join_clan'],
    clan_create: ['create_clan'],
    follow: ['followers'],
    respect: ['respect_given', 'respect_given_total'],
    purchase: ['buy_oc', 'oc_bought_total', 'oc_spent_total', 'oc_balance'],
    // add more as needed
};

export const ACHIEVEMENTS = [
    // --- POWER CATEGORY (Ranks & Aura) ---
    { id: 'p_1', cat: 'POWER', name: 'Limit Break', goal: 1, type: 'rank_up', label: 'Rank up for the first time' },
    { id: 'p_2', cat: 'POWER', name: 'Elite Operative', goal: 1, type: 'rank', value: 'B', label: 'Reach B-Rank' },
    { id: 'p_3', cat: 'POWER', name: 'S-Rank Legend', goal: 1, type: 'rank', value: 'S', label: 'Become a Legend' },
    { id: 'p_4', cat: 'POWER', name: 'Monarch Ascension', goal: 1, type: 'rank', value: 'Monarch', label: 'Hit the Absolute Ceiling' },
    { id: 'p_5', cat: 'POWER', name: 'Aura Initialized', goal: 500, type: 'aura', label: 'Accumulate 500 Aura' },
    { id: 'p_6', cat: 'POWER', name: 'Aura Surge', goal: 5000, type: 'aura', label: 'Accumulate 5k Aura' },
    { id: 'p_7', cat: 'POWER', name: 'Aura God', goal: 50000, type: 'aura', label: 'Accumulate 50k Aura' },
    { id: 'p_8', cat: 'POWER', name: 'Top 10 Resident', goal: 1, type: 'leaderboard_top', value: 10, label: 'Enter the Top 10' },

    // --- ACTIVITY CATEGORY (Based on Aura/Activity) ---
    { id: 'a_1', cat: 'ACTIVITY', name: 'System Boot', goal: 50, type: 'aura', label: 'Earn your first 50 Aura' },
    { id: 'a_2', cat: 'ACTIVITY', name: 'Daily Grind', goal: 1000, type: 'aura', label: 'Accumulate 1k Aura' },
    { id: 'a_3', cat: 'ACTIVITY', name: 'Hardcore Leveling', goal: 10000, type: 'aura', label: 'Reach 10k Aura' },
    { id: 'a_4', cat: 'ACTIVITY', name: 'Year of the Player', goal: 365, type: 'account_age', label: 'Account older than 1 year' },

    // --- SOCIAL CATEGORY (Hype & Respect - need to be tracked) ---
    { id: 's_1', cat: 'SOCIAL', name: 'First Respect', goal: 1, type: 'respect_given', label: 'Give respect to a player' },
    { id: 's_2', cat: 'SOCIAL', name: 'Community Pillar', goal: 100, type: 'comments', label: 'Drop 100 comments' },
    { id: 's_3', cat: 'SOCIAL', name: 'Kingmaker', goal: 50, type: 'hype_given', label: 'Hype 50 different players' },
    { id: 's_4', cat: 'SOCIAL', name: 'Aura Magnet', goal: 100, type: 'hype_received', label: 'Get 100 Hypes on one post' },
    { id: 's_5', cat: 'SOCIAL', name: 'Viral Legend', goal: 1000, type: 'hype_received_total', label: 'Accumulate 1k total Hypes' },
    { id: 's_6', cat: 'SOCIAL', name: 'Voucher', goal: 200, type: 'respect_given_total', label: 'Vouch for 200 players' },
    { id: 's_7', cat: 'SOCIAL', name: 'Idol Status', goal: 500, type: 'respect_received', label: 'Receive 500 Respected votes' },
    { id: 's_8', cat: 'SOCIAL', name: 'Discussion God', goal: 100, type: 'comment_replies', label: 'Get 100 replies on your post' },
    { id: 's_9', cat: 'SOCIAL', name: 'Follower Magnet', goal: 100, type: 'followers', label: 'Gain 100 followers' },
    { id: 's_10', cat: 'SOCIAL', name: 'Golden Pen', goal: 50, type: 'featured_posts', label: 'Get 50 posts featured' },

    // --- CLAN CATEGORY ---
    { id: 'c_1', cat: 'CLAN', name: 'Soldier', goal: 1, type: 'join_clan', label: 'Join a Clan' },
    { id: 'c_2', cat: 'CLAN', name: 'Commander Spirit', goal: 1, type: 'create_clan', label: 'Lead your own Clan' },
    { id: 'c_3', cat: 'CLAN', name: 'Ronin Pride', goal: 1, type: 'rank_s_no_clan', label: 'Hit S-Rank without a Clan' },

    // --- WEALTH & PURCHASES ---
    { id: 'w_1', cat: 'WEALTH', name: 'Investor', goal: 1, type: 'buy_oc', label: 'First OC purchase' },
    { id: 'w_2', cat: 'WEALTH', name: 'High Roller', goal: 5000, type: 'oc_bought_total', label: 'Buy 5k OC total' },
    { id: 'w_3', cat: 'WEALTH', name: 'Celestial Donor', goal: 50000, type: 'oc_bought_total', label: 'Buy 50k OC total' },
    { id: 'w_4', cat: 'WEALTH', name: 'World Noble', goal: 100000, type: 'oc_spent_total', label: 'Spend 100k OC total' },
    { id: 'w_5', cat: 'WEALTH', name: 'Treasure Hoarder', goal: 10000, type: 'oc_balance', label: 'Hold 10k OC balance' },
    { id: 'w_6', cat: 'WEALTH', name: 'Apex Whale', goal: 1, type: 'peak_badge_unlock', label: 'Unlock the PeakBadge' },

    // --- SPECIAL / EASTER EGGS ---
    { id: 'e_1', cat: 'ACTIVITY', name: 'Night Owl', goal: 1, type: 'post_at_night', label: 'Post between 2 AM - 4 AM' },
    { id: 'e_2', cat: 'SOCIAL', name: 'The Ghost', goal: 500, type: 'view_no_interact', label: 'View 500 posts without liking' },
    { id: 'e_3', cat: 'POWER', name: 'Phoenix Rise', goal: 1, type: 'regain_streak', label: 'Regain a 30-day streak after losing it' },
    { id: 'e_4', cat: 'SOCIAL', name: 'Hype Train', goal: 10, type: 'hype_chain', label: 'Hype 10 posts in under 1 minute' },

    // --- SOCIAL CATEGORY (Likes, Comments, Hype) ---
    { id: 's_1', cat: 'SOCIAL', name: 'First Respect', goal: 1, type: 'respect_given', label: 'Give respect to a player' },
    { id: 's_2', cat: 'SOCIAL', name: 'Community Pillar', goal: 100, type: 'comments', label: 'Drop 100 comments' },
    { id: 's_3', cat: 'SOCIAL', name: 'Kingmaker', goal: 50, type: 'hype_given', label: 'Hype 50 different players' },
    { id: 's_4', cat: 'SOCIAL', name: 'Aura Magnet', goal: 100, type: 'hype_received', label: 'Get 100 Hypes on one post' },
    { id: 's_5', cat: 'SOCIAL', name: 'Viral Legend', goal: 1000, type: 'hype_received_total', label: 'Accumulate 1k total Hypes' },
    { id: 's_6', cat: 'SOCIAL', name: 'Voucher', goal: 200, type: 'respect_given_total', label: 'Vouch for 200 players' },
    { id: 's_7', cat: 'SOCIAL', name: 'Idol Status', goal: 500, type: 'respect_received', label: 'Receive 500 Respected votes' },
    { id: 's_8', cat: 'SOCIAL', name: 'Discussion God', goal: 100, type: 'comment_replies', label: 'Get 100 replies on your post' },
    { id: 's_9', cat: 'SOCIAL', name: 'Follower Magnet', goal: 100, type: 'followers', label: 'Gain 100 followers' },
    { id: 's_10', cat: 'SOCIAL', name: 'Golden Pen', goal: 50, type: 'featured_posts', label: 'Get 50 posts featured' },

    // --- CLAN CATEGORY ---
    { id: 'c_1', cat: 'CLAN', name: 'Soldier', goal: 1, type: 'join_clan', label: 'Join a Clan' },
    { id: 'c_2', cat: 'CLAN', name: 'Vanguard', goal: 20, type: 'clan_posts', label: 'Make 20 Clan posts' },
    { id: 'c_3', cat: 'CLAN', name: 'Clan Pillar', goal: 5000, type: 'clan_points_contrib', label: 'Contribute 5k points' },
    { id: 'c_4', cat: 'CLAN', name: 'Commander Spirit', goal: 1, type: 'create_clan', label: 'Lead your own Clan' },
    { id: 'c_5', cat: 'CLAN', name: 'Ronin Pride', goal: 1, type: 'rank_s_no_clan', label: 'Hit S-Rank without a Clan' },
    { id: 'c_6', cat: 'CLAN', name: 'World Famous', goal: 1000, type: 'clan_followers', label: 'Clan reaches 1k followers' },
    { id: 'c_7', cat: 'CLAN', name: 'Loyalist', goal: 90, type: 'days_in_clan', label: 'Stay in one clan for 90 days' },

    // --- WEALTH & PURCHASES (Patron/Whale Tier) ---
    { id: 'w_1', cat: 'WEALTH', name: 'Investor', goal: 1, type: 'buy_oc', label: 'First OC purchase' },
    { id: 'w_2', cat: 'WEALTH', name: 'High Roller', goal: 5000, type: 'oc_bought_total', label: 'Buy 5k OC total' },
    { id: 'w_3', cat: 'WEALTH', name: 'Celestial Donor', goal: 50000, type: 'oc_bought_total', label: 'Buy 50k OC total' },
    { id: 'w_4', cat: 'WEALTH', name: 'World Noble', goal: 100000, type: 'oc_spent_total', label: 'Spend 100k OC total' },
    { id: 'w_5', cat: 'WEALTH', name: 'Golden Sponsor', goal: 10, type: 'hype_purchased', label: 'Hype others using purchased OC 10 times' },
    { id: 'w_6', cat: 'WEALTH', name: 'Treasure Hoarder', goal: 10000, type: 'oc_balance', label: 'Hold 10k OC balance' },
    { id: 'w_7', cat: 'WEALTH', name: 'Apex Whale', goal: 1, type: 'peak_badge_unlock', label: 'Unlock the PeakBadge' },

    // --- SPECIAL / EASTER EGGS ---
    { id: 'e_1', cat: 'ACTIVITY', name: 'Night Owl', goal: 1, type: 'post_at_night', label: 'Post between 2 AM - 4 AM' },
    { id: 'e_2', cat: 'SOCIAL', name: 'The Ghost', goal: 500, type: 'view_no_interact', label: 'View 500 posts without liking' },
    { id: 'e_3', cat: 'POWER', name: 'Phoenix Rise', goal: 1, type: 'regain_streak', label: 'Regain a 30-day streak after losing it' },
    { id: 'e_4', cat: 'ACTIVITY', name: 'OG Player', goal: 1, type: 'account_age', value: 365, label: 'Account older than 1 year' },
    { id: 'e_5', cat: 'SOCIAL', name: 'Hype Train', goal: 10, type: 'hype_chain', label: 'Hype 10 posts in under 1 minute' },

];

export const checkAchievements = (user, action = null) => {
    if (!user) return [];

    const newAchievements = [];
    const userAchievements = user.achievements || [];

    let achievementsToCheck = ACHIEVEMENTS;
    if (action && ACTION_TYPES[action]) {
        achievementsToCheck = ACHIEVEMENTS.filter(ach => ACTION_TYPES[action].includes(ach.type));
    }

    achievementsToCheck.forEach(ach => {
        if (userAchievements.includes(ach.id)) return;

        if (isAchievementSatisfied(ach, user)) {
            newAchievements.push(ach.id);
        }
    });

    return newAchievements;
};

export const isAchievementSatisfied = (achievement, user) => {
    let condition = false;
    switch (achievement.type) {
        case 'rank_up':
            condition = (user.rank_ups || 0) >= achievement.goal;
            break;
        case 'rank':
            condition = user.rank === achievement.value;
            break;
        case 'aura':
            condition = (user.aura || 0) >= achievement.goal;
            break;
        case 'leaderboard_top':
            condition = (user.leaderboard_position || Infinity) <= achievement.value;
            break;
        case 'account_age':
            condition = (user.account_age_days || 0) >= achievement.value;
            break;
        case 'respect_given':
            condition = (user.respect_given || 0) >= achievement.goal;
            break;
        case 'comments':
            condition = (user.comments || 0) >= achievement.goal;
            break;
        case 'hype_given':
            condition = (user.hype_given || 0) >= achievement.goal;
            break;
        case 'hype_received':
            condition = (user.hype_received || 0) >= achievement.goal;
            break;
        case 'hype_received_total':
            condition = (user.hype_received_total || 0) >= achievement.goal;
            break;
        case 'respect_given_total':
            condition = (user.respect_given_total || 0) >= achievement.goal;
            break;
        case 'respect_received':
            condition = (user.respect_received || 0) >= achievement.goal;
            break;
        case 'comment_replies':
            condition = (user.comment_replies || 0) >= achievement.goal;
            break;
        case 'followers':
            condition = (user.followers || 0) >= achievement.goal;
            break;
        case 'featured_posts':
            condition = (user.featured_posts || 0) >= achievement.goal;
            break;
        case 'join_clan':
            condition = user.join_clan === true;
            break;
        case 'create_clan':
            condition = user.create_clan === true;
            break;
        case 'rank_s_no_clan':
            condition = user.rank === 'S' && !user.clan;
            break;
        case 'buy_oc':
            condition = user.buy_oc === true;
            break;
        case 'oc_bought_total':
            condition = (user.oc_bought_total || 0) >= achievement.goal;
            break;
        case 'oc_spent_total':
            condition = (user.oc_spent_total || 0) >= achievement.goal;
            break;
        case 'oc_balance':
            condition = (user.oc_balance || 0) >= achievement.goal;
            break;
        case 'peak_badge_unlock':
            condition = user.peak_badge_unlock === true;
            break;
        case 'post_at_night':
            condition = user.post_at_night === true;
            break;
        case 'view_no_interact':
            condition = (user.view_no_interact || 0) >= achievement.goal;
            break;
        case 'regain_streak':
            condition = user.regain_streak === true;
            break;
        case 'hype_chain':
            condition = (user.hype_chain || 0) >= achievement.goal;
            break;
        default:
            condition = false;
    }
    return condition;
};