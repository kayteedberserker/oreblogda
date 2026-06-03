import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";
import nodemailer from 'nodemailer';

export async function POST(req) {
    try {
        await connectDB();
        const { uid, purchaseId } = await req.json();
        if (!uid || !purchaseId) return NextResponse.json({ message: "Invalid Purchase." }, { status: 414 });
        // 1. Verify user exists
        const user = await MobileUser.findOne({ uid });
        if (!user) return NextResponse.json({ message: "Player not found." }, { status: 404 });

        // 2. Increment coffee count
        user.coffeeCount = (user.coffeeCount || 0) + 1;

        // FIX: Ensure unlockedTitles is an array before checking/pushing
        if (!user.unlockedTitles) {
            user.unlockedTitles = [];
        }

        const alreadyHasPatron = user.unlockedTitles.some(t => t.name === "System Patron");
        if (!alreadyHasPatron) {
            user.unlockedTitles.push({ name: "System Patron", tier: "RARE" });
        }

        // Email Logic
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.MAILEREMAIL,
                pass: process.env.MAILERPASS
            },
        });

        const mailOptions = {
            from: `"O r e b l o g d a" <${process.env.MAILEREMAIL}>`, // Fixed name string
            to: process.env.MAILEREMAIL, // Changed "Admins" to a valid email variable
            bcc: ["kayteedberserker@gmail.com"],
            subject: `New Support Coffee Alert! ☕️`,
            html: `
                <h2>New Coffee Sent!</h2>
                <p><strong>User:</strong> ${user.username || 'Unknown User'} (UID: ${uid})</p>
                <p><strong>Purchase ID:</strong> ${purchaseId || 'N/A'}</p>
                <p><strong>Amount Gained:</strong> $0.99 </p>
                <p><strong>Total Coffees:</strong> ${user.coffeeCount}</p>
            `
        };

        // We wrap this in a try-catch or handle it so an email failure doesn't block the DB save
        try {
            await transporter.sendMail(mailOptions);
        } catch (mailErr) {
            console.error("Mail Delivery Failed:", mailErr);
            // We continue anyway because we want to save the user's purchase
        }

        await user.save();

        return NextResponse.json({
            message: "Energy Sync Complete! ☕️",
            coffeeCount: user.coffeeCount,
            titles: user.unlockedTitles
        }, { status: 200 });

    } catch (err) {
        console.error("Coffee Sync Error:", err);
        return NextResponse.json({ message: "Sync Error", error: err.message }, { status: 500 });
    }
}