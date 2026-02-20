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
        await supabaseRequest("users", {
          method: "POST",
          body: JSON.stringify({
            id,
            name,
            photo,
            balance: 0
          })
        });
      }

      return res.status(200).json({ success: true });
    }

    // ===============================
    // Get Balance
    // ===============================
    if (type === "getBalance") {
      const { userId } = data;

      const result = await supabaseRequest(
        `users?id=eq.${userId}&select=balance`
      );

      const balance = result && result.length > 0 ? result[0].balance : 0;

      return res.status(200).json({ success: true, balance });
    }

    // ===============================
    // Reward User
    // ===============================
    if (type === "rewardUser") {
      const { userId, amount } = data;

      const result = await supabaseRequest(
        `users?id=eq.${userId}&select=balance`
      );

      if (!result || result.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const newBalance = result[0].balance + amount;

      await supabaseRequest(
        `users?id=eq.${userId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ balance: newBalance })
        }
      );

      return res.status(200).json({ success: true, balance: newBalance });
    }

    // ===============================
    // Create Task
    // ===============================
    if (type === "createTask") {
      const { name, link } = data;

      const created = await supabaseRequest("tasks", {
        method: "POST",
        body: JSON.stringify({
          name,
          link,
          reward: 30
        })
      });

      return res.status(200).json({ success: true, task: created });
    }

    // ===============================
    // Unknown Action
    // ===============================
    return res.status(400).json({ success: false, error: "Invalid action type" });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}