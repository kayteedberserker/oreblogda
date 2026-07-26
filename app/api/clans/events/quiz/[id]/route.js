import connectDB from '@/app/lib/mongodb';
import QuizEvent from '@/app/models/QuizEvent';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
    await connectDB();
    try {
        const awaitedParams = await params;
        const id = awaitedParams?.id;
        if (!id) return NextResponse.json({ message: "Missing Event ID" }, { status: 400 });

        // ⚡️ PERFORMANCE OPTIMIZATION: Only fetch the necessary payload chunks required for polling
        const event = await QuizEvent.findById(id)
            .select(`
                status 
                title 
                description 
                currentStreamIndex 
                quizQuestions 
                leaderboard 
                acknowledgedBy 
                acknowledgeCount 
                deliveryMode 
                endsAt 
                expiresAt 
                themeColor 
                visibility 
                clanId 
                clanName 
                leaderDeviceId 
                moderatedBy 
                blacklistedDeviceIds 
                participants
                streamGapMinutes
            `)
            .lean();

        if (!event) return NextResponse.json({ message: "Event not found" }, { status: 404 });

        // ------------------------------------------------------------------
        // 🚀 HOSTLESS LAZY AUTO-PROGRESSION & STATE TRANSITIONS
        // ------------------------------------------------------------------
        if (
            event.deliveryMode === "STREAMED" &&
            event.status === "LIVE" &&
            Array.isArray(event.quizQuestions) &&
            event.quizQuestions.length > 0
        ) {
            const now = new Date();
            const currentIndex = event.currentStreamIndex ?? 0;
            const currentQuestion = event.quizQuestions[currentIndex];

            // 1. Safe & robust duration calculation (avoids NaN)
            const gapMinutes =
                event.streamGapMinutes ??
                (currentQuestion?.timeLimitSeconds ? Math.ceil(currentQuestion.timeLimitSeconds / 60) : 5);
            const gapMs = gapMinutes * 60000;

            // 2. SELF-HEALING / KICKSTART: Seed Q0 & Q1 if Q0 has no releasedAt timestamp yet
            if (!currentQuestion?.releasedAt) {
                const initFields = {
                    [`quizQuestions.${currentIndex}.releasedAt`]: now
                };

                const nextIndex = currentIndex + 1;
                if (nextIndex < event.quizQuestions.length) {
                    initFields[`quizQuestions.${nextIndex}.releasedAt`] = new Date(now.getTime() + gapMs);
                }

                const initResult = await QuizEvent.updateOne(
                    { _id: id, currentStreamIndex: currentIndex, status: "LIVE" },
                    { $set: initFields }
                );

                if (initResult.modifiedCount > 0) {
                    if (!event.quizQuestions[currentIndex]) event.quizQuestions[currentIndex] = {};
                    event.quizQuestions[currentIndex].releasedAt = now;

                    if (nextIndex < event.quizQuestions.length) {
                        if (!event.quizQuestions[nextIndex]) event.quizQuestions[nextIndex] = {};
                        event.quizQuestions[nextIndex].releasedAt = initFields[`quizQuestions.${nextIndex}.releasedAt`];
                    }
                }
            }

            // 3. Expiration evaluation
            const currentReleaseTime = event.quizQuestions[currentIndex]?.releasedAt
                ? new Date(event.quizQuestions[currentIndex].releasedAt).getTime()
                : now.getTime();

            const isCurrentQuestionExpired = now.getTime() >= currentReleaseTime + gapMs;

            let targetIndex = currentIndex;
            if (isCurrentQuestionExpired && currentIndex + 1 < event.quizQuestions.length) {
                targetIndex = currentIndex + 1;
            }

            // 4. Auto-completion evaluation
            const isLastQuestion = currentIndex === event.quizQuestions.length - 1;
            const eventTimeExpired = event.endsAt && now >= new Date(event.endsAt);
            const shouldMarkCompleted = eventTimeExpired || (isLastQuestion && isCurrentQuestionExpired);

            // 5. Progression state persistence
            if (targetIndex !== currentIndex || shouldMarkCompleted) {
                const updateFields = {};

                if (targetIndex !== currentIndex) {
                    updateFields.currentStreamIndex = targetIndex;

                    // Seed active question's releasedAt if missing
                    if (!event.quizQuestions[targetIndex]?.releasedAt) {
                        updateFields[`quizQuestions.${targetIndex}.releasedAt`] = now;
                    }

                    // Dynamically set releasedAt for the next question in line
                    const nextIndex = targetIndex + 1;
                    if (nextIndex < event.quizQuestions.length) {
                        const nextReleaseTime = new Date(now.getTime() + gapMs);
                        updateFields[`quizQuestions.${nextIndex}.releasedAt`] = nextReleaseTime;
                    }
                }

                if (shouldMarkCompleted) {
                    updateFields.status = "COMPLETED";
                }

                // Optimistic Lock
                const updateResult = await QuizEvent.updateOne(
                    {
                        _id: id,
                        currentStreamIndex: currentIndex,
                        status: "LIVE"
                    },
                    { $set: updateFields }
                );

                // Reflect updates in local payload for instant return
                if (updateResult.modifiedCount > 0) {
                    if (updateFields.currentStreamIndex !== undefined) {
                        event.currentStreamIndex = targetIndex;
                    }
                    if (updateFields.status) {
                        event.status = updateFields.status;
                    }
                    if (!event.quizQuestions[targetIndex]?.releasedAt) {
                        event.quizQuestions[targetIndex].releasedAt = now;
                    }
                    const nextIndex = targetIndex + 1;
                    if (nextIndex < event.quizQuestions.length && updateFields[`quizQuestions.${nextIndex}.releasedAt`]) {
                        event.quizQuestions[nextIndex].releasedAt = updateFields[`quizQuestions.${nextIndex}.releasedAt`];
                    }
                }
            }
        }

        // Enforce ranking natively before returning
        if (event.leaderboard && Array.isArray(event.leaderboard)) {
            event.leaderboard.sort((a, b) => b.score - a.score);
        }

        return NextResponse.json({ success: true, event }, { status: 200 });
    } catch (error) {
        console.error("⛔ QUIZ_GET_CRASH:", error);
        return NextResponse.json({ message: "Internal server error." }, { status: 500 });
    }
}