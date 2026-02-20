// REST API بسيط لجلب بيانات تيليجرام وعمل رابط إحالة فريد
// متطلبات:
// - تعيين متغير البيئة BOT_TOKEN (توكن بوت تيليجرام الخاص بك)
// - (اختياري) تعيين REF_BASE_URL لتغيير قاعدة رابط الإحالة (مثال: https://t.me/faucetgame?start=)
// تثبيت الحزم: npm install express node-fetch cors dotenv

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const REF_BASE = process.env.REF_BASE_URL || 'https://t.me/faucetgame?start=';

if (!BOT_TOKEN) {
  console.warn('Warning: BOT_TOKEN is not set in environment variables. /api/user/:id will fail until BOT_TOKEN is provided.');
}

/**
 * Helper: call Telegram getUserProfilePhotos to get file_id of profile photo
 * ثم getFile للحصول على file_path وتحويله إلى رابط ملف جاهز للتحميل
 */
async function getTelegramPhotoUrlByUserId(userId) {
  if (!BOT_TOKEN) throw new Error('BOT_TOKEN not configured');
  const getPhotosUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${encodeURIComponent(userId)}&limit=1`;
  const photosResp = await fetch(getPhotosUrl);
  const photosJson = await photosResp.json();
  if (!photosJson.ok) {
    throw new Error('Telegram getUserProfilePhotos failed: ' + JSON.stringify(photosJson));
  }
  if (!photosJson.result || photosJson.result.total_count === 0) {
    return null; // لا توجد صورة
  }

  // نأخذ أكبر حجم من المصفوفة sizes
  const sizes = photosJson.result.photos[0];
  if (!sizes || sizes.length === 0) return null;

  // اختر آخر عنصر (عادة الأكبر)
  const best = sizes[sizes.length - 1];
  const file_id = best.file_id;

  // اطلب ملف
  const getFileUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(file_id)}`;
  const fileResp = await fetch(getFileUrl);
  const fileJson = await fileResp.json();
  if (!fileJson.ok) {
    throw new Error('Telegram getFile failed: ' + JSON.stringify(fileJson));
  }
  if (!fileJson.result || !fileJson.result.file_path) return null;

  const filePath = fileJson.result.file_path;
  const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
  return fileUrl;
}

// GET /api/user/:id
// يرد: { success: true, telegramId, photoUrl, referralLink }
app.get('/api/user/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Missing user id' });
  }

  try {
    let photoUrl = null;
    try {
      photoUrl = await getTelegramPhotoUrlByUserId(id);
    } catch (err) {
      // نلتقط الخطأ لكن نكمل بإرجاع رابط الإحالة فقط
      console.warn('Error fetching telegram photo:', err.message || err);
    }

    const referralLink = `${REF_BASE}${encodeURIComponent(id)}`;

    return res.json({
      success: true,
      telegramId: id,
      photoUrl: photoUrl, // قد يكون null
      referralLink: referralLink
    });
  } catch (err) {
    console.error('Error in /api/user/:id', err);
    return res.status(500).json({ success: false, error: err.message || 'unknown error' });
  }
});

// GET /api/referral/:id  -> فقط رابط الإحالة
app.get('/api/referral/:id', (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ success: false, error: 'Missing id' });
  return res.json({ success: true, referralLink: `${REF_BASE}${encodeURIComponent(id)}` });
});

app.listen(PORT, () => {
  console.log(`Telegram helper API running on port ${PORT}`);
  if (!BOT_TOKEN) {
    console.log('BOT_TOKEN not set — set BOT_TOKEN in environment variables to enable fetching user photos from Telegram.');
  }
});