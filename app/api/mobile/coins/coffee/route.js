import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";
import nodemailer from 'nodemailer';
export async function POST(req) {
    try {
        await connectDB();
        const { uid, purchaseId } = await req.json();

        // 1. Verify user exists
        const user = await MobileUser.findOne({ uid });
        if (!user) return NextResponse.json({ message: "Operative not found." }, { status: 404 });

        // 2. Increment coffee count and add a "Supporter" badge logic
        user.coffeeCount = (user.coffeeCount || 0) + 1;

        // If it's their first coffee, maybe give them a permanent flag
        if (user.coffeeCount < 1) {
            user.unlockedTitles.push({ name: "System Patron", tier: "RARE" });
        }

        // Email Logic
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: process.env.MAILEREMAIL, pass: process.env.MAILERPASS },
        });

        const mailOptions = {
            from: `"O hablo" <${process.env.MAILEREMAIL}>`,
            to: "Admins",
            bcc: ["kayteedberserker@gmail.com"],
            subject: `New Support Coffee Alert!`,
            html: `
                <h2>New Coffee Sent!</h2>
                <p><strong>User:</strong> ${user.username || 'Unknown User'} (Device ID: ${uid})</p>
                <p><strong>Amount Gained:</strong> $0.99 </p>
                <p><strong>New Coffee Count:</strong> ${user.coffeeCount}</p>
            `
        };
        await transporter.sendMail(mailOptions);

        await user.save();

        return NextResponse.json({
            message: "Energy Sync Complete! ☕️",
            coffeeCount: user.coffeeCount
        }, { status: 200 });


    } catch (err) {
        return NextResponse.json({ message: "Sync Error", error: err.message }, { status: 500 });
    }
}