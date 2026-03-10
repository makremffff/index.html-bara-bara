export default async function handler(req, res) {

if (req.method !== "POST") {
return res.status(405).json({ error: "Method Not Allowed" });
}

try {

const { type, data } = req.body;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const headers = {
"Content-Type": "application/json",
"apikey": SUPABASE_KEY,
"Authorization": `Bearer ${SUPABASE_KEY}`
};

// ======================
// CREATE TASK
// ======================

if (type === "createTask") {

const response = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
method: "POST",
headers,
body: JSON.stringify({
name: data.name,
link: data.link,
user_id: data.user,
reward: 500
})
});

if (!response.ok) {
throw new Error("Create Task Failed");
}

return res.status(200).json({ success: true });

}

// ======================
// COMPLETE TASK
// ======================

if (type === "completeTask") {

const response = await fetch(`${SUPABASE_URL}/rest/v1/completed_tasks`, {
method: "POST",
headers,
body: JSON.stringify({
user_id: data.user,
task_id: data.task,
reward: 500
})
});

if (!response.ok) {
throw new Error("Task Complete Failed");
}

return res.status(200).json({ success: true });

}

// ======================
// ADS REWARD
// ======================

if (type === "adsReward") {

const response = await fetch(`${SUPABASE_URL}/rest/v1/ads_rewards`, {
method: "POST",
headers,
body: JSON.stringify({
user_id: data.user,
reward: data.reward
})
});

if (!response.ok) {
throw new Error("Ads Reward Failed");
}

return res.status(200).json({ success: true });

}

// ======================
// UNKNOWN ACTION
// ======================

return res.status(400).json({
error: "Unknown Action"
});

} catch (err) {

console.error(err);

return res.status(500).json({
error: "Server Error"
});

}

}