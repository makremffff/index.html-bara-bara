// ===============================
// Environment Variables
// ===============================
// NOTE: This server treats Telegram IDs as TEXT (string). All columns that store Telegram IDs
// should be defined as type TEXT in the database (NOT uuid, NOT bigint).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

// Utility to safely build eq filters for Supabase REST.
// IMPORTANT: This application stores Telegram IDs as TEXT. Therefore when building eq filters
// for user IDs we MUST emit quoted string values. To support different column types safely,
// this function accepts an options object. By default we treat values as TEXT (quoted).
function eqFilterValue(val, opts = { forceText: true }) {
  if (val === null || typeof val === 'undefined') return "null";
  // Normalize to string
  const s = String(val);
  // If caller explicitly wants numeric (forceText: false) we attempt to emit raw numeric when appropriate
  if (!opts.forceText) {
    if (/^[0-9]+$/.test(s)) return s; // numeric literal (no quotes)
    return `'${s.replace(/'/g, "''")}'`;
  }
  // Default: force text quoting (escape internal single quotes)
  return `'${s.replace(/'/g, "''")}'`;
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
    // Note: user id in DB MUST be TEXT (Telegram ID as string).
    // ===============================
    if (type === "syncUser") {
      const { id, name = null, photo = null, referrerId = null } = data || {};

      if (typeof id === "undefined" || id === null) {
        return res.status(400).json({ success: false, error: "Missing user id" });
      }

      // Ensure id is sent/stored as string (TEXT)
      const userIdVal = String(id);

      const today = new Date().toISOString().split("T")[0];

      // Check if user exists (use eq filter treating user id as text)
      const filterUserId = eqFilterValue(userIdVal, { forceText: true });
      const existing = await supabaseRequest(`users?id=eq.${filterUserId}&select=*`);

      if (!existing || existing.length === 0) {
        // Create new user with initial values. Save referrer if provided.
        const created = await supabaseRequest("users", {
          method: "POST",
          body: JSON.stringify({
            id: userIdVal, // ALWAYS send Telegram ID as text
            name,
            photo,
            balance: 0,
            ads_watched: 0,
            daily_ads: 0,
            last_ad_date: today,
            last_ad_time: null,
            last_box_time: null,
            referrer_id: referrerId ? String(referrerId) : null,
            referral_active: false
          })
        });

        return res.status(200).json({ success: true, created: Array.isArray(created) ? created[0] : created });
      }

      // If user exists, but a referrerId is provided and the user doesn't already have a referrer, set it (prevent self-referral)
      const user = existing[0];
      if (referrerId && !user.referrer_id && String(user.id) !== String(referrerId)) {
        const patchFilter = `id=eq.${filterUserId}`;
        await supabaseRequest(`users?${patchFilter}`, {
          method: "PATCH",
          body: JSON.stringify({
            referrer_id: String(referrerId),
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

      if (typeof userId === "undefined" || userId === null) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      // Treat userId as text
      const filterUserId = eqFilterValue(String(userId), { forceText: true });
      const result = await supabaseRequest(
        `users?id=eq.${filterUserId}&select=balance,ads_watched,daily_ads,last_ad_date,last_ad_time,referrer_id,referral_active,last_box_time`
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
    // ===============================
    if (type === "rewardBox") {
      const { userId, amount } = data || {};

      if (typeof userId === "undefined" || userId === null) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      if (typeof amount === "undefined") {
        return res.status(400).json({ success: false, error: "Missing amount" });
      }

      const filterUserId = eqFilterValue(String(userId), { forceText: true });
      const result = await supabaseRequest(`users?id=eq.${filterUserId}&select=*`);

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
      await supabaseRequest(`users?id=eq.${filterUserId}`, {
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
    // ===============================
    if (type === "rewardUser") {
      const { userId, amount, isBox = false } = data || {};

      if (typeof userId === "undefined" || userId === null) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      if (typeof amount === "undefined") {
        return res.status(400).json({ success: false, error: "Missing amount" });
      }

      const filterUserId = eqFilterValue(String(userId), { forceText: true });
      const result = await supabaseRequest(
        `users?id=eq.${filterUserId}&select=*`
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
        await supabaseRequest(`users?id=eq.${filterUserId}`, {
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
        `users?id=eq.${filterUserId}`,
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
            const inviterFilter = eqFilterValue(String(inviterId), { forceText: true });
            // Fetch inviter current balance
            const inviterRes = await supabaseRequest(`users?id=eq.${inviterFilter}&select=balance`);
            if (inviterRes && inviterRes.length > 0) {
              const inviter = inviterRes[0];
              const inviterBalance = Number(inviter.balance) || 0;
              const inviterNewBalance = inviterBalance + 100;

              // Update inviter balance
              await supabaseRequest(`users?id=eq.${inviterFilter}`, {
                method: "PATCH",
                body: JSON.stringify({ balance: inviterNewBalance })
              });

              // Mark referral as activated on the referred user
              await supabaseRequest(`users?id=eq.${filterUserId}`, {
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
    // ===============================
    if (type === "getTasks") {
      const tasks = await supabaseRequest(
        `tasks?select=*`
      );

      return res.status(200).json({
        success: true,
        tasks
      });
    }

    // ===============================
    // Complete Task (NEW)
    // - Validates inputs
    // - Ensures task exists
    // - Ensures user hasn't already completed the task (server-side check)
    // - Inserts a completion row into task_completions
    // - Adds reward to user's balance and returns the updated balance.
    // NOTE: user_id and related columns MUST be TEXT (Telegram IDs stored as text).
    // ===============================
    if (type === "completeTask") {
      const { userId, taskId } = data || {};

      if (typeof userId === "undefined" || userId === null) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      if (!taskId) {
        return res.status(400).json({ success: false, error: "Missing taskId" });
      }

      // 1) Verify task exists and get its reward
      const tasks = await supabaseRequest(`tasks?id=eq.${eqFilterValue(taskId, { forceText: true })}&select=id,name,reward`);
      if (!tasks || tasks.length === 0) {
        return res.status(404).json({ success: false, error: "Task not found" });
      }
      const task = tasks[0];
      const reward = Number(task.reward) || 0;

      // 2) Check if user exists
      const usersExist = await supabaseRequest(`users?id=eq.${eqFilterValue(String(userId), { forceText: true })}&select=id,balance`);
      if (!usersExist || usersExist.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // 3) Check if user already completed this task
      // We assume task_completions.user_id is TEXT (storing Telegram ID).
      const existing = await supabaseRequest(
        `task_completions?user_id=eq.${eqFilterValue(String(userId), { forceText: true })}&task_id=eq.${eqFilterValue(taskId, { forceText: true })}&select=id,created_at`
      );

      if (existing && existing.length > 0) {
        return res.status(400).json({ success: false, error: "Task already completed" });
      }

      const now = new Date().toISOString();

      // 4) Insert completion row (send user_id as TEXT)
      let createdCompletion = null;
      try {
        createdCompletion = await supabaseRequest("task_completions", {
          method: "POST",
          body: JSON.stringify({
            user_id: String(userId), // IMPORTANT: store Telegram ID as TEXT
            task_id: taskId,
            reward: reward,
            created_at: now
          })
        });
      } catch (e) {
        // If insert fails (e.g., due to type mismatch on DB), return a helpful error.
        console.error("Failed to insert task_completions:", e);
        const errMsg = (e && e.message) ? String(e.message) : 'Failed to record completion';
        return res.status(500).json({ success: false, error: errMsg });
      }

      // 5) Update user's balance (safe pattern: fetch, compute, patch)
      const users = await supabaseRequest(`users?id=eq.${eqFilterValue(String(userId), { forceText: true })}&select=balance`);
      if (!users || users.length === 0) {
        // rollback: try to remove created completion if user missing
        try {
          const createdId = Array.isArray(createdCompletion) ? createdCompletion[0].id : (createdCompletion && createdCompletion.id);
          if (createdId) {
            await supabaseRequest(`task_completions?id=eq.${eqFilterValue(createdId, { forceText: true })}`, { method: "DELETE" });
          }
        } catch (ee) {}
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const user = users[0];
      const currentBalance = Number(user.balance) || 0;
      const newBalance = currentBalance + reward;

      await supabaseRequest(`users?id=eq.${eqFilterValue(String(userId), { forceText: true })}`, {
        method: "PATCH",
        body: JSON.stringify({ balance: newBalance })
      });

      return res.status(200).json({
        success: true,
        taskId,
        reward,
        balance: newBalance,
        completion: Array.isArray(createdCompletion) ? createdCompletion[0] : createdCompletion
      });
    }

    // ===============================
    // Create Withdraw (NEW)
    // ===============================
    if (type === "createWithdraw") {
      const { userId, amount, destination = null } = data || {};

      if (typeof userId === "undefined" || userId === null) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      if (typeof amount === "undefined") {
        return res.status(400).json({ success: false, error: "Missing amount" });
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
      const users = await supabaseRequest(`users?id=eq.${eqFilterValue(String(userId), { forceText: true })}&select=balance`);
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
        user_id: String(userId), // KEEP as TEXT
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
      await supabaseRequest(`users?id=eq.${eqFilterValue(String(userId), { forceText: true })}`, {
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
    // Get Withdraws for a user (history)
    // ===============================
    if (type === "getWithdraws") {
      const { userId } = data || {};

      if (typeof userId === "undefined" || userId === null) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      // select useful fields
      const rows = await supabaseRequest(
        `withdraw?user_id=eq.${eqFilterValue(String(userId), { forceText: true })}&select=id,amount,status,destination,created_at,processed_at&order=created_at.desc`
      );

      return res.status(200).json({
        success: true,
        withdraws: Array.isArray(rows) ? rows : []
      });
    }

    // ===============================
    // Get Referrals counts and details for inviter (active / pending + list)
    // ===============================
    if (type === "getReferrals") {
      const { userId } = data || {};

      if (typeof userId === "undefined" || userId === null) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      // Fetch referral rows with useful fields
      const referrals = await supabaseRequest(`users?referrer_id=eq.${eqFilterValue(String(userId), { forceText: true })}&select=id,name,photo,ads_watched,referral_active`);

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
    // If the error string includes postgres 22P02 invalid input syntax for uuid, provide clearer message
    const msg = error && error.message ? String(error.message) : String(error);
    if (msg.includes('invalid input syntax for type uuid') || msg.includes('22P02')) {
      return res.status(500).json({
        success: false,
        error: JSON.stringify({
          code: "22P02",
          details: null,
          hint: "Database column type mismatch: it looks like the server attempted to use a uuid column for a Telegram ID. Ensure Telegram ID columns (users.id, task_completions.user_id, withdraw.user_id, etc.) are TYPE text. Do NOT send Telegram IDs as numeric/unquoted values or cast them to uuid.",
          message: msg
        })
      });
    }

    return res.status(500).json({
      success: false,
      error: msg
    });
  }
}