// ===============================
// Environment Variables
// ===============================
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
      const existing = await supabaseRequest(`users?id=eq.${id}&select=*`);

      if (!existing || existing.length === 0) {
        // Create new user with initial values. Save referrer if provided.
        const created = await supabaseRequest("users", {
          method: "POST",
          body: JSON.stringify({
            id,
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
        await supabaseRequest(`users?id=eq.${id}`, {
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

      const result = await supabaseRequest(
        `users?id=eq.${userId}&select=balance,ads_watched,daily_ads,last_ad_date,last_ad_time,referrer_id,referral_active,last_box_time`
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

      const result = await supabaseRequest(`users?id=eq.${userId}&select=*`);

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
      await supabaseRequest(`users?id=eq.${userId}`, {
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

      const result = await supabaseRequest(
        `users?id=eq.${userId}&select=*`
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
        await supabaseRequest(`users?id=eq.${userId}`, {
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
        `users?id=eq.${userId}`,
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
            const inviterRes = await supabaseRequest(`users?id=eq.${inviterId}&select=balance`);
            if (inviterRes && inviterRes.length > 0) {
              const inviter = inviterRes[0];
              const inviterBalance = Number(inviter.balance) || 0;
              const inviterNewBalance = inviterBalance + 100;

              // Update inviter balance
              await supabaseRequest(`users?id=eq.${inviterId}`, {
                method: "PATCH",
                body: JSON.stringify({ balance: inviterNewBalance })
              });

              // Mark referral as activated on the referred user
              await supabaseRequest(`users?id=eq.${userId}`, {
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
    // Create Task (inserts into task_faucet)
    // - Keep existing UI behavior possible, but tasks now live in task_faucet table
    // - reward defaults to 30 if not provided
    // ===============================
    if (type === "createTask") {
      const { name, link, reward = 30 } = data || {};

      if (!name || !link) {
        return res.status(400).json({ success: false, error: "Missing name or link" });
      }

      // Insert into task_faucet table
      const created = await supabaseRequest("task_faucet", {
        method: "POST",
        body: JSON.stringify({
          name,
          link,
          reward: Number(reward)
        })
      });

      return res.status(200).json({
        success: true,
        task: Array.isArray(created) ? created[0] : created
      });
    }

    // ===============================
    // Get Tasks (reads from task_faucet)
    // - Returns tasks: [{id,name,link,reward}]
    // ===============================
    if (type === "getTasks") {
      const tasks = await supabaseRequest(
        `task_faucet?select=id,name,link,reward,created_at`
      );

      return res.status(200).json({
        success: true,
        tasks: Array.isArray(tasks) ? tasks : []
      });
    }

    // ===============================
    // Complete Task
    // - data: { userId, taskId }
    // - Server verifies user and task exist, ensures the user hasn't completed the task,
    //   records completion in task_faucet_progress, adds reward to user's balance, returns new balance.
    // - Protection against double awarding via UNIQUE(user_id, task_id) on task_faucet_progress.
    // ===============================
    if (type === "completeTask") {
      const { userId, taskId } = data || {};

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      if (!taskId) {
        return res.status(400).json({ success: false, error: "Missing taskId" });
      }

      // Verify user exists
      const users = await supabaseRequest(`users?id=eq.${userId}&select=balance`);
      if (!users || users.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // Verify task exists and get reward
      const tasks = await supabaseRequest(`task_faucet?id=eq.${taskId}&select=id,name,link,reward`);
      if (!tasks || tasks.length === 0) {
        return res.status(404).json({ success: false, error: "Task not found" });
      }
      const task = tasks[0];
      const reward = Number(task.reward) || 0;

      const now = new Date().toISOString();

      // Attempt to insert progress record. If unique constraint violation occurs, treat as already completed.
      try {
        const inserted = await supabaseRequest("task_faucet_progress", {
          method: "POST",
          body: JSON.stringify({
            user_id: userId,
            task_id: taskId,
            completed: true,
            completed_at: now
          })
        });

        // If inserted, proceed to update user's balance
        // Fetch current user balance again (fresh)
        const fresh = await supabaseRequest(`users?id=eq.${userId}&select=balance`);
        const currentBalance = (fresh && fresh.length > 0) ? Number(fresh[0].balance) || 0 : 0;
        const newBalance = currentBalance + reward;

        // Update user's balance
        await supabaseRequest(`users?id=eq.${userId}`, {
          method: "PATCH",
          body: JSON.stringify({
            balance: newBalance
          })
        });

        return res.status(200).json({
          success: true,
          message: "Task completed",
          taskId,
          reward,
          balance: newBalance
        });

      } catch (e) {
        // Inspect error message to determine if it's a unique violation (already completed)
        const errMsg = (e && e.message) ? e.message.toLowerCase() : String(e).toLowerCase();
        if (errMsg.includes("duplicate") || errMsg.includes("unique") || errMsg.includes("already exists") || errMsg.includes("duplicate key")) {
          return res.status(400).json({ success: false, error: "Task already completed" });
        }

        console.error("Failed to record task progress or update balance:", e);
        return res.status(500).json({ success: false, error: "Failed to complete task" });
      }
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

      const parsedAmount = Number(amount) || 0;
      const MIN_WITHDRAW = 300;

      if (parsedAmount < MIN_WITHDRAW) {
        return res.status(400).json({
          success: false,
          error: `Minimum withdraw is ${MIN_WITHDRAW} coins`
        });
      }

      // Fetch user to verify balance
      const users = await supabaseRequest(`users?id=eq.${userId}&select=balance`);
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
        user_id: userId,
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
      await supabaseRequest(`users?id=eq.${userId}`, {
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
    // - Returns withdraw rows ordered by created_at desc
    // ===============================
    if (type === "getWithdraws") {
      const { userId } = data || {};

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      // select useful fields
      const rows = await supabaseRequest(
        `withdraw?user_id=eq.${userId}&select=id,amount,status,destination,created_at,processed_at&order=created_at.desc`
      );

      return res.status(200).json({
        success: true,
        withdraws: Array.isArray(rows) ? rows : []
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

      // Fetch referral rows with useful fields
      const referrals = await supabaseRequest(`users?referrer_id=eq.${userId}&select=id,name,photo,ads_watched,referral_active`);

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