// app/api/subscribe/route.js
import Newsletter from "@/models/Newsletter";
import connectDB from "@/lib/mongodb";
import nodemailer from "nodemailer";

export async function POST(req) {
  const { email } = await req.json();
  if (!email) return new Response(JSON.stringify({ error: "Email is required" }), { status: 400 });

  try {
    await connectDB();

    let subscriber = await Newsletter.findOne({ email });
    if (subscriber) {
        return new Response(JSON.stringify({ error: "Email is already subscribed" }), { status: 400 });
    }
    if (!subscriber) subscriber = await Newsletter.create({ email });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.MAILEREMAIL, pass: process.env.MAILERPASS },
    });

    await transporter.sendMail({
      from: `"MyWebsite" <${process.env.MAILEREMAIL}>`,
      to: email,
      subject: "Subscribed to Newsletter ✅",
      html: `<p>Thanks for subscribing! We'll keep you updated with new posts.</p>`,
    });

    return new Response(JSON.stringify({ success: true, message: "Subscribed successfully" }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Failed to subscribe" }), { status: 500 });
  }
}
