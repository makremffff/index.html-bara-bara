// ===============================
// Environment Variables
// ===============================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE environment variables.");
}

// Helper: build eq filter safely for Supabase REST queries
function eqFilter(field, value) {
  if (typeof value === "number" || (/^\d+$/.test(String(value)))) {
    return `${field}=eq.${value}`;
  }
  const escaped = String(value).replace(/'/g, "''");
  return `${field}=eq.'${escaped}'`;
}

// ===============================
// Helper: Supabase REST Request
// ===============================
async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL) {
    throw new Error("Supabase URL not configured");
  }

  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  try {
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
  } catch (e) {
    throw new Error(`Supabase request failed (${url}): ${e.message || String(e)}`);
  }
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

      const existing = await supabaseRequest(`users?${eqFilter("id", id)}&select=*`);

      if (!existing || existing.length === 0) {
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

      const user = existing[0];
      if (referrerId && !user.referrer_id && String(user.id) !== String(referrerId)) {
        try {
          await supabaseRequest(`users?${eqFilter("id", id)}`, {
            method: "PATCH",
            body: JSON.stringify({
              referrer_id: referrerId,
              referral_active: false
            })
          });
        } catch (e) {
          console.error("Failed to set referrer id for user:", e);
        }
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
        `users?${eqFilter("id", userId)}&select=balance,ads_watched,daily_ads,last_ad_date,referrer_id,referral_active`
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
    // Reward User -> now calls atomic RPC reward_user
    // ===============================
    if (type === "rewardUser") {
      const { userId, amount } = data || {};

      if (!userId) {
        return res.status(400).json({ success: false, error: "Missing userId" });
      }

      if (typeof amount === "undefined") {
        return res.status(400).json({ success: false, error: "Missing amount" });
      }

      // Call the Postgres function we created: public.reward_user(p_user_id text, p_amount numeric)
      try {
        const rpcPayload = { p_user_id: String(userId), p_amount: Number(amount) };
        const rpcRes = await supabaseRequest(`rpc/reward_user`, {
          method: "POST",
          body: JSON.stringify(rpcPayload)
        });

        // rpcRes should be a JSONB object or array depending on Supabase; normalize to object
        let rpcObj = Array.isArray(rpcRes) && rpcRes.length > 0 ? rpcRes[0] : rpcRes;

        // If rpc returned error structure
        if (!rpcObj || rpcObj.success === false) {
          return res.status(400).json({ success: false, error: rpcObj && rpcObj.error ? rpcObj.error : "Reward failed", details: rpcObj });
        }

        // Return RPC response directly to client
        return res.status(200).json(Object.assign({ success: true }, rpcObj));
      } catch (e) {
        console.error("RPC reward_user failed:", e);
        return res.status(500).json({ success: false, error: "Server failed to reward user", details: e.message || String(e) });
      }
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

      const referrals = await supabaseRequest(`users?${eqFilter("referrer_id", userId)}&select=referral_active`);

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