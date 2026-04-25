'use client';

import { useEffect } from 'react';
import { checkAchievements } from '../lib/achievements';

const AchievementChecker = ({ user, onAchievementsUpdate, action = null }) => {
    useEffect(() => {
        if (user && onAchievementsUpdate) {
            const newAchievements = checkAchievements(user, action);
            if (newAchievements.length > 0) {
                onAchievementsUpdate(newAchievements);
            }
        }
    }, [user, onAchievementsUpdate, action]);

    return null;
};

export default AchievementChecker;