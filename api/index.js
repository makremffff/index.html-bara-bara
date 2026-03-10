export default async function handler(req, res) {

try {

if (req.method !== "POST") {
return res.status(405).json({ error: "Method not allowed" });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
return res.status(500).json({
error: "Supabase ENV missing"
});
}

const body =
typeof req.body === "string"
? JSON.parse(req.body)
: req.body;

const { type, data } = body;

const headers = {
apikey: SUPABASE_KEY,
Authorization: `Bearer ${SUPABASE_KEY}`,
"Content-Type": "application/json"
};

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
return res.status(400).json({
error: "Unknown action"
});

}

// =====================
// register user
// =====================

async function registerUser(data){

let r = await fetch(
`${SUPABASE_URL}/rest/v1/users?id=eq.${data.id}`,
{ headers }
);

let users = await r.json();

if(users.length === 0){

await fetch(`${SUPABASE_URL}/rest/v1/users`,{
method:"POST",
headers,
body:JSON.stringify({
id:data.id,
name:data.name,
photo:data.photo,
balance:0
})
});

}

return res.json({success:true});

}

// =====================
// get balance
// =====================

async function getBalance(data){

let r = await fetch(
`${SUPABASE_URL}/rest/v1/users?id=eq.${data.userId}&select=balance`,
{ headers }
);

let result = await r.json();

let balance = result[0]?.balance || 0;

return res.json({
balance
});

}

// =====================
// complete task
// =====================

async function completeTask(data){

let check = await fetch(
`${SUPABASE_URL}/rest/v1/tasks_completed?user_id=eq.${data.userId}&task_id=eq.${data.taskId}`,
{ headers }
);

let exist = await check.json();

if(exist.length > 0){
return res.json({
error:"Task already completed"
});
}

await fetch(`${SUPABASE_URL}/rest/v1/tasks_completed`,{
method:"POST",
headers,
body:JSON.stringify({
user_id:data.userId,
task_id:data.taskId
})
});

let r = await fetch(
`${SUPABASE_URL}/rest/v1/users?id=eq.${data.userId}&select=balance`,
{ headers }
);

let user = await r.json();

let newBalance = (user[0].balance || 0) + 500;

await fetch(
`${SUPABASE_URL}/rest/v1/users?id=eq.${data.userId}`,
{
method:"PATCH",
headers,
body:JSON.stringify({
balance:newBalance
})
}
);

return res.json({
balance:newBalance
});

}

// =====================
// watch ads
// =====================

async function watchAds(data){

let r = await fetch(
`${SUPABASE_URL}/rest/v1/users?id=eq.${data.userId}&select=balance`,
{ headers }
);

let user = await r.json();

let newBalance = (user[0].balance || 0) + 100;

await fetch(
`${SUPABASE_URL}/rest/v1/users?id=eq.${data.userId}`,
{
method:"PATCH",
headers,
body:JSON.stringify({
balance:newBalance
})
}
);

return res.json({
balance:newBalance
});

}

}catch(err){

console.error(err);

return res.status(500).json({
error: err.message
});

}

}