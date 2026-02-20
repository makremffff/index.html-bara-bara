export default async function handler(req, res) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPA_URL || !SUPA_KEY) {
    res.status(500).json({ error: 'Supabase env vars not configured' });
    return;
  }

  const headers = {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // helper: parse pathname
  const fullUrl = new URL(req.url, `https://${req.headers.host || 'example.com'}`);
  const pathname = fullUrl.pathname || req.url || '';
  const method = req.method || 'GET';

  // helper: fetch user by telegram_id
  async function fetchUser(telegram_id) {
    const q = `${SUPA_URL.replace(/\/$/, '')}/rest/v1/users?telegram_id=eq.${encodeURIComponent(telegram_id)}`;
    const r = await fetch(q, { headers });
    if (!r.ok) throw new Error('Supabase fetch user failed: ' + r.status);
    const arr = await r.json();
    return Array.isArray(arr) && arr.length ? arr[0] : null;
  }

  // helper: insert or upsert user
  async function upsertUser(obj) {
    // Use on_conflict to upsert by telegram_id
    const q = `${SUPA_URL.replace(/\/$/, '')}/rest/v1/users?on_conflict=telegram_id`;
    const r = await fetch(q, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation, resolution=merge-duplicates' },
      body: JSON.stringify([obj])
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error('Supabase upsert failed: ' + txt);
    }
    const arr = await r.json();
    return Array.isArray(arr) && arr.length ? arr[0] : null;
  }

  // helper: patch user
  async function patchUser(telegram_id, patchObj) {
    const q = `${SUPA_URL.replace(/\/$/, '')}/rest/v1/users?telegram_id=eq.${encodeURIComponent(telegram_id)}`;
    const r = await fetch(q, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(patchObj)
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error('Supabase patch failed: ' + txt);
    }
    const arr = await r.json();
    return Array.isArray(arr) && arr.length ? arr[0] : null;
  }

  // Route: POST /api/user/init
  if (method === 'POST' && pathname.endsWith('/api/user/init')) {
    try {
      const body = await (req.body ? req.body : req.json ? await req.json() : JSON.parse(await getRawBody(req)));
      const telegram_id = String(body.telegram_id || '');
      if (!telegram_id) {
        res.status(400).json({ error: 'telegram_id required' });
        return;
      }

      // try fetch existing
      let user = await fetchUser(telegram_id);

      const now = new Date();
      const nowIso = now.toISOString();
      const resetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      if (!user) {
        // create new user
        const newUser = {
          telegram_id,
          first_name: body.first_name || '',
          last_name: body.last_name || '',
          username: body.username || '',
          language_code: body.language_code || '',
          is_premium: !!body.is_premium,
          balance: 0,
          daily_count: 0,
          cooldown_until: null,
          daily_reset_at: resetAt,
          last_active_at: nowIso
        };
        const created = await upsertUser(newUser);
        res.status(200).json({ user: created });
        return;
      } else {
        // existing user: if daily_reset_at passed, reset daily_count
        let patch = null;
        if (!user.daily_reset_at || new Date(user.daily_reset_at) <= now) {
          patch = {
            daily_count: 0,
            daily_reset_at: resetAt,
            last_active_at: nowIso
          };
        } else {
          patch = { last_active_at: nowIso };
        }
        // also update profile fields from Telegram if changed
        patch.first_name = body.first_name || user.first_name || '';
        patch.last_name = body.last_name || user.last_name || '';
        patch.username = body.username || user.username || '';
        patch.language_code = body.language_code || user.language_code || '';
        patch.is_premium = !!body.is_premium;

        const updated = await patchUser(telegram_id, patch);
        res.status(200).json({ user: updated });
        return;
      }
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
      return;
    }
  }

  // Route: GET /api/user/:telegram_id
  if (method === 'GET' && pathname.startsWith('/api/user/')) {
    try {
      const parts = pathname.split('/');
      const telegram_id = parts[parts.length - 1];
      if (!telegram_id) {
        res.status(400).json({ error: 'telegram_id required in URL' });
        return;
      }
      const user = await fetchUser(telegram_id);
      if (!user) {
        res.status(404).json({ error: 'user not found' });
        return;
      }
      res.status(200).json({ user });
      return;
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
      return;
    }
  }

  // Route: POST /api/ad/reward
  if (method === 'POST' && pathname.endsWith('/api/ad/reward')) {
    try {
      const body = await (req.body ? req.body : req.json ? await req.json() : JSON.parse(await getRawBody(req)));
      const telegram_id = String(body.telegram_id || '');
      if (!telegram_id) {
        res.status(400).json({ error: 'telegram_id required' });
        return;
      }
      // fetch user
      const user = await fetchUser(telegram_id);
      if (!user) {
        res.status(404).json({ error: 'user not found' });
        return;
      }

      const now = new Date();
      const nowMs = now.getTime();

      // Check cooldown (server enforced) - cooldown_until stored as ISO
      if (user.cooldown_until) {
        const cooldownUntil = new Date(user.cooldown_until).getTime();
        if (nowMs < cooldownUntil) {
          const retryAfter = Math.ceil((cooldownUntil - nowMs) / 1000);
          res.status(429).json({ error: 'Cooldown active', retry_after_seconds: retryAfter });
          return;
        }
      }

      // Check and reset daily_count if necessary
      if (!user.daily_reset_at || new Date(user.daily_reset_at).getTime() <= nowMs) {
        // reset
        user.daily_count = 0;
        user.daily_reset_at = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();
      }

      const DAILY_LIMIT = 100;
      if ((user.daily_count || 0) >= DAILY_LIMIT) {
        res.status(403).json({ error: 'Daily limit reached' });
        return;
      }

      // award +100
      const AWARD = 100;
      const newBalance = (Number(user.balance) || 0) + AWARD;
      const newDailyCount = (Number(user.daily_count) || 0) + 1;
      const newCooldownUntil = new Date(nowMs + 6000).toISOString(); // 6 seconds

      const patchObj = {
        balance: newBalance,
        daily_count: newDailyCount,
        cooldown_until: newCooldownUntil,
        daily_reset_at: user.daily_reset_at || new Date(nowMs + 24 * 60 * 60 * 1000).toISOString(),
        last_active_at: new Date(nowMs).toISOString()
      };

      const updated = await patchUser(telegram_id, patchObj);
      res.status(200).json({ user: updated });
      return;
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
      return;
    }
  }

  // default
  res.status(404).json({ error: 'Not found' });
}

// helper to read raw body if framework doesn't already provide
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on && req.on('data', chunk => data += chunk);
    req.on && req.on('end', () => resolve(data || '{}'));
    req.on && req.on('error', err => reject(err));
    // in some environments, req.body may already be present
    setTimeout(() => {
      if (!req.on) resolve('{}');
    }, 10);
  });
}