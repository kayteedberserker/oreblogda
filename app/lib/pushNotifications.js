/**
 * Sends a single push notification (Best for 1-to-1 alerts)
 */
export async function sendPushNotification(pushToken, title, message, data = {}) {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
    console.log("🔔 Push Logic: Invalid or missing token. Skipping.");
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
    console.log("✅ Single Push Response:", JSON.stringify(result));
    return result;
  } catch (error) {
    console.error("❌ Single Push Error:", error);
  }
}

/**
 * Sends notifications to multiple tokens using Expo's chunking
 * @param {Array} tokens - Array of push token strings
 */
export async function sendMultiplePushNotifications(tokens, title, message, data = {}) {
  // Filter out nulls, empty strings, or non-expo tokens
  const validTokens = tokens.filter(t => t && t.startsWith('ExponentPushToken'));

  if (validTokens.length === 0) {
    console.log("🔔 Push Logic: No valid Expo tokens found for broadcast.");
    return;
  }

  const CHUNK_SIZE = 100;
  const chunks = [];
  
  for (let i = 0; i < validTokens.length; i += CHUNK_SIZE) {
    chunks.push(validTokens.slice(i, i + CHUNK_SIZE));
  }

  console.log(`🚀 Push Logic: Sending broadcast to ${validTokens.length} users in ${chunks.length} chunks.`);

  const chunkPromises = chunks.map(async (chunk, index) => {
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
      const result = await response.json();
      console.log(`📦 Chunk ${index + 1} Result:`, JSON.stringify(result));
      return result;
    } catch (error) {
      console.error(`❌ Chunk ${index + 1} Push Error:`, error);
      return null;
    }
  });

  const results = await Promise.all(chunkPromises);
  console.log(`✅ Broadcast Complete. Processed ${results.length} chunks.`);
  return results;
}
