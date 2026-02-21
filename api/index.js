// ===============================
// Environment Variables
// ===============================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ===============================
// Helper: Supabase REST Request
// ===============================
async function supabaseRequest(path, options = {}) {
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
    throw new Error(errorText);
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

  const { type, data } = req.body;

  try {

    // ===============================
    // Sync User
    // ===============================
    if (type === "syncUser") {
      const { id, name, photo } = data;

      const existing = await supabaseRequest(
        `users?id=eq.${id}&select=id`
      );

      if (!existing || existing.length === 0) {
        const today = new Date().toISOString().split("T")[0];
        
        await supabaseRequest("users", {
          method: "POST",
          body: JSON.stringify({
            id,
            name,
            photo,
            balance: 0,
            ads_watched: 0,
            daily_ads: 0,
            last_ad_date: today
          })
        });
      }

      return res.status(200).json({ success: true });
    }

    // ===============================
    // Get Balance + Stats
    // ===============================
    if (type === "getBalance") {
      const { userId } = data;

      const result = await supabaseRequest(
        `users?id=eq.${userId}&select=balance,ads_watched,daily_ads,last_ad_date`
      );

      if (!result || result.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const today = new Date().toISOString().split("T")[0];
      let dailyAds = result[0].daily_ads;

      // إعادة تعيين الأعلانات اليومية إذا تغير اليوم
      if (result[0].last_ad_date !== today) {
        dailyAds = 0;
      }

      return res.status(200).json({
        success: true,
        balance: result[0].balance,
        adsWatched: result[0].ads_watched,
        dailyAds: dailyAds,
        lastAdDate: result[0].last_ad_date
      });
    }

    // ===============================
    // Reward User (Save Balance + Ads)
    // ===============================
    if (type === "rewardUser") {
      const { userId, amount } = data;

      if (!userId) {
        return res.status(400).json({ success: false, error: "User ID is required" });
      }

      const result = await supabaseRequest(
        `users?id=eq.${userId}&select=*`
      );

      if (!result || result.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      let user = result[0];
      const today = new Date().toISOString().split("T")[0];

      let dailyAds = user.daily_ads;
      if (user.last_ad_date !== today) {
        dailyAds = 0;
      }

      const DAILY_LIMIT = 100;

      if (dailyAds >= DAILY_LIMIT) {
        return res.status(400).json({
          success: false,
          error: "Daily limit reached",
          dailyAds: dailyAds,
          limit: DAILY_LIMIT
        });
      }

      const newBalance = user.balance + amount;
      const newAdsWatched = user.ads_watched + 1;
      const newDailyAds = dailyAds + 1;

      const updateResult = await supabaseRequest(
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

      return res.status(200).json({
        success: true,
        balance: newBalance,
        adsWatched: newAdsWatched,
        dailyAds: newDailyAds,
        lastAdDate: today
      });
    }

    // ===============================
    // Create Task
    // ===============================
    if (type === "createTask") {
      const { name, link } = data;

      if (!name || !link) {
        return res.status(400).json({ success: false, error: "Name and link are required" });
      }

      const created = await supabaseRequest("tasks", {
        method: "POST",
        body: JSON.stringify({
          name,
          link,
          reward: 30,
          created_at: new Date().toISOString()
        })
      });

      return res.status(200).json({
        success: true,
        task: created[0] || created
      });
    }

    // ===============================
    // Get Tasks
    // ===============================
    if (type === "getTasks") {
      const tasks = await supabaseRequest(
        `tasks?select=*&order=created_at.desc`
      );

      return res.status(200).json({
        success: true,
        tasks: tasks || []
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
    console.error("API Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}