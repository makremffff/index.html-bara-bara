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
    // Reward User (Save Balance + Ads) and handle referral activation
    //    - Referral activation MUST be performed atomically (single transaction)
    //    - We call a Postgres RPC function `activate_referral` which must exist
    //      and perform the following in a single DB transaction:
    //        * verify referred user's referrer_id matches inviter_id
    //        * verify referral_active is false
    //        * verify referred user's ads_watched >= threshold (10)
    //        * update inviter's balance (e.g., +100)
    //        * set referred user's referral_active = true
    //      The RPC prevents duplicate rewards and ensures both updates succeed or fail together.
    //    - If RPC is not available or fails, we will NOT attempt a non-atomic fallback reward (fail-safe).
    // ===============================
    if (type === "rewardUser") {
      const { userId, amount } = data || {};

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
      const today = new Date().toISOString().split("T")[0];

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

      // Update the user's balance and ad counters
      const updatedUser = await supabaseRequest(
        `users?id=eq.${userId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            balance: newBalance,
            ads_watched: newAdsWatched,
            daily_ads: newDailyAds,
            last_ad_date: today
          })
        }
      );

      // Check referral activation: if the user was referred and not already activated, and has reached 10 watched ads
      let referralActivated = false;
      let inviterRewarded = false;
      let inviterId = user.referrer_id || null;
      let inviterNewBalance = null;

      if (inviterId && !user.referral_active) {
        // Verify inviter actually exists in the database before attempting activation
        try {
          const inviterCheck = await supabaseRequest(`users?id=eq.${inviterId}&select=id,balance`);
          if (!inviterCheck || inviterCheck.length === 0) {
            // Inviter not found; do not attempt activation
            inviterId = null;
          }
        } catch (e) {
          // If the existence check fails for any reason, null out inviterId to avoid unsafe operations
          console.error("Inviter existence check failed:", e);
          inviterId = null;
        }
      } else {
        // No inviter or already active — skip activation
        inviterId = null;
      }

      // Only attempt RPC-based atomic activation if inviterId is valid and threshold reached
      if (inviterId && newAdsWatched >= 10) {
        try {
          // Call a Postgres RPC function that must be defined in the Supabase database:
          // Example signature expected:
          //   activate_referral(inviter_id uuid/text, referred_id uuid/text, reward integer)
          // The function should run in a single transaction, return a record describing the outcome,
          // and ensure the inviter is rewarded only once.
          const rpcPayload = {
            inviter_id: inviterId,
            referred_id: userId,
            reward: 100
          };

          const rpcResult = await supabaseRequest(`rpc/activate_referral`, {
            method: "POST",
            body: JSON.stringify(rpcPayload)
          });

          // Interpret rpcResult robustly: it may be an array or object depending on function
          let rpcResp = null;
          if (Array.isArray(rpcResult) && rpcResult.length > 0) rpcResp = rpcResult[0];
          else rpcResp = rpcResult;

          // Expect the RPC to explicitly indicate whether it performed the reward/activation.
          // For example: { activated: true, inviter_new_balance: 123 }
          if (rpcResp && (rpcResp.activated === true || rpcResp.rewarded === true || rpcResp.inviter_new_balance)) {
            referralActivated = !!(rpcResp.activated || rpcResp.rewarded);
            inviterRewarded = !!(rpcResp.rewarded || rpcResp.activated);
            inviterNewBalance = rpcResp.inviter_new_balance || null;
          } else {
            // If RPC didn't return explicit success, but returned something, try to infer:
            // If rpcResp has any keys, consider success as long as referral_active was set server-side.
            // This is conservative — we'll check referred user's referral_active to confirm.
            try {
              const referredRefetch = await supabaseRequest(`users?id=eq.${userId}&select=referral_active`);
              if (referredRefetch && referredRefetch.length > 0 && referredRefetch[0].referral_active) {
                referralActivated = true;
                inviterRewarded = true;
              }
            } catch (e) {
              // ignore
            }
          }
        } catch (e) {
          // If RPC call failed, we must NOT perform a non-atomic fallback that could double-reward.
          // Log and continue without rewarding the inviter. This is the safe option.
          console.error("Atomic referral activation RPC failed:", e);
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
        inviterNewBalance: inviterNewBalance
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