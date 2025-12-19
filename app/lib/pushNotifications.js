// app/lib/pushNotifications.js

export async function sendPushNotification(pushToken, title, message, data = {}) {
  // If there is no token (like on Web), we just log it and skip
  if (!pushToken) {
    console.log("🔔 Push Logic: No token found for this user. Skipping push.");
    return;
  }

  console.log(`🚀 Push Logic: Attempting to send push to ${pushToken}`);

  const payload = {
    to: pushToken,
    sound: 'default',
    title: title,
    body: message,
    data: data,
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log("✅ Push Sent Result:", result);
  } catch (error) {
    console.error("❌ Push Error:", error);
  }
}