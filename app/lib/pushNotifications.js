// app/lib/pushNotifications.js

/**
 * Sends a single push notification (Best for 1-to-1 alerts)
 */
export async function sendPushNotification(pushToken, title, message, data = {}) {
  if (!pushToken) {
    console.log("🔔 Push Logic: No token found. Skipping.");
    return;
  }

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
    console.log("✅ Single Push Sent:", result);
    return result;
  } catch (error) {
    console.error("❌ Single Push Error:", error);
  }
}

/**
 * Sends notifications to multiple tokens using Expo's chunking (Best for Global alerts)
 * @param {Array} tokens - Array of push token strings
 */
export async function sendMultiplePushNotifications(tokens, title, message, data = {}) {
  if (!tokens || tokens.length === 0) {
    console.log("🔔 Push Logic: No tokens provided for broadcast.");
    return;
  }

  // Expo limit is 100 messages per batch
  const CHUNK_SIZE = 100;
  const chunks = [];
  
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    chunks.push(tokens.slice(i, i + CHUNK_SIZE));
  }

  console.log(`🚀 Push Logic: Sending broadcast to ${tokens.length} users in ${chunks.length} chunks.`);

  const chunkPromises = chunks.map(async (chunk) => {
    const messages = chunk.map(token => ({
      to: token,
      sound: 'default',
      title: title,
      body: message,
      data: data,
    }));

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      return await response.json();
    } catch (error) {
      console.error("❌ Chunk Push Error:", error);
      return null;
    }
  });

  const results = await Promise.all(chunkPromises);
  console.log(`✅ Broadcast Complete. Processed ${results.length} chunks.`);
  return results;
}
