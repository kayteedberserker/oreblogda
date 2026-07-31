import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (payload, status = 200) =>
    NextResponse.json(payload, {
        status,
        headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
            Pragma: "no-cache",
            Expires: "0"
        }
    });

const safeTokenEquals = (firstToken, secondToken) => {
    if (
        typeof firstToken !== "string" ||
        typeof secondToken !== "string"
    ) {
        return false;
    }

    const firstBuffer = Buffer.from(firstToken);
    const secondBuffer = Buffer.from(secondToken);

    if (firstBuffer.length !== secondBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(firstBuffer, secondBuffer);
};

const normalizeSecurityLevel = (value) => {
    const numericLevel = Number(value);

    if (Number.isFinite(numericLevel)) {
        return numericLevel;
    }

    if (typeof value === "string" && value.trim()) {
        return value.trim();
    }

    return 1;
};

export async function POST(req) {
    const requestStartedAt = Date.now();
    let stage = "START";

    try {
        stage = "CHECK_ENVIRONMENT";

        const accessTokenSecret = process.env.JWT_SECRET;
        const refreshTokenSecret =
            process.env.REFRESH_TOKEN_SECRET;

        if (!accessTokenSecret || !refreshTokenSecret) {
            console.error("[TOKEN_REFRESH] Missing server secret", {
                hasJwtSecret: Boolean(accessTokenSecret),
                hasRefreshSecret: Boolean(refreshTokenSecret)
            });

            return json(
                {
                    success: false,
                    message:
                        "TOKEN_SERVICE_UNAVAILABLE: Authentication configuration is incomplete.",
                    code: "TOKEN_SECRET_MISSING",
                    retryable: false
                },
                500
            );
        }

        stage = "PARSE_REQUEST_BODY";

        let body;

        try {
            body = await req.json();
        } catch (error) {
            return json(
                {
                    success: false,
                    message:
                        "INVALID_REFRESH_REQUEST: Request body must be valid JSON.",
                    code: "INVALID_JSON_BODY",
                    retryable: false
                },
                400
            );
        }

        const refreshToken =
            typeof body?.refreshToken === "string"
                ? body.refreshToken.trim()
                : "";

        const deviceId =
            typeof body?.deviceId === "string"
                ? body.deviceId.trim()
                : "";

        if (!refreshToken) {
            return json(
                {
                    success: false,
                    message:
                        "NEURAL_LINK_EMPTY: Missing refresh token.",
                    code: "REFRESH_TOKEN_MISSING",
                    retryable: false
                },
                440
            );
        }

        if (!deviceId) {
            return json(
                {
                    success: false,
                    message:
                        "DEVICE_ID_MISSING: Device identity is required.",
                    code: "DEVICE_ID_MISSING",
                    retryable: false
                },
                400
            );
        }

        stage = "VERIFY_REFRESH_TOKEN";

        let decoded;

        try {
            decoded = jwt.verify(
                refreshToken,
                refreshTokenSecret,
                {
                    algorithms: ["HS256"]
                }
            );
        } catch (error) {
            const tokenExpired =
                error?.name === "TokenExpiredError";

            console.warn("[TOKEN_REFRESH] Token rejected", {
                reason: error?.name || "UnknownJWTError",
                expired: tokenExpired
            });

            return json(
                {
                    success: false,
                    message: tokenExpired
                        ? "ENCRYPTION_EXPIRED: Session timed out."
                        : "REFRESH_TOKEN_INVALID: Session token is invalid.",
                    code: tokenExpired
                        ? "REFRESH_TOKEN_EXPIRED"
                        : "REFRESH_TOKEN_INVALID",
                    retryable: false
                },
                tokenExpired ? 440 : 401
            );
        }

        const uid =
            typeof decoded?.uid === "string"
                ? decoded.uid.trim()
                : String(decoded?.uid || "").trim();

        if (!uid) {
            return json(
                {
                    success: false,
                    message:
                        "REFRESH_TOKEN_INVALID: User identity is missing.",
                    code: "REFRESH_UID_MISSING",
                    retryable: false
                },
                401
            );
        }

        stage = "CONNECT_DATABASE";
        await connectDB();

        stage = "FIND_REFRESH_SESSION";

        // +refreshToken keeps this working even if the schema marks the field
        // select:false.
        const user = await MobileUser.findOne({
            uid,
            deviceId
        }).select(
            "refreshToken uid deviceId securityLevel"
        );

        if (!user) {
            console.warn(
                "[TOKEN_REFRESH] User/device pair not found",
                {
                    uid,
                    hasDeviceId: Boolean(deviceId)
                }
            );

            return json(
                {
                    success: false,
                    message:
                        "SESSION_COMPROMISED: User or device no longer matches.",
                    code: "REFRESH_USER_DEVICE_MISMATCH",
                    retryable: false
                },
                403
            );
        }
        if (
            !safeTokenEquals(
                user.refreshToken,
                refreshToken
            )
        ) {
            console.warn(
                "[TOKEN_REFRESH] Stored refresh token mismatch",
                {
                    userId: String(user._id),
                    uid
                }
            );

            return json(
                {
                    success: false,
                    message:
                        "SESSION_COMPROMISED: Refresh token has already been replaced or revoked.",
                    code: "REFRESH_TOKEN_MISMATCH",
                    retryable: false
                },
                440
            );
        }

        stage = "SIGN_NEW_TOKEN_PAIR";

        const accessTokenPayload = {
            userId: String(user.deviceId),
            uid: String(user.uid),
            level: normalizeSecurityLevel(
                user.securityLevel
            )
        };

        const newAccessToken = jwt.sign(
            accessTokenPayload,
            accessTokenSecret,
            {
                algorithm: "HS256",
                expiresIn: "15m"
            }
        );

        const newRefreshToken = jwt.sign(
            {
                uid: String(user.uid),
                deviceId: String(user.deviceId),
                tokenVersion: 2
            },
            refreshTokenSecret,
            {
                algorithm: "HS256",
                expiresIn: "90d",
                jwtid: crypto.randomUUID()
            }
        );

        stage = "ROTATE_REFRESH_TOKEN";

        // The old token is part of the update filter. This makes rotation
        // atomic: only one request can successfully replace a given token.
        const rotationResult =
            await MobileUser.updateOne(
                {
                    _id: user._id,
                    uid: user.uid,
                    deviceId: user.deviceId,
                    refreshToken
                },
                {
                    $set: {
                        refreshToken: newRefreshToken,
                        refreshTokenUpdatedAt:
                            new Date()
                    }
                }
            );

        if (rotationResult.modifiedCount !== 1) {
            console.warn(
                "[TOKEN_REFRESH] Atomic rotation lost",
                {
                    userId: String(user._id),
                    matchedCount:
                        rotationResult.matchedCount,
                    modifiedCount:
                        rotationResult.modifiedCount
                }
            );

            return json(
                {
                    success: false,
                    message:
                        "REFRESH_ALREADY_USED: This refresh token was already rotated.",
                    code: "REFRESH_ROTATION_CONFLICT",
                    retryable: false
                },
                409
            );
        }

        stage = "SUCCESS";

        console.log("[TOKEN_REFRESH] Successful", {
            userId: String(user._id),
            durationMs:
                Date.now() - requestStartedAt
        });

        return json(
            {
                success: true,
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                expiresInSeconds: 15 * 60
            },
            200
        );
    } catch (error) {
        console.error("[TOKEN_REFRESH] Unhandled failure", {
            stage,
            name: error?.name,
            message: error?.message,
            stack:
                process.env.NODE_ENV === "development"
                    ? error?.stack
                    : undefined,
            durationMs:
                Date.now() - requestStartedAt
        });

        return json(
            {
                success: false,
                message:
                    "UPLINK_INTERRUPTED: Token refresh service failed.",
                code: "REFRESH_INTERNAL_ERROR",
                stage:
                    process.env.NODE_ENV === "development"
                        ? stage
                        : undefined,
                detail:
                    process.env.NODE_ENV === "development"
                        ? error?.message
                        : undefined,
                retryable: true
            },
            500
        );
    }
}