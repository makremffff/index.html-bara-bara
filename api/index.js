export default async function handler(req, res) {

if (req.method !== "POST") {
return res.status(405).json({ error: "Method Not Allowed" });
}

const { type, data } = req.body;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const headers = {
apikey: SUPABASE_KEY,
Authorization: `Bearer ${SUPABASE_KEY}`,
"Content-Type": "application/json"
};

try {

switch (type) {

case "registerUser":
return registerUser(data);

case "getBalance":
return getBalance(data);

case "completeTask":
return completeTask(data);

case "watchAds":
return watchAds(data);

default:
return res.status(400).json({ error: "Unknown action" });

}

} catch (err) {

console.error(err);

return res.status(500).json({
error: "Server Error"
});

}

// =========================
// تسجيل مستخدم
// =========================

async function registerUser(data) {

let r = await fetch(
`${SUPABASE_URL}/rest/v1/users?id=eq.${data.id}`,
{ headers }
);

let users = await r.json();

if (users.length === 0) {

await fetch(`${SUPABASE_URL}/rest/v1/users`, {
method: "POST",
headers,
body: JSON.stringify({
id: data.id,
name: data.name,
photo: data.photo,
balance: 0
})
});

}

return res.json({ success: true });

}

// =========================
// جلب الرصيد
// =========================

async function getBalance(data) {

let r = await fetch(
`${SUPABASE_URL}/rest/v1/users?id=eq.${data.userId}&select=balance`,
{ headers }
);

let result = await r.json();

let balance = result[0]?.balance || 0;

return res.json({
balance: balance
});

}

// =========================
// إكمال مهمة
// =========================

async function completeTask(data) {

let check = await fetch(
`${SUPABASE_URL}/rest/v1/tasks_completed?user_id=eq.${data.userId}&task_id=eq.${data.taskId}`,
{ headers }
);

let exist = await check.json();

if (exist.length > 0) {

return res.json({
error: "Task already completed"
});

}

await fetch(`${SUPABASE_URL}/rest/v1/tasks_completed`, {
method: "POST",
headers,
body: JSON.stringify({
user_id: data.userId,
task_id: data.taskId
})
});

let userReq = await fetch(
`${SUPABASE_URL}/rest/v1/users?id=eq.${data.userId}&select=balance`,
{ headers }
);

let userData = await userReq.json();

let newBalance = (userData[0].balance || 0) + 500;

await fetch(
`${SUPABASE_URL}/rest/v1/users?id=eq.${data.userId}`,
{
method: "PATCH",
headers,
body: JSON.stringify({
balance: newBalance
})
}
);

return res.json({
balance: newBalance
});

}

// =========================
// مشاهدة إعلان
// =========================

async function watchAds(data) {

let reward = 100;

let userReq = await fetch(
`${SUPABASE_URL}/rest/v1/users?id=eq.${data.userId}&select=balance`,
{ headers }
);

let userData = await userReq.json();

let newBalance = (userData[0].balance || 0) + reward;

await fetch(
`${SUPABASE_URL}/rest/v1/users?id=eq.${data.userId}`,
{
method: "PATCH",
headers,
body: JSON.stringify({
balance: newBalance
})
}
);

return res.json({
balance: newBalance
});

}

}