// ===============================
// Environment Variables
// ===============================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Minimum seconds required between rewarded ads (server-side enforcement)
const MIN_AD_INTERVAL_SECONDS = 50;

// Box (open-box) minimum seconds between box rewards (server-side enforcement)
const BOX_MIN_INTERVAL_SECONDS = 5 * 60; // 5 minutes

const { randomUUID } = require("crypto");

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

  // Ensure path is a string and safe to append
  const url = `${SUPABASE_URL}/rest/v1/${path}`;

  const res = await fetch(url, {
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
// Utilities
// ===============================
function ensureStringId(id) {
  // Prevent sending raw numbers to UUID columns.
  // Convert anything to string; caller must ensure DB types align.
  if (id === null || typeof id === "undefined") return null;
  return String(id);
}

function encodeFilterValue(val) {
  // Wrap in single quotes and return safely
  return `'${String(val).replace(/'/g, "''")}'`;
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
      // Use quoted filter to avoid invalid uuid syntax errors when id is numeric
      const userIdStr = ensureStringId(id);
      const existing = await supabaseRequest(`users?select=*&id=eq.${encodeFilterValue(userIdStr)}`);

      if (!existing || existing.length === 0) {
        // Create new user with initial values. Save referrer if provided.
        const created = await supabaseRequest("users", {
          method: "POST",
          body: JSON.stringify({
            id: userIdStr,
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
            referrer_id: referrerId ? ensureStringId(referrerId) : null,
            referral_active: false
          })
        });

        return res.status(200).json({ success: true, created: Array.isArray(created) ? created[0] : created });
      }

      // If user exists, but a referrerId is provided and the user doesn't already have a referrer, set it (prevent self-referral)
      const user = existing[0];
      if (referrerId && !user.referrer_id && String(user.id) !== String(referrerId)) {
        await supabaseRequest(`users?id=eq.${encodeFilterValue(userIdStr)}`, {
          method: "PATCH",
          body: JSON.stringify({
            referrer_id: ensureStringId(referrerId),
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

      const userIdStr = ensureStringId(userId);

      const result = await supabaseRequest(
        `users?select=balance,ads_watched,daily_ads,last_ad_date,last_ad_time,referrer_id,referral_active,last_box_time&id=eq.${encodeFilterValue(userIdStr)}`
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

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      if (typeof amount === "undefined") {
        return res.status(400).json({ success: false, error: "Missing amount" });
      }

      const userIdStr = ensureStringId(userId);
      const result = await supabaseRequest(`users?id=eq.${encodeFilterValue(userIdStr)}&select=*`);

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
      await supabaseRequest(`users?id=eq.${encodeFilterValue(userIdStr)}`, {
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
    // (unchanged existing logic except using quoted ids)
    // ===============================
    if (type === "rewardUser") {
      const { userId, amount, isBox = false } = data || {};

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      if (typeof amount === "undefined") {
        return res.status(400).json({ success: false, error: "Missing amount" });
      }

      const userIdStr = ensureStringId(userId);

      const result = await supabaseRequest(
        `users?id=eq.${encodeFilterValue(userIdStr)}&select=*`
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
        await supabaseRequest(`users?id=eq.${encodeFilterValue(userIdStr)}`, {
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
        `users?id=eq.${encodeFilterValue(userIdStr)}`,
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
            const inviterRes = await supabaseRequest(`users?id=eq.${encodeFilterValue(ensureStringId(inviterId))}&select=balance`);
            if (inviterRes && inviterRes.length > 0) {
              const inviter = inviterRes[0];
              const inviterBalance = Number(inviter.balance) || 0;
              const inviterNewBalance = inviterBalance + 100;

              // Update inviter balance
              await supabaseRequest(`users?id=eq.${encodeFilterValue(ensureStringId(inviterId))}`, {
                method: "PATCH",
                body: JSON.stringify({ balance: inviterNewBalance })
              });

              // Mark referral as activated on the referred user
              await supabaseRequest(`users?id=eq.${encodeFilterValue(userIdStr)}`, {
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
    // - Exclude tasks that are already completed by this user
    // ===============================
    if (type === "getTasks") {
      const { userId } = data || {};

      // If no userId provided, just return all tasks
      if (!userId) {
        const tasks = await supabaseRequest(`tasks?select=*`);
        return res.status(200).json({ success: true, tasks });
      }

      const userIdStr = ensureStringId(userId);

      // Fetch completed task ids for this user
      const completedRows = await supabaseRequest(
        `user_tasks?user_id=eq.${encodeFilterValue(userIdStr)}&status=eq.completed&select=task_id`
      );

      let completedIds = [];
      if (Array.isArray(completedRows) && completedRows.length > 0) {
        completedIds = completedRows.map(r => String(r.task_id));
      }

      // If no completed ids, return all tasks
      if (completedIds.length === 0) {
        const tasks = await supabaseRequest(`tasks?select=*`);
        return res.status(200).json({ success: true, tasks });
      }

      // Build not.in filter with quoted values
      const quoted = completedIds.map(id => encodeURIComponent(`'${id.replace(/'/g, "''")}'`)).join(',');
      // Compose path carefully: use encodeURI to not over-encode reserved characters like parentheses
      const path = encodeURI(`tasks?select=*&id=not.in.(${completedIds.map(id => `'${id.replace(/'/g, "''")}'`).join(",")})`);

      const tasks = await supabaseRequest(path);
      return res.status(200).json({
        success: true,
        tasks
      });
    }

    // ===============================
    // New: Start Task
    // - Records that a user started a task (status = started)
    // - Does NOT grant any reward
    // - Prevents duplicate entries via server-side unique constraint / pre-check
    // ===============================
    if (type === "startTask") {
      const { userId, taskId } = data || {};

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }
      if (!taskId) {
        return res.status(400).json({ success: false, error: "Missing taskId" });
      }

      const userIdStr = ensureStringId(userId);
      const taskIdStr = ensureStringId(taskId);

      // Check if a record already exists
      const existing = await supabaseRequest(
        `user_tasks?user_id=eq.${encodeFilterValue(userIdStr)}&task_id=eq.${encodeFilterValue(taskIdStr)}&select=*`
      );

      if (existing && existing.length > 0) {
        // If already exists, return current status (started or completed)
        return res.status(200).json({
          success: true,
          message: "Already started or completed",
          status: existing[0].status || "started"
        });
      }

      // Insert new user_tasks row
      const now = new Date().toISOString();
      const newRow = {
        id: randomUUID(),
        user_id: userIdStr,
        task_id: taskIdStr,
        status: "started",
        created_at: now
      };

      const created = await supabaseRequest("user_tasks", {
        method: "POST",
        body: JSON.stringify(newRow)
      });

      return res.status(200).json({
        success: true,
        userTask: Array.isArray(created) ? created[0] : created
      });
    }

    // ===============================
    // New: Complete Task
    // - Verifies the task was started and not already completed
    // - Atomically marks user_task as completed (only if status=started)
    // - Atomically increments user's balance with optimistic conditional updates / retries
    // - Ensures that completing is effective only once
    // ===============================
    if (type === "completeTask") {
      const { userId, taskId } = data || {};

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }
      if (!taskId) {
        return res.status(400).json({ success: false, error: "Missing taskId" });
      }

      const userIdStr = ensureStringId(userId);
      const taskIdStr = ensureStringId(taskId);

      // Fetch user_task row
      const rows = await supabaseRequest(
        `user_tasks?user_id=eq.${encodeFilterValue(userIdStr)}&task_id=eq.${encodeFilterValue(taskIdStr)}&select=*`
      );

      if (!rows || rows.length === 0) {
        return res.status(400).json({ success: false, error: "Task not started or record missing" });
      }

      const userTask = rows[0];

      if (userTask.status === "completed") {
        return res.status(200).json({ success: true, message: "Already completed", alreadyCompleted: true });
      }

      // Fetch task reward
      const tasks = await supabaseRequest(`tasks?id=eq.${encodeFilterValue(taskIdStr)}&select=reward`);
      if (!tasks || tasks.length === 0) {
        return res.status(404).json({ success: false, error: "Task not found" });
      }
      const reward = Number(tasks[0].reward) || 0;

      // 1) Attempt to atomically set user_tasks.status = completed only if currently started
      const patchRes = await supabaseRequest(
        `user_tasks?id=eq.${encodeFilterValue(String(userTask.id))}&status=eq.started`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "completed" })
        }
      );

      // If no rows updated, another process may have completed it already
      if (!patchRes || (Array.isArray(patchRes) && patchRes.length === 0)) {
        return res.status(200).json({ success: true, message: "Already completed or could not mark completed", alreadyCompleted: true });
      }

      // 2) Now credit the user's balance with safe conditional retries to avoid race
      const MAX_RETRIES = 3;
      let attempt = 0;
      let finalBalance = null;
      let credited = false;

      while (attempt < MAX_RETRIES && !credited) {
        attempt++;
        // Read current balance
        const userRows = await supabaseRequest(`users?id=eq.${encodeFilterValue(userIdStr)}&select=balance`);
        if (!userRows || userRows.length === 0) {
          // Try to rollback user_tasks to 'started' to avoid marking completed without credit
          try {
            await supabaseRequest(`user_tasks?id=eq.${encodeFilterValue(String(userTask.id))}`, {
              method: "PATCH",
              body: JSON.stringify({ status: "started" })
            });
          } catch (e) { console.error("Rollback failed:", e); }
          return res.status(404).json({ success: false, error: "User not found while crediting reward" });
        }
        const currentBalance = Number(userRows[0].balance) || 0;
        const newBalance = currentBalance + reward;

        // Try conditional update: only succeed if balance still equals currentBalance
        const updateRes = await supabaseRequest(
          `users?id=eq.${encodeFilterValue(userIdStr)}&balance=eq.${encodeFilterValue(String(currentBalance))}`,
          {
            method: "PATCH",
            body: JSON.stringify({ balance: newBalance })
          }
        );

        if (updateRes && Array.isArray(updateRes) && updateRes.length > 0) {
          finalBalance = newBalance;
          credited = true;
          break;
        }

        // If updateRes is empty, another concurrent update changed balance — retry
      }

      if (!credited) {
        // Could not credit within retries - revert the user_task status to started to keep consistency
        try {
          await supabaseRequest(`user_tasks?id=eq.${encodeFilterValue(String(userTask.id))}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "started" })
          });
        } catch (e) {
          console.error("Failed to revert user_task after credit failure:", e);
        }
        return res.status(500).json({ success: false, error: "Failed to credit reward after multiple attempts" });
      }

      // Success: return new balance
      return res.status(200).json({
        success: true,
        balance: finalBalance,
        taskCompleted: true
      });
    }

    // ===============================
    // Create Withdraw (NEW)
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

      const userIdStr = ensureStringId(userId);

      // Fetch user to verify balance
      const users = await supabaseRequest(`users?id=eq.${encodeFilterValue(userIdStr)}&select=balance`);
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
        user_id: userIdStr,
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
      await supabaseRequest(`users?id=eq.${encodeFilterValue(userIdStr)}`, {
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

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      const userIdStr = ensureStringId(userId);

      // select useful fields
      const rows = await supabaseRequest(
        `withdraw?user_id=eq.${encodeFilterValue(userIdStr)}&select=id,amount,status,destination,created_at,processed_at&order=created_at.desc`
      );

      return res.status(200).json({
        success: true,
        withdraws: Array.isArray(rows) ? rows : []
      });
    }

    // ===============================
    // Get Referrals counts and details for inviter
    // ===============================
    if (type === "getReferrals") {
      const { userId } = data || {};

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      const userIdStr = ensureStringId(userId);

      // Fetch referral rows with useful fields
      const referrals = await supabaseRequest(`users?referrer_id=eq.${encodeFilterValue(userIdStr)}&select=id,name,photo,ads_watched,referral_active`);

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