export default async function handler(req, res) {

try {

if (req.method !== "POST") {
return res.status(405).json({ error: "Method not allowed" });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if(!SUPABASE_URL || !SUPABASE_KEY){
return res.status(500).json({ error:"Supabase ENV missing"});
}

const body = typeof req.body === "string"
? JSON.parse(req.body)
: req.body;

const { type, data } = body;

const headers = {
apikey: SUPABASE_KEY,
Authorization: `Bearer ${SUPABASE_KEY}`,
"Content-Type": "application/json"
};

if(type === "registerUser"){

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

if(type === "getBalance"){

let r = await fetch(
`${SUPABASE_URL}/rest/v1/users?id=eq.${data.userId}&select=balance`,
{ headers }
);

let user = await r.json();

return res.json({
balance:user[0]?.balance || 0
});

}

return res.json({success:true});

}catch(err){

console.error("API ERROR:",err);

return res.status(500).json({
error:err.message
});

}

}