import nodemailer from "nodemailer";

export async function POST(req) {
  try {
    const { name, email, message, type } = await req.json();

    if (!name || !email || !message)
      return Response.json({ error: "All fields are required." }, { status: 400 });

    // Nodemailer setup
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAILEREMAIL,
        pass: process.env.MAILERPASS, // Gmail App Password
      },
    });

    // 🔸 1. Email to Admin (you)
    const adminMailOptions = {
      from: `"${name}" <${email}>`,
      to: process.env.MAILEREMAIL,
      subject: `[Oreblogda Contact] ${type || "General"} Message`,
      html: `
        <h2>New message from Oreblogda Contact Form</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Category:</strong> ${type || "General"}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    };

    await transporter.sendMail(adminMailOptions);

    // 🔸 2. Confirmation email to user
    const confirmMailOptions = {
      from: `"Oreblogda Team" <${process.env.MAILEREMAIL}>`,
      to: email,
      subject: "✅ We’ve received your message!",
      html: `
        <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.6;">
          <h2 style="color:#ff6600;">Hey ${name},</h2>
          <p>Thanks for reaching out to <strong>Oreblogda</strong>! 🎉</p>
          <p>We’ve received your message and our team will get back to you soon.</p>
          <hr style="border:none; border-top:1px solid #eee;">
          <p><strong>Your message summary:</strong></p>
          <p><em>${message}</em></p>
          <br>
          <p style="font-size: 14px; color: #777;">
            Regards,<br>
            The Oreblogda Team<br>
            <a href="https://oreblogda.com" style="color:#ff6600; text-decoration:none;">oreblogda.com</a>
          </p>
        </div>
      `,
    };

    await transporter.sendMail(confirmMailOptions);

    return Response.json({ message: "Message sent and confirmation email delivered!" }, { status: 200 });
  } catch (err) {
    console.error("Contact form error:", err);
    return Response.json({ error: "Failed to send message." }, { status: 500 });
  }
}
