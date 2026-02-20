// api/index.js

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const BASE_URL = `${SUPABASE_URL}/rest/v1`;

async function supabaseFetch(endpoint, options = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    ...options,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText);
  }

  return res.status !== 204 ? res.json() : null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { action, data } = req.body;

    switch (action) {

      // ==========================================
      // 1️⃣ تسجيل مستخدم جديد أو إرجاعه إن وجد
      // ==========================================
      case "checkOrCreateUser": {
        const { telegram_id, first_name } = data;

        // نبحث عن المستخدم
        const existing = await supabaseFetch(
          `/users?telegram_id=eq.${telegram_id}&select=*`
        );

        if (existing.length > 0) {
          return res.json({ user: existing[0] });
        }

        // إنشاء مستخدم جديد
        const created = await supabaseFetch(`/users`, {
          method: "POST",
          body: JSON.stringify({
            telegram_id,
            first_name,
            balance: 0,
          }),
        });

        return res.json({ user: created[0] });
      }

      // ==========================================
      // 2️⃣ جلب بيانات مستخدم
      // ==========================================
      case "getUser": {
        const { telegram_id } = data;

        const user = await supabaseFetch(
          `/users?telegram_id=eq.${telegram_id}&select=*`
        );

        return res.json({ user: user[0] || null });
      }

      // ==========================================
      // 3️⃣ زيادة الرصيد بعد مشاهدة إعلان
      // ==========================================
      case "addBalance": {
        const { telegram_id, amount } = data;

        // نجلب المستخدم
        const user = await supabaseFetch(
          `/users?telegram_id=eq.${telegram_id}&select=*`
        );

        if (!user.length) {
          return res.status(404).json({ error: "User not found" });
        }

        const newBalance = user[0].balance + amount;

        // تحديث الرصيد
        const updated = await supabaseFetch(
          `/users?telegram_id=eq.${telegram_id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ balance: newBalance }),
          }
        );

        return res.json({ balance: updated[0].balance });
      }

      // ==========================================
      // 4️⃣ إنشاء مهمة
      // ==========================================
      case "createTask": {
        const { title, link, reward } = data;

        const task = await supabaseFetch(`/tasks`, {
          method: "POST",
          body: JSON.stringify({
            title,
            link,
            reward,
          }),
        });

        return res.json({ task: task[0] });
      }

      // ==========================================
      // 5️⃣ جلب المهام
      // ==========================================
      case "getTasks": {
        const tasks = await supabaseFetch(`/tasks?select=*`);

        return res.json({ tasks });
      }

      default:
        return res.status(400).json({ error: "Invalid action" });
    }

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}