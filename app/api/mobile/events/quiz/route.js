import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import QuizProgress from "@/app/models/QuizProgress";
import { NextResponse } from "next/server";

// ⚡️ TODAY'S QUIZ (One question per day with multiple hints)
const TODAY_QUIZ = {
    question: "What is the meaning of Oreblogda?",
    answer: "My Blog",
    hints: [
        "ORE BLOG DA",
        "ORE is a japanese word",
    ],
    difficulty: "Easy"
};

// ⚡️ Helper: Get today's date string (YYYY-MM-DD)
const getTodayDate = () => new Date().toISOString().split('T')[0];

const QUIZ_EVENT_ID = 'one_time_quiz_400_synced';
const TITLE_REWARD = { name: '400: SYNCED', tier: 'epic' };

// ⚡️ Helper: Get user's quiz progress for the one-time event
const getUserQuizProgress = async (uid, eventId = QUIZ_EVENT_ID) => {
    return await QuizProgress.findOne({ uid, eventId });
};

// ⚡️ Helper: Award OC to user
const awardOC = async (uid, amount) => {
    if (amount === 0) return true;
    try {
        await MobileUser.findOneAndUpdate(
            { uid },
            { $inc: { coins: amount }, updatedAt: new Date() },
            { new: true }
        );
        return true;
    } catch (err) {
        console.error('Error awarding OC:', err);
        return false;
    }
};

// ⚡️ GET: Fetch today's quiz and user's current progress
export async function GET(request) {
    try {
        await connectDB();

        const uid = request.headers.get('X-User-ID');

        if (!uid) {
            return NextResponse.json({ success: false, error: 'User not authenticated' }, { status: 401 });
        }

        const eventId = request.nextUrl.searchParams.get('eventId') || QUIZ_EVENT_ID;
        const userProgress = await getUserQuizProgress(uid, eventId);

        // Check if user already completed
        const completed = userProgress?.completed === true;

        return NextResponse.json({
            success: true,
            quiz: {
                question: TODAY_QUIZ.question,
                category: TODAY_QUIZ.category,
                difficulty: TODAY_QUIZ.difficulty
                // Don't send the answer or full hints yet
            },
            hintsUsed: userProgress?.hintsUsed || 0,
            hints: userProgress?.hintsUsed ? TODAY_QUIZ.hints.slice(0, userProgress.hintsUsed) : [],
            attemptsLeft: userProgress?.attemptsLeft || 3,
            completed,
            unlockedTitle: completed ? TITLE_REWARD : null
        }, { status: 200 });
    } catch (err) {
        console.error('GET /mobile/events/quiz error:', err);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

// ⚡️ POST: Handle quiz actions (use_hint, submit_answer)
export async function POST(request) {
    try {
        await connectDB();

        const body = await request.json();
        const { uid, eventId, action, answer } = body;

        if (!uid || !action) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const eventIdToUse = eventId || QUIZ_EVENT_ID;

        // Get or create user's quiz progress for this event
        let userProgress = await getUserQuizProgress(uid, eventIdToUse);
        if (!userProgress) {
            userProgress = new QuizProgress({
                uid,
                eventId: eventIdToUse,
                date: getTodayDate(),
                hintsUsed: 0,
                attemptsLeft: 3,
                completed: false
            });
        }

        // Check if already completed
        if (userProgress.completed) {
            return NextResponse.json({
                success: false,
                error: 'Quiz already completed',
                completed: true,
                unlockedTitle: TITLE_REWARD
            }, { status: 409 });
        }

        // ===============================
        // ACTION: USE HINT
        // ===============================
        if (action === 'use_hint') {
            if (userProgress.hintsUsed >= 2) {
                return NextResponse.json({
                    success: false,
                    error: 'Maximum hints (2) already used'
                }, { status: 400 });
            }

            // Deduct 100 OC per hint
            const hintCost = 100;
            await awardOC(uid, -hintCost);

            const hintIndex = userProgress.hintsUsed;
            userProgress.hintsUsed += 1;
            userProgress.lastHintAt = new Date();
            userProgress.updatedAt = new Date();

            await userProgress.save();

            return NextResponse.json({
                success: true,
                hint: TODAY_QUIZ.hints[hintIndex] || 'No more hints available',
                hintsUsed: userProgress.hintsUsed,
                message: `Hint used! (-${hintCost} OC)`
            }, { status: 200 });
        }

        // ===============================
        // ACTION: SUBMIT ANSWER
        // ===============================
        if (action === 'submit_answer') {
            if (!answer || answer.trim().length === 0) {
                return NextResponse.json({
                    success: false,
                    error: 'Answer cannot be empty'
                }, { status: 400 });
            }

            // Check if answer is correct (case-insensitive)
            const isCorrect = answer.trim().toLowerCase() === TODAY_QUIZ.answer.toLowerCase();

            // Calculate reward
            const hintCost = 100;
            const correctReward = 500;
            const failReward = 200;
            const actualReward = isCorrect
                ? Math.max(correctReward - (userProgress.hintsUsed * hintCost), 0)
                : failReward;

            userProgress.attemptsLeft -= 1;
            userProgress.lastAnswerAt = new Date();
            userProgress.updatedAt = new Date();

            let resultMessage = '';
            let shouldCompleteQuiz = false;

            if (isCorrect) {
                shouldCompleteQuiz = true;
                resultMessage = `Correct! You earned ${actualReward} OC!`;
            } else {
                if (userProgress.attemptsLeft === 0) {
                    shouldCompleteQuiz = true;
                    resultMessage = `No attempts left. You earned ${failReward} OC as consolation.`;
                } else {
                    resultMessage = `Incorrect! You have ${userProgress.attemptsLeft} attempt${userProgress.attemptsLeft === 1 ? '' : 's'} left.`;
                }
            }

            // Award OC
            await awardOC(uid, actualReward);

            if (shouldCompleteQuiz) {
                userProgress.completed = true;
                userProgress.isCorrect = isCorrect;
                userProgress.finalReward = actualReward;
                await MobileUser.findOneAndUpdate(
                    { uid },
                    { $addToSet: { unlockedTitles: TITLE_REWARD }, updatedAt: new Date() },
                    { new: true }
                );
            }

            await userProgress.save();

            return NextResponse.json({
                success: true,
                isCorrect,
                message: resultMessage,
                attemptsLeft: userProgress.attemptsLeft,
                rewardEarned: actualReward,
                completed: shouldCompleteQuiz,
                unlockedTitle: shouldCompleteQuiz ? TITLE_REWARD : null
            }, { status: 200 });
        }

        return NextResponse.json({
            success: false,
            error: 'Invalid action'
        }, { status: 400 });

    } catch (err) {
        console.error('POST /mobile/events/quiz error:', err);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
