// ===============================
// Environment Variables
// ===============================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BOT_TOKEN = process.env.BOT_TOKEN || null;

// Minimum seconds required between rewarded ads (server-side enforcement)
const MIN_AD_INTERVAL_SECONDS = 50;

// Box (open-box) minimum seconds between box rewards (server-side enforcement)
const BOX_MIN_INTERVAL_SECONDS = 5 * 60; // 5 minutes

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // If these env vars are missing, throw early so developer notices
  console.error("Missing SUPABASE environment variables.");
}

// ===============================
// Helper: Supabase REST Request
// ===============================
async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL) {
    throw new Error("Supabase URL not configured");
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `Request failed with status ${res.status}`);
  }

  return res.status === 204 ? null : res.json();
}

// ===============================
// Helper: call Telegram getChatMember
// ===============================
async function checkTelegramMembership(chatIdentifier, userId) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("Telegram bot token not configured on server");
  }

  // chatIdentifier may be like "@channel" or "channel" or a full link
  // Normalize to @username if possible
  let chatId = chatIdentifier || "";
  chatId = String(chatId).trim();

  // If it's a full url like https://t.me/username or t.me/username, extract username
  const m = chatId.match(/t\.me\/(\+?[A-Za-z0-9_]+)/i);
  if (m && m[1]) {
    chatId = m[1];
  }

  // remove leading @ if present for the API we will prefix if necessary
  if (chatId.startsWith("@")) chatId = chatId.slice(1);

  // For safety, if it looks like an invite link (starts with +), the bot can't use getChatMember with +invite
  if (chatId.startsWith("+")) {
    throw new Error("Cannot verify invite-link style chat ids. Use a channel username.");
  }

  const encodedChat = encodeURIComponent("@" + chatId);
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodedChat}&user_id=${encodeURIComponent(userId)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Telegram API error: ${res.status} ${text}`);
  }

  const json = await res.json();
  if (!json || typeof json.ok === "undefined" || json.ok !== true) {
    // Telegram responded but not ok
    const description = json && json.description ? json.description : "unknown";
    throw new Error(`Telegram API failed: ${description}`);
  }

  const status = json.result && json.result.status ? String(json.result.status) : "";
  const memberStatuses = ["creator", "administrator", "member"];
  return memberStatuses.includes(status);
}

// ===============================
// Helper: resolve internal user id
// Many deployments use a UUID primary key for users while the client (Telegram WebApp)
// may attach a numeric Telegram user id. To avoid "invalid input syntax for type uuid"
// errors we attempt multiple strategies to resolve an internal user id for DB ops:
// 1) Try direct id lookup (users?id=eq.<value>)
// 2) If that fails due to uuid parse error or returns empty, try common alternative
//    columns that may hold Telegram id: telegram_id, tg_id, external_id
// Returns the internal user's id string (if found), or null.
async function resolveInternalUserId(providedUserId) {
  if (!providedUserId) return null;

  // 1) Try direct id match (wrap in try/catch to catch uuid parse errors coming from Postgrest)
  try {
    const direct = await supabaseRequest(`users?id=eq.${encodeURIComponent(providedUserId)}&select=id`);
    if (Array.isArray(direct) && direct.length > 0) {
      return direct[0].id;
    }
  } catch (e) {
    // If there's an error that looks like Postgres uuid parse issue, continue to fallback methods.
    // Log for diagnostics but don't fail the whole request.
    const errStr = String(e.message || e);
    if (!errStr.includes("invalid input syntax for type uuid")) {
      // If it's some other error, still continue to try fallback approaches.
      // But keep a note in logs.
      console.warn("resolveInternalUserId - direct lookup error (non-uuid):", e);
    } else {
      // silence expected uuid parse issues
    }
  }

  // 2) Try common alternative columns (telegram_id, tg_id, external_id)
  const altCols = ["telegram_id", "tg_id", "external_id"];
  for (const col of altCols) {
    try {
      const q = `users?${col}=eq.${encodeURIComponent(providedUserId)}&select=id`;
      const found = await supabaseRequest(q);
      if (Array.isArray(found) && found.length > 0) {
        return found[0].id;
      }
    } catch (e) {
      // ignore and continue, maybe column doesn't exist
    }
  }

  // 3) As a last resort try to match by id cast to text if PostgREST schema allows text comparison
  // (This attempt may or may not work depending on PostgREST configuration; try safe select and filter on server side)
  try {
    const allUsers = await supabaseRequest(`users?select=id`);
    if (Array.isArray(allUsers)) {
      const str = String(providedUserId);
      const matched = allUsers.find(u => String(u.id) === str);
      if (matched) return matched.id;
    }
  } catch (e) {
    // if this is heavy or failing, ignore
  }

  return null;
}

// ===============================
// API Handler
// ===============================
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const body = req.body || {};
  const { type, data } = body;

  if (!type) {
    return res.status(400).json({ success: false, error: "Missing action type" });
  }

  try {
    // ===============================
    // Sync User (accept optional referrerId)
    // ===============================
    if (type === "syncUser") {
      const { id, name = null, photo = null, referrerId = null } = data || {};

      if (!id) {
        return res.status(400).json({ success: false, error: "Missing user id" });
      }

      const today = new Date().toISOString().split("T")[0];

      // Check if user exists
      const existing = await supabaseRequest(`users?id=eq.${encodeURIComponent(id)}&select=*`);

      if (!existing || existing.length === 0) {
        // Create new user with initial values. Save referrer if provided.
        const created = await supabaseRequest("users", {
          method: "POST",
          body: JSON.stringify({
            // Attempt to save both id and a telegram_id field when possible.
            // If the DB has 'telegram_id' column this will be ignored if it doesn't exist.
            id,
            telegram_id: id,
            name,
            photo,
            balance: 0,
            ads_watched: 0,
            daily_ads: 0,
            last_ad_date: today,
            // last_ad_time stores ISO timestamp of the last rewarded ad (for server-side anti-abuse)
            last_ad_time: null,
            // last_box_time stores ISO timestamp of last box reward (server-side anti-abuse)
            last_box_time: null,
            referrer_id: referrerId || null,
            referral_active: false
          })
        });

        return res.status(200).json({ success: true, created: Array.isArray(created) ? created[0] : created });
      }

      // If user exists, but a referrerId is provided and the user doesn't already have a referrer, set it (prevent self-referral)
      const user = existing[0];
      if (referrerId && !user.referrer_id && String(user.id) !== String(referrerId)) {
        await supabaseRequest(`users?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            referrer_id: referrerId,
            referral_active: false
          })
        });
      }

      return res.status(200).json({ success: true });
    }

    // ===============================
    // Get Balance + Stats
    // ===============================
    if (type === "getBalance") {
      const { userId } = data || {};

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      // Resolve internal user id if necessary
      const internalId = await resolveInternalUserId(userId);
      if (!internalId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const result = await supabaseRequest(
        `users?id=eq.${encodeURIComponent(internalId)}&select=balance,ads_watched,daily_ads,last_ad_date,last_ad_time,referrer_id,referral_active,last_box_time`
      );

      if (!result || result.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      return res.status(200).json({
        success: true,
        balance: result[0].balance,
        adsWatched: result[0].ads_watched,
        dailyAds: result[0].daily_ads,
        lastAdDate: result[0].last_ad_date,
        lastAdTime: result[0].last_ad_time || null,
        referrerId: result[0].referrer_id || null,
        referralActive: !!result[0].referral_active,
        lastBoxTime: result[0].last_box_time || null
      });
    }

    // ===============================
    // Reward Box (Open-Box) - server-side handler
    // - Does NOT increment ad counters
    // - Enforces a separate box cooldown (BOX_MIN_INTERVAL_SECONDS)
    // ===============================
    if (type === "rewardBox") {
      const { userId, amount } = data || {};

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      if (typeof amount === "undefined") {
        return res.status(400).json({ success: false, error: "Missing amount" });
      }

      // Resolve internal user id
      const internalId = await resolveInternalUserId(userId);
      if (!internalId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const result = await supabaseRequest(`users?id=eq.${encodeURIComponent(internalId)}&select=*`);

      if (!result || result.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const user = result[0];
      const now = new Date();

      // Enforce server-side box cooldown
      if (user.last_box_time) {
        try {
          const lastBoxTime = new Date(user.last_box_time);
          const diffSeconds = Math.floor((now.getTime() - lastBoxTime.getTime()) / 1000);
          if (diffSeconds < BOX_MIN_INTERVAL_SECONDS) {
            const wait = BOX_MIN_INTERVAL_SECONDS - diffSeconds;
            return res.status(429).json({
              success: false,
              error: `Box cooldown: please wait ${wait} seconds before opening another box`
            });
          }
        } catch (e) {
          console.error("Failed to parse last_box_time:", e);
        }
      }

      const parsedAmount = Number(amount) || 0;
      const newBalance = (Number(user.balance) || 0) + parsedAmount;

      // Update only balance and last_box_time (no ad counters)
      await supabaseRequest(`users?id=eq.${encodeURIComponent(internalId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          balance: newBalance,
          last_box_time: now.toISOString()
        })
      });

      return res.status(200).json({
        success: true,
        balance: newBalance,
        lastBoxTime: now.toISOString()
      });
    }

    // ===============================
    // Reward User (Save Balance + Ads) and handle referral activation
    // Server-side enforces a minimum interval between rewarded ads to mitigate automation.
    // If data.isBox === true -> treat as box style reward (no ad counters) and enforce box cooldown.
    // ===============================
    if (type === "rewardUser") {
      const { userId, amount, isBox = false } = data || {};

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      if (typeof amount === "undefined") {
        return res.status(400).json({ success: false, error: "Missing amount" });
      }

      // Resolve internal user id
      const internalId = await resolveInternalUserId(userId);
      if (!internalId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const result = await supabaseRequest(
        `users?id=eq.${encodeURIComponent(internalId)}&select=*`
      );

      if (!result || result.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      let user = result[0];
      const now = new Date();
      const today = now.toISOString().split("T")[0];

      // If this is a box-style reward, enforce box cooldown and DO NOT increment ad counters
      if (isBox) {
        if (user.last_box_time) {
          try {
            const lastBoxTime = new Date(user.last_box_time);
            const diffSeconds = Math.floor((now.getTime() - lastBoxTime.getTime()) / 1000);
            if (diffSeconds < BOX_MIN_INTERVAL_SECONDS) {
              const wait = BOX_MIN_INTERVAL_SECONDS - diffSeconds;
              return res.status(429).json({
                success: false,
                error: `Box cooldown: please wait ${wait} seconds before opening another box`
              });
            }
          } catch (e) {
            console.error("Failed to parse last_box_time:", e);
          }
        }

        const parsedAmount = Number(amount) || 0;
        const newBalance = (Number(user.balance) || 0) + parsedAmount;

        // Update only balance and last_box_time
        await supabaseRequest(`users?id=eq.${encodeURIComponent(internalId)}`, {
          method: "PATCH",
          body: JSON.stringify({
            balance: newBalance,
            last_box_time: now.toISOString()
          })
        });

        return res.status(200).json({
          success: true,
          balance: newBalance,
          lastBoxTime: now.toISOString()
        });
      }

      // Server-side anti-abuse: ensure minimum time elapsed since last rewarded ad
      if (user.last_ad_time) {
        try {
          const lastAdTime = new Date(user.last_ad_time);
          const diffSeconds = Math.floor((now.getTime() - lastAdTime.getTime()) / 1000);
          if (diffSeconds < MIN_AD_INTERVAL_SECONDS) {
            const wait = MIN_AD_INTERVAL_SECONDS - diffSeconds;
            return res.status(429).json({
              success: false,
              error: `Ad cooldown: please wait ${wait} seconds before claiming another reward`
            });
          }
        } catch (e) {
          // if parsing fails, continue — we'll overwrite last_ad_time below
          console.error("Failed to parse last_ad_time:", e);
        }
      }

      let dailyAds = user.daily_ads || 0;
      if (user.last_ad_date !== today) {
        dailyAds = 0;
      }

      const DAILY_LIMIT = 100;

      if (dailyAds >= DAILY_LIMIT) {
        return res.status(400).json({
          success: false,
          error: "Daily limit reached",
          dailyAds
        });
      }

      const parsedAmount = Number(amount) || 0;
      const newBalance = (Number(user.balance) || 0) + parsedAmount;
      const newAdsWatched = (Number(user.ads_watched) || 0) + 1;
      const newDailyAds = dailyAds + 1;

      // Update the user's balance and ad counters and last_ad_time
      const updatedUser = await supabaseRequest(
        `users?id=eq.${encodeURIComponent(internalId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            balance: newBalance,
            ads_watched: newAdsWatched,
            daily_ads: newDailyAds,
            last_ad_date: today,
            last_ad_time: now.toISOString()
          })
        }
      );

      // Check referral activation: if the user was referred and not already activated, and has reached 10 watched ads
      let referralActivated = false;
      let inviterRewarded = false;
      let inviterId = user.referrer_id || null;

      if (inviterId && !user.referral_active) {
        // Determine total ads watched after increment (we used newAdsWatched)
        if (newAdsWatched >= 10) {
          // Reward inviter with 100 coins
          try {
            // Fetch inviter current balance
            const inviterRes = await supabaseRequest(`users?id=eq.${encodeURIComponent(inviterId)}&select=balance`);
            if (inviterRes && inviterRes.length > 0) {
              const inviter = inviterRes[0];
              const inviterBalance = Number(inviter.balance) || 0;
              const inviterNewBalance = inviterBalance + 100;

              // Update inviter balance
              await supabaseRequest(`users?id=eq.${encodeURIComponent(inviterId)}`, {
                method: "PATCH",
                body: JSON.stringify({ balance: inviterNewBalance })
              });

              // Mark referral as activated on the referred user
              await supabaseRequest(`users?id=eq.${encodeURIComponent(internalId)}`, {
                method: "PATCH",
                body: JSON.stringify({ referral_active: true })
              });

              referralActivated = true;
              inviterRewarded = true;
            }
          } catch (e) {
            // If inviter update failed, log but continue
            console.error("Failed to reward inviter:", e);
          }
        }
      }

      // return updated state
      return res.status(200).json({
        success: true,
        balance: newBalance,
        adsWatched: newAdsWatched,
        dailyAds: newDailyAds,
        referralActivated,
        inviterRewarded,
        inviterId: referralActivated ? inviterId : null,
        lastAdTime: now.toISOString()
      });
    }

    // ===============================
    // Create Task
    // ===============================
    if (type === "createTask") {
      const { name, link } = data || {};

      if (!name || !link) {
        return res.status(400).json({ success: false, error: "Missing name or link" });
      }

      const created = await supabaseRequest("tasks", {
        method: "POST",
        body: JSON.stringify({
          name,
          link,
          reward: 30
        })
      });

      return res.status(200).json({
        success: true,
        task: Array.isArray(created) ? created[0] : created
      });
    }

    // ===============================
    // Get Tasks
    // - If data.userId provided, exclude tasks already completed by that user
    // ===============================
    if (type === "getTasks") {
      const { userId } = data || {};

      // Fetch all tasks
      const tasks = await supabaseRequest(`tasks?select=*`);

      let filteredTasks = Array.isArray(tasks) ? tasks : [];

      if (userId) {
        // Resolve internal user id (if possible) before checking user_tasks
        const internalId = await resolveInternalUserId(userId);
        if (internalId) {
          // Fetch completed task ids for this user and filter them out
          const completed = await supabaseRequest(`user_tasks?user_id=eq.${encodeURIComponent(internalId)}&select=task_id`);
          const completedIds = Array.isArray(completed) ? completed.map(r => Number(r.task_id) || r.task_id) : [];
          filteredTasks = filteredTasks.filter(t => !completedIds.includes(Number(t.id) || t.id));
        }
      }

      return res.status(200).json({
        success: true,
        tasks: filteredTasks
      });
    }

    // ===============================
    // Complete Task (verify Telegram channel join + reward user + record completion)
    // Expects: data.userId (attached automatically by client), data.taskId
    // Flow:
    //  - Ensure user & task exist
    //  - Ensure user hasn't already completed task (user_tasks)
    //  - Try to parse task.link to a channel username
    //  - Use Telegram Bot API getChatMember to verify membership
    //  - If member: insert user_tasks row, increment user's balance by task.reward, return success with new balance
    // ===============================
    if (type === "completeTask") {
      const { userId: providedUserId, taskId } = data || {};

      if (!providedUserId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }
      if (!taskId) {
        return res.status(400).json({ success: false, error: "Missing taskId" });
      }

      // Resolve internal user id for DB operations (this may differ from Telegram numeric id)
      const internalUserId = await resolveInternalUserId(providedUserId);
      if (!internalUserId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // Check if user exists (fetch minimal for balance)
      const users = await supabaseRequest(`users?id=eq.${encodeURIComponent(internalUserId)}&select=balance`);
      if (!users || users.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // Check if task exists
      const tasks = await supabaseRequest(`tasks?id=eq.${encodeURIComponent(taskId)}&select=*`);
      if (!tasks || tasks.length === 0) {
        return res.status(404).json({ success: false, error: "Task not found" });
      }
      const task = tasks[0];

      // Check if already completed (use internal user id for user_tasks lookups)
      const existing = await supabaseRequest(`user_tasks?user_id=eq.${encodeURIComponent(internalUserId)}&task_id=eq.${encodeURIComponent(taskId)}&select=*`);
      if (existing && existing.length > 0) {
        return res.status(400).json({ success: false, error: "Task already completed" });
      }

      // Try to parse a channel identifier from task.link
      let chatIdentifier = null;
      try {
        if (task.link) {
          const linkStr = String(task.link).trim();
          // If link contains t.me/username => extract
          const mm = linkStr.match(/t\.me\/(\+?[A-Za-z0-9_]+)/i);
          if (mm && mm[1]) {
            chatIdentifier = mm[1];
          } else {
            // If link contains @username
            const mm2 = linkStr.match(/@([A-Za-z0-9_]+)/i);
            if (mm2 && mm2[1]) chatIdentifier = mm2[1];
            else chatIdentifier = linkStr; // fallback, try raw
          }
        }
      } catch (e) {
        console.error("Failed to parse task link for chat identifier:", e);
      }

      if (!chatIdentifier) {
        return res.status(400).json({ success: false, error: "Unable to determine channel username from task link" });
      }

      // Check membership via Telegram API
      let isMember = false;
      try {
        // For Telegram verification we must use the Telegram numeric user id (providedUserId)
        isMember = await checkTelegramMembership(chatIdentifier, providedUserId);
      } catch (e) {
        // If verification failed due to bot missing token or other API error, surface clear error
        console.error("Telegram membership check error:", e);
        return res.status(500).json({ success: false, error: `Failed to verify membership: ${e.message || String(e)}` });
      }

      if (!isMember) {
        return res.status(400).json({ success: false, error: "User is not a member of the channel" });
      }

      // Record completion in user_tasks using internal user id
      const now = new Date().toISOString();
      await supabaseRequest("user_tasks", {
        method: "POST",
        body: JSON.stringify({
          user_id: internalUserId,
          task_id: taskId,
          created_at: now
        })
      });

      // Reward the user: increment balance by task.reward
      const user = users[0];
      const currentBalance = Number(user.balance) || 0;
      const reward = Number(task.reward) || 0;
      const newBalance = currentBalance + reward;

      await supabaseRequest(`users?id=eq.${encodeURIComponent(internalUserId)}`, {
        method: "PATCH",
        body: JSON.stringify({ balance: newBalance })
      });

      return res.status(200).json({
        success: true,
        rewarded: reward,
        balance: newBalance,
        taskId
      });
    }

    // ===============================
    // Get Withdraws for a user (history)
    // - Returns withdraw rows ordered by created_at desc
    // ===============================
    if (type === "getWithdraws") {
      const { userId } = data || {};

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      const internalId = await resolveInternalUserId(userId);
      if (!internalId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // select useful fields
      const rows = await supabaseRequest(
        `withdraw?user_id=eq.${encodeURIComponent(internalId)}&select=id,amount,status,destination,created_at,processed_at&order=created_at.desc`
      );

      return res.status(200).json({
        success: true,
        withdraws: Array.isArray(rows) ? rows : []
      });
    }

    // ===============================
    // Create Withdraw (NEW)
    // - Validates minimum amount (300)
    // - Checks user balance
    // - Inserts a row into withdraw table with status 'pending'
    // - Deducts balance immediately (so user can't double-withdraw)
    // Table name on server: withdraw
    // ===============================
    if (type === "createWithdraw") {
      const { userId, amount, destination = null } = data || {};

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      if (typeof amount === "undefined") {
        return res.status(400).json({ success: false, error: "Missing amount" });
      }

      const internalId = await resolveInternalUserId(userId);
      if (!internalId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const parsedAmount = Number(amount) || 0;
      const MIN_WITHDRAW = 300;

      if (parsedAmount < MIN_WITHDRAW) {
        return res.status(400).json({
          success: false,
          error: `Minimum withdraw is ${MIN_WITHDRAW} coins`
        });
      }

      // Fetch user to verify balance
      const users = await supabaseRequest(`users?id=eq.${encodeURIComponent(internalId)}&select=balance`);
      if (!users || users.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const user = users[0];
      const currentBalance = Number(user.balance) || 0;

      if (currentBalance < parsedAmount) {
        return res.status(400).json({ success: false, error: "Insufficient balance" });
      }

      const now = new Date().toISOString();

      // Create withdraw row
      const withdrawRow = {
        user_id: internalId,
        amount: parsedAmount,
        destination: destination || null,
        status: "pending",
        created_at: now
      };

      const created = await supabaseRequest("withdraw", {
        method: "POST",
        body: JSON.stringify(withdrawRow)
      });

      // Deduct user's balance (immediate hold)
      const newBalance = currentBalance - parsedAmount;
      await supabaseRequest(`users?id=eq.${encodeURIComponent(internalId)}`, {
        method: "PATCH",
        body: JSON.stringify({ balance: newBalance })
      });

      return res.status(200).json({
        success: true,
        withdraw: Array.isArray(created) ? created[0] : created,
        balance: newBalance
      });
    }

    // ===============================
    // Get Referrals counts and details for inviter (active / pending + list)
    // Returns: { success, active, pending, referrals: [{id,name,photo,ads_watched,referral_active}] }
    // ===============================
    if (type === "getReferrals") {
      const { userId } = data || {};

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      const internalId = await resolveInternalUserId(userId);
      if (!internalId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // Fetch referral rows with useful fields
      const referrals = await supabaseRequest(`users?referrer_id=eq.${encodeURIComponent(internalId)}&select=id,name,photo,ads_watched,referral_active`);

      if (!referrals) {
        return res.status(200).json({ success: true, active: 0, pending: 0, referrals: [] });
      }

      let active = 0;
      let total = 0;
      referrals.forEach(r => {
        total++;
        if (r.referral_active) active++;
      });

      const pending = total - active;

      return res.status(200).json({
        success: true,
        active,
        pending,
        referrals // array of objects: id,name,photo,ads_watched,referral_active
      });
    }

    // ===============================
    // Unknown Action
    // ===============================
    return res.status(400).json({
      success: false,
      error: "Invalid action type"
    });

  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || String(error)
    });
  }
}