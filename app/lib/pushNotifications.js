/**
 * Sends a single push notification with Grouping & Rich Media (Image) support
 * @param {string} pushToken - The recipient's Expo push token
 * @param {string} title - The notification title
 * @param {string} message - The notification body
 * @param {object} data - Extra data (screen, postId, 🌟 mediaUrl)
 * @param {string} groupId - (Optional) Use a unique ID (like post ID) to group notifications together
 */
export async function sendPushNotification(pushToken, title, message, data = {}, groupId = null) {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
    console.log("🔔 Push Logic: Invalid or missing token. Skipping.");
    return;
  }

  const payload = {
    to: pushToken,
    sound: 'default',
    title: title,
    body: message,
    data: {
      ...data, // 🌟 If data contains { mediaUrl: "https..." }, it gets passed securely here!
      groupId: groupId,
    },
    // 🛡️ GROUPING LOGIC
    // iOS: Groups by threadId
    threadIdentifier: groupId || 'default_group',
    // 🌟 Android & iOS Rich Media: mutableContent=true allows OS to download images before display
    mutableContent: true,
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
 * Sends notifications to multiple tokens with Grouping & Rich Media support
 */
export async function sendMultiplePushNotifications(tokens, title, message, data = {}, groupId = null) {
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

  const chunkPromises = chunks.map(async (chunk, index) => {
    const messages = chunk.map(token => ({
      to: token,
      sound: "default",
      title: title,
      body: message,
      data: {
        ...data, // 🌟 Passes mediaUrl if provided
        groupId: groupId, // 🌟 FIX: Moved this INSIDE the data object so frontend frontend can read `data?.groupId`
      },
      // 🛡️ GROUPING LOGIC
      threadId: groupId || 'broadcast_group',
      // 🌟 Rich Media Support
      mutableContent: true,
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
      console.log(`✅ Chunk ${index + 1} Push Response:`, result);
      return result;
    } catch (error) {
      console.error(`❌ Chunk ${index + 1} Push Error:`, error);
      return null;
    }
  });

  const results = await Promise.all(chunkPromises);
  return results;
}