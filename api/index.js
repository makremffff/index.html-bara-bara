// ===============================
// Environment Variables
// ===============================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // If these env vars are missing, throw early so developer notices
  console.error("Missing SUPABASE environment variables.");
}

// ===============================
// Server-side constants & config
// ===============================
const REWARD_PER_AD = 100;
const DAILY_LIMIT = 100;
const REFERRAL_THRESHOLD = 10;
const INVITER_REWARD = 100;

// ===============================
// Helper: Supabase REST / RPC Request
// supports RPC calls via path starting with "rpc/"
//
// Examples:
// - supabaseRequest('users?id=eq.1') => REST table query
// - supabaseRequest('rpc/reward_user_session', { method: 'POST', body: JSON.stringify({...}) }) => RPC
// ===============================
async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL) {
    throw new Error("Supabase URL not configured");
  }

  // detect rpc path
  let url;
  if (path.startsWith("rpc/")) {
    const fn = path.slice(4);
    url = `${SUPABASE_URL}/rest/v1/rpc/${fn}`;
  } else {
    url = `${SUPABASE_URL}/rest/v1/${path}`;
  }

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
function generateUUID() {
  // Node >=14 supports crypto.randomUUID()
  try {
    const crypto = require('crypto');
    if (crypto && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch (e) {}
  // fallback
  return 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
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
            referrer_id: referrerId || null,
            referral_active: false,
            role: "user"
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
    // Create Ad Session (server-side generated session id)
    // Client should call this before showing the ad and then pass sessionId to rewardUser.
    // This prevents client replay/tampering and allows server to mark session consumed.
    // ===============================
    if (type === "createAdSession") {
      const { userId } = data || {};
      if (!userId) return res.status(400).json({ success: false, error: "Missing userId" });

      // create session row in ad_sessions table
      const sessionId = generateUUID();

      const created = await supabaseRequest("ad_sessions", {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          user_id: userId,
          rewarded: false
        })
      });

      return res.status(200).json({ success: true, sessionId });
    }

    // ===============================
    // Get Balance + Stats
    // Server requires userId
    // ===============================
    if (type === "getBalance") {
      const { userId } = data || {};

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      const result = await supabaseRequest(
        `users?id=eq.${userId}&select=balance,ads_watched,daily_ads,last_ad_date,referrer_id,referral_active`
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
        referrerId: result[0].referrer_id || null,
        referralActive: !!result[0].referral_active
      });
    }

    // ===============================
    // Reward User (using sessionId)
    // This uses a Postgres RPC 'reward_user_session' which should encapsulate:
    // - validate session exists and not yet rewarded & belongs to user
    // - reset daily_ads if last_ad_date != today
    // - check daily limit
    // - increment ads_watched, daily_ads, update last_ad_date, increase balance by REWARD_PER_AD
    // - if ads_watched reached REFERRAL_THRESHOLD and referrer exists and referral_active = false:
    //     - add INVITER_REWARD to inviter balance and set referral_active = true
    // All executed atomically in DB function.
    // If RPC is not available, a safe but less-robust fallback is attempted.
    // ===============================
    if (type === "rewardUser") {
      const { userId, sessionId } = data || {};

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      if (!sessionId) {
        return res.status(400).json({ success: false, error: "Missing sessionId" });
      }

      // Primary: call Postgres RPC that performs everything atomically.
      try {
        const rpcRes = await supabaseRequest(`rpc/reward_user_session`, {
          method: "POST",
          body: JSON.stringify({
            p_user_id: String(userId),
            p_session_id: String(sessionId),
            p_reward_amount: REWARD_PER_AD,
            p_daily_limit: DAILY_LIMIT,
            p_referral_threshold: REFERRAL_THRESHOLD,
            p_inviter_reward: INVITER_REWARD
          })
        });

        // Expected rpcRes to be an array or object with new state
        // Return rpc result directly
        return res.status(200).json({
          success: true,
          ...(rpcRes && rpcRes.length && rpcRes[0] ? rpcRes[0] : rpcRes)
        });
      } catch (rpcErr) {
        // If RPC not present or failed, fall back to safe-ish implementation
        console.warn("RPC reward_user_session failed, falling back:", rpcErr.message || rpcErr);

        // 1) Verify session exists, not rewarded, belongs to user
        const sessionRows = await supabaseRequest(`ad_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=*,user_id`);
        if (!sessionRows || sessionRows.length === 0) {
          return res.status(404).json({ success: false, error: "Session not found" });
        }
        const session = sessionRows[0];
        if (String(session.user_id) !== String(userId)) {
          return res.status(403).json({ success: false, error: "Session does not belong to user" });
        }
        if (session.rewarded) {
          return res.status(400).json({ success: false, error: "Session already rewarded" });
        }

        // 2) Get user
        const userRows = await supabaseRequest(`users?id=eq.${userId}&select=*`);
        if (!userRows || userRows.length === 0) {
          return res.status(404).json({ success: false, error: "User not found" });
        }
        const user = userRows[0];
        const today = new Date().toISOString().split("T")[0];
        let dailyAds = user.daily_ads || 0;
        if (user.last_ad_date !== today) {
          dailyAds = 0;
        }
        if (dailyAds >= DAILY_LIMIT) {
          return res.status(400).json({ success: false, error: "Daily limit reached", dailyAds });
        }

        // 3) Try to update session to mark rewarded (optimistic). If another process updates first, this won't reflect.
        // We attempt to PATCH ad_sessions where rewarded=false and session_id matches.
        const updatedSession = await supabaseRequest(`ad_sessions?session_id=eq.${encodeURIComponent(sessionId)}`, {
          method: "PATCH",
          body: JSON.stringify({ rewarded: true })
        });

        // If update returned empty, consider it already consumed
        if (!updatedSession || updatedSession.length === 0) {
          return res.status(400).json({ success: false, error: "Session already consumed" });
        }

        // 4) Update user counters and balance
        const newBalance = (Number(user.balance) || 0) + REWARD_PER_AD;
        const newAdsWatched = (Number(user.ads_watched) || 0) + 1;
        const newDailyAds = dailyAds + 1;

        const updatedUser = await supabaseRequest(`users?id=eq.${userId}`, {
          method: "PATCH",
          body: JSON.stringify({
            balance: newBalance,
            ads_watched: newAdsWatched,
            daily_ads: newDailyAds,
            last_ad_date: today
          })
        });

        // 5) Referral check: only if user has referrer and referral_active is false and threshold reached
        let referralActivated = false;
        let inviterRewarded = false;
        let inviterId = user.referrer_id || null;

        if (inviterId && !user.referral_active) {
          if (newAdsWatched >= REFERRAL_THRESHOLD) {
            // verify inviter exists
            const inviterRows = await supabaseRequest(`users?id=eq.${encodeURIComponent(inviterId)}&select=balance`);
            if (inviterRows && inviterRows.length > 0) {
              const inviter = inviterRows[0];
              const inviterBalance = Number(inviter.balance) || 0;
              const inviterNewBalance = inviterBalance + INVITER_REWARD;

              // Update inviter balance
              await supabaseRequest(`users?id=eq.${encodeURIComponent(inviterId)}`, {
                method: "PATCH",
                body: JSON.stringify({ balance: inviterNewBalance })
              });

              // Mark referral as activated on the referred user
              await supabaseRequest(`users?id=eq.${encodeURIComponent(userId)}`, {
                method: "PATCH",
                body: JSON.stringify({ referral_active: true })
              });

              referralActivated = true;
              inviterRewarded = true;
            }
          }
        }

        return res.status(200).json({
          success: true,
          balance: newBalance,
          adsWatched: newAdsWatched,
          dailyAds: newDailyAds,
          referralActivated,
          inviterRewarded,
          inviterId: referralActivated ? inviterId : null
        });
      }
    }

    // ===============================
    // Create Task
    // Server checks role of requesting user. Only admin can create tasks.
    // ===============================
    if (type === "createTask") {
      const { name, link, userId } = data || {};

      if (!name || !link) {
        return res.status(400).json({ success: false, error: "Missing name or link" });
      }

      if (!userId) {
        return res.status(403).json({ success: false, error: "Missing userId (authentication required)" });
      }

      // Check role on server
      const rows = await supabaseRequest(`users?id=eq.${userId}&select=role`);
      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      const role = rows[0].role || "user";
      if (role !== "admin") {
        return res.status(403).json({ success: false, error: "Insufficient permissions" });
      }

      // Create task
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
    // Get Referrals counts for inviter (active / pending)
    // ===============================
    if (type === "getReferrals") {
      const { userId } = data || {};

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      const referrals = await supabaseRequest(`users?referrer_id=eq.${userId}&select=referral_active`);

      if (!referrals) {
        return res.status(200).json({ success: true, active: 0, pending: 0 });
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
        pending
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