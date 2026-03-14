// ============================================================
// /api/index.js — Supabase REST API (fetch only, no supabase-js)
// ============================================================
//
// ✅ المرحلة 1 — IDs المستخرجة من index.html:
// -----------------------------------------------
// الصفحات    : #main | #task | #wallet | #game | #refal
// التنقل     : #mainbtn | #taskbtn | #walletbtn
// الإعلانات  : #watch
// المهام     : #taskadd | #createtask | #taskname | #tasklink
// المحفظة    : #faucetmail | #amount | #sendwith
// السجل      : #withdrawhistory | #showhistory
// الإحالة    : #copy
// الصوت      : #audio | #clicksound
// -----------------------------------------------
//
// ✅ المرحلة 3 — الجداول المطلوبة في Supabase:
// -----------------------------------------------
// users           : telegram_id, fullname, photo, balance, ads_count, refal_count
// completed_tasks : userid, task_id
// tasks           : id, userid, taskname, tasklink
// withdrawals     : id, userid, email, amount, status, created_at
// -----------------------------------------------

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ============================================================
// Helper — Supabase REST fetch
// ============================================================
async function supabase(method, table, { query = "", body = null, prefer = "" } = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query ? "?" + query : ""}`;

  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
  };

  if (prefer) headers["Prefer"] = prefer;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);

  // 204 No Content — لا يوجد body
  if (res.status === 204) return { data: null, error: null };

  const json = await res.json();

  if (!res.ok) {
    return { data: null, error: json };
  }

  return { data: json, error: null };
}

// ============================================================
// الأكشنات
// ============================================================

// 1️⃣ تسجيل / تحديث المستخدم
async function registerUser({ userid, fullname, photo }) {
  // Upsert — إذا موجود يحدّث، إذا ما موجود يضيف
  const { data, error } = await supabase(
    "POST",
    "users",
    {
      body: {
        telegram_id: String(userid),
        fullname,
        photo,
        // balance و ads_count و refal_count لا تُعاد كتابتها عند التحديث
      },
      prefer: "resolution=merge-duplicates,return=representation",
    }
  );

  if (error) throw new Error(error.message || "registerUser failed");

  const user = Array.isArray(data) ? data[0] : data;

  return {
    success: true,
    balance: user?.balance ?? 0,
    ads_count: user?.ads_count ?? 0,
    refal_count: user?.refal_count ?? 0,
  };
}

// 2️⃣ إتمام مهمة (+500)
async function completeTask({ userid, taskId }) {
  // تحقق هل أكمل المهمة من قبل
  const { data: existing } = await supabase(
    "GET",
    "completed_tasks",
    { query: `userid=eq.${userid}&task_id=eq.${taskId}` }
  );

  if (existing && existing.length > 0) {
    throw new Error("Task Already Completed");
  }

  // سجّل المهمة المكتملة
  const { error: insertErr } = await supabase(
    "POST",
    "completed_tasks",
    { body: { userid: String(userid), task_id: taskId } }
  );
  if (insertErr) throw new Error("completeTask insert failed");

  // جلب الرصيد الحالي
  const { data: userData } = await supabase(
    "GET",
    "users",
    { query: `telegram_id=eq.${userid}` }
  );
  const currentBalance = userData?.[0]?.balance ?? 0;
  const newBalance = currentBalance + 500;

  // تحديث الرصيد
  const { error: updateErr } = await supabase(
    "PATCH",
    "users",
    {
      query: `telegram_id=eq.${userid}`,
      body: { balance: newBalance },
    }
  );
  if (updateErr) throw new Error("completeTask update balance failed");

  return { success: true, balance: newBalance };
}

// 3️⃣ مشاهدة إعلانات (+100)
async function watchAds({ userid, adsCount }) {
  // جلب البيانات الحالية
  const { data: userData } = await supabase(
    "GET",
    "users",
    { query: `telegram_id=eq.${userid}` }
  );

  const currentBalance  = userData?.[0]?.balance   ?? 0;
  const currentAds      = userData?.[0]?.ads_count  ?? 0;
  const newBalance      = currentBalance + 100;
  const newAdsCount     = currentAds + 1;

  const { error } = await supabase(
    "PATCH",
    "users",
    {
      query: `telegram_id=eq.${userid}`,
      body: { balance: newBalance, ads_count: newAdsCount },
    }
  );
  if (error) throw new Error("watchAds update failed");

  return { success: true, balance: newBalance, ads_count: newAdsCount };
}

// 4️⃣ إنشاء مهمة جديدة
async function createTask({ userid, taskname, tasklink }) {
  if (!taskname || !tasklink) throw new Error("taskname and tasklink are required");

  const { error } = await supabase(
    "POST",
    "tasks",
    {
      body: {
        userid: String(userid),
        taskname,
        tasklink,
      },
    }
  );
  if (error) throw new Error("createTask failed");

  return { success: true };
}

// 5️⃣ طلب سحب
async function withdraw({ userid, email, amount }) {
  const MIN_WITHDRAW = 1000;

  if (!email) throw new Error("FaucetPay email is required");
  if (!amount || amount < MIN_WITHDRAW)
    throw new Error(`Minimum withdrawal is ${MIN_WITHDRAW}`);

  // جلب الرصيد الحالي
  const { data: userData } = await supabase(
    "GET",
    "users",
    { query: `telegram_id=eq.${userid}` }
  );

  const currentBalance = userData?.[0]?.balance ?? 0;

  if (currentBalance < amount) {
    throw new Error("Insufficient balance");
  }

  // إضافة طلب السحب
  const { error: insertErr } = await supabase(
    "POST",
    "withdrawals",
    {
      body: {
        userid: String(userid),
        email,
        amount,
        status: "pending",
      },
    }
  );
  if (insertErr) throw new Error("withdraw insert failed");

  // خصم الرصيد
  const newBalance = currentBalance - amount;

  const { error: updateErr } = await supabase(
    "PATCH",
    "users",
    {
      query: `telegram_id=eq.${userid}`,
      body: { balance: newBalance },
    }
  );
  if (updateErr) throw new Error("withdraw balance deduction failed");

  return { success: true, balance: newBalance };
}

// ============================================================
// Handler الرئيسي — يستقبل كل الطلبات من fetchApi
// ============================================================
module.exports = async function handler(req, res) {

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ success: false, message: "Method Not Allowed" });

  const { type, data } = req.body || {};

  if (!type) {
    return res.status(400).json({ success: false, message: "Missing action type" });
  }

  // ============================
  // راوتر الأكشنات
  // ============================
  const actions = {
    registerUser,
    completeTask,
    watchAds,
    createTask,
    withdraw,
  };

  const action = actions[type];

  if (!action) {
    return res.status(404).json({ success: false, message: `Unknown action: "${type}"` });
  }

  try {
    const result = await action(data || {});
    return res.status(200).json(result);

  } catch (err) {
    console.error(`[API] Action "${type}" error:`, err.message);
    return res.status(400).json({ success: false, message: err.message });
  }
};
