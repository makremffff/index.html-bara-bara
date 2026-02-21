/* =======================
   أزرار التنقّل
======================= */
let btnMain   = document.querySelector("button");
let btnTask   = document.getElementById("btn2");
let btnWallet = document.getElementById("btn3");
let btnshare  = document.getElementById("sharebtn");
let bntaddTask = document.getElementById("addtask");

/* =======================
   الصفحات
======================= */
let mainPage    = document.getElementById("main");
let taskPage    = document.getElementById("task");
let walletPage  = document.getElementById("wallet");
let sharePage   = document.getElementById("share");
let addTaskpage = document.getElementById("addTask");

/* =======================
   شاشة التحميل + اسم الصفحة
======================= */
let loadpage = document.getElementById("loading");
let pagename = document.getElementById("page-load");

let userBalanceEl = document.querySelector('.user-balance'); // عنصر عرض رصيد المستخدم (الصفحة الرئيسية إن وجد)
let walletBalanceEl = document.getElementById("adsbalancce"); // عنصر المحفظة
let adsBalanceEl = document.getElementById("adsbalance"); // عنصر آخر لعرض الرصيد إن وجد
let adsNotfi   = document.getElementById("adsnotifi");
let progres = document.getElementById("progres");
let barbtn = document.querySelector(".bar");

/* =======================
   الأصوات
======================= */
let soundbtn  = document.getElementById("soundbtn");
let soundads  = document.getElementById("soundads");

/* =======================
   API CENTRAL HANDLER
   - يرسل userId من localStorage تلقائياً
======================= */
const API_ENDPOINT = "/api";

const state = {
  userId: null,
  balance: null,   // null يعني لم يُحمّل بعد
  dailyAds: null
};

function getStoredUserId() {
  try {
    return localStorage.getItem("tg_user_id");
  } catch (e) {
    return null;
  }
}

function setStoredUserId(id) {
  try {
    if (id != null) localStorage.setItem("tg_user_id", String(id));
  } catch (e) {}
}

async function fetchApi({ type, data = {} }) {
  try {
    // attach userId automatically when available and not explicitly provided
    const stored = getStoredUserId();
    if (stored && !data.userId) {
      data.userId = stored;
    } else if (state.userId && !data.userId) {
      data.userId = state.userId;
    }

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data })
    });

    const result = await response.json();

    if (!response.ok) {
      // Normalize error shape
      return { success: false, error: result.error || result || "Network response was not ok" };
    }

    return result;

  } catch (error) {
    console.error("API Error:", error);
    return { success: false, error: error.message || String(error) };
  }
}

/* =======================
   AdsGram SDK Initialization
======================= */
let AdsGramController = null;

if (window.Adsgram && typeof window.Adsgram.init === "function") {
  AdsGramController = window.Adsgram.init({ blockId: "int-20679" });
}

/* =======================
   دالة إخفاء كل الصفحات
   (تحافظ على الميزات كما هي)
======================= */
function showPage(btnpage) {

  mainPage.style.display    = "none";
  taskPage.style.display    = "none";
  walletPage.style.display  = "none";
  sharePage.style.display   = "none";
  addTaskpage.style.display = "none";

  btnpage.style.display = "block";

  loadpage.style.display = "block";
  pagename.textContent = "Loading";
  barbtn.style.display = 'none';

  setTimeout(function(){
    barbtn.style.display = 'block';
  }, 2000);

  if (soundbtn) {
    try {
      soundbtn.currentTime = 0;
      soundbtn.play();
    } catch (e) {}
  }

  setTimeout(function () {
    loadpage.style.display = "none";
  }, 2000);
}

/* =======================
   Utility: تحديث نص الرصيد دون innerHTML
   - استخدام textContent فقط
   - لا تضيف عناصر HTML جديدة
   - لا تغير بنية DOM
   - إذا كان عنصر الرصيد يحتوي على عقدة نصية موجودة نحدثها، أما إن لم تكن موجودة فسنجري تعيين نصي (fallback)
======================= */
function setBalanceText(el, value) {
  if (!el) return;

  // حاول إيجاد عنصر داخلي مخصص لقيمة الرصيد
  const candidateSelectors = [
    '[data-balance-value]',
    '.balance-value',
    '.ads-value',
    '.user-balance-value'
  ];

  for (let sel of candidateSelectors) {
    const child = el.querySelector && el.querySelector(sel);
    if (child) {
      child.textContent = String(value);
      return;
    }
  }

  // إذا وُجدت عقدة نصية (Text node) داخل العنصر عدّلها بدلاً من استبدال الـ innerHTML
  const textNode = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
  if (textNode) {
    // حافظ إن كان هناك ثوابت نصية قبل/بعد، فنحدث قيمة العقدة النصية فقط
    textNode.nodeValue = ' ' + String(value);
    return;
  }

  // كملاذ أخير: حدّث textContent (هذا قد يستبدل المحتوى الموجود)
  // نستخدمه كخيار أخير لأن بعض الشاشات قد لا تحتوي نصاً افتراضياً، وفي هذه الحالة نحتاج لعرض القيمة.
  el.textContent = String(value);
}

/* =======================
   دالة موحدة لتحديث واجهة الرصيد
   - اسم الدالة ثابت كما طُلِب: updateBalanceUI(balance, dailyAds)
   - لا تستخدم innerHTML لتحديث الرصيد
   - تُحدّث جميع العناصر المتعلقة بالرصيد
======================= */
function updateBalanceUI(balance, dailyAds) {
  // حفظ الحالة محلياً
  state.balance = (typeof balance === "number") ? balance : Number(balance) || 0;
  state.dailyAds = (typeof dailyAds === "number") ? dailyAds : (dailyAds != null ? Number(dailyAds) : state.dailyAds);

  // تحديث كل عناصر الواجهة التي تعرض الرصيد
  // لا تضف صور عبر JS؛ لا تستخدم innerHTML هنا
  setBalanceText(userBalanceEl, state.balance);
  setBalanceText(walletBalanceEl, state.balance);
  setBalanceText(adsBalanceEl, state.balance);

  // تحديث عنصر التقدّم اليومي إن وجد
  if (progres) {
    const DAILY_LIMIT = 100;
    let remaining = DAILY_LIMIT - (Number(state.dailyAds) || 0);
    if (remaining < 0) remaining = 0;
    progres.textContent = String(remaining);
  }
}

/* =======================
   ربط الأزرار بالصفحات
======================= */
if (btnMain) {
  btnMain.addEventListener("click", function () {
    showPage(mainPage);
  });
}

if (btnTask) {
  btnTask.addEventListener("click", function () {
    showPage(taskPage);
  });
}

if (btnWallet) {
  btnWallet.addEventListener("click", async function () {
    showPage(walletPage);

    // مباشرة استدعاء getBalance وتحديث الواجهة عبر الدالة الموحدة
    const res = await fetchApi({ type: "getBalance" });

    if (res.success) {
      updateBalanceUI(Number(res.balance) || 0, res.dailyAds);
    } else {
      console.warn("getBalance failed:", res.error);
    }
  });
}

if (btnshare) {
  btnshare.addEventListener("click",function(){
    showPage(sharePage);
  });
}

if (bntaddTask) {
  bntaddTask.addEventListener('click',function(){
    showPage(addTaskpage);
  });
}

/* =======================
   أزرار الإعلانات + الرصيد
   - المحافظة على المنطق الحالي، مع استخدام updateBalanceUI
   - إزالة المتغيرات المتضاربة (مثل ADS)
======================= */
const adsBtn     = document.getElementById("adsbtn");
const adsBtnn    = document.getElementById("adsbtnn");

let timer = null;
let dailyLimit = null;
let dailyProgres = 100;
let progresLimit = 24 * 60 * 60;

let adCooldown = false;
let adCooldownTime = 6000;

function showSingleAd() {
  return new Promise((resolve) => {

    if (adCooldown) {
      resolve(false);
      return;
    }

    adCooldown = true;

    if (AdsGramController && typeof AdsGramController.show === "function") {
      AdsGramController.show()
        .then(() => {
          setTimeout(function(){
            adCooldown = false;
            resolve(true);
          }, adCooldownTime);
        })
        .catch(() => {
          adCooldown = false;
          resolve(false);
        });
    } else {
      setTimeout(function(){
        setTimeout(function(){
          adCooldown = false;
        }, adCooldownTime);
        resolve(true);
      }, 2000);
    }
  });
}

if (adsBtn) {
  adsBtn.addEventListener("click", async function () {

    if (adCooldown) return;

    adsBtn.style.display  = "none";
    if (adsBtnn) adsBtnn.style.display = "block";

    let timeLeft = 50;
    if (adsBtnn) adsBtnn.textContent = timeLeft + "s";

    timer = setInterval(async function () {
      timeLeft--;
      if (adsBtnn) adsBtnn.textContent = timeLeft + "s";

      if (timeLeft <= 0) {

        // Reward user (userId attached automatically via fetchApi)
        const res = await fetchApi({
          type: "rewardUser",
          data: { amount: 100 }
        });

        if (res.success) {
          // Server returned balance/dailyAds — استخدم الدالة الموحدة
          updateBalanceUI(Number(res.balance) || state.balance || 0, res.dailyAds);
        } else {
          console.warn("rewardUser failed:", res.error);
          if (res.error && res.error.toString().toLowerCase().includes("daily limit")) {
            // reflect limit in UI
            if (adsBtn) adsBtn.style.display = 'none';
            if (adsBtnn) {
              adsBtnn.style.display = 'block';
              adsBtnn.textContent = String(progresLimit);
              adsBtnn.style.background = 'red';
            }

            dailyLimit = setInterval(function(){
              progresLimit--;
              if (adsBtnn) adsBtnn.textContent = String(progresLimit);

              if (progresLimit <= 0) {
                clearInterval(dailyLimit);

                if (adsBtnn) {
                  adsBtnn.style.display = 'none';
                  adsBtnn.style.background = '';
                }
                if (adsBtn) adsBtn.style.display = 'block';

                progresLimit = 24 * 60 * 60;
                dailyProgres = 100;
                if (progres) progres.textContent = String(dailyProgres);
              }

            }, 1000);
          }
        }

        // UI feedback for success (or even for failure it's fine to show)
        if (res.success) {
          try {
            if (soundads) {
              soundads.currentTime = 0;
              soundads.play();
            }
          } catch (e) {}
          // visual notification (existing element)
          if (adsNotfi) {
            adsNotfi.style.display = "block";
            adsNotfi.style.opacity = "0.8";

            setTimeout(function () {
              adsNotfi.style.opacity = "0.4";
            }, 2500);

            adsNotfi.style.transform = "translateY(-150%)";

            setTimeout(function () {
              adsNotfi.style.transform = "translateY(135px)";
            }, 100);

            setTimeout(function () {
              adsNotfi.style.transform = "translateY(-150%)";
              adsNotfi.style.opacity = "0";
            }, 3000);

            setTimeout(function () {
              adsNotfi.style.display = "none";
              adsNotfi.style.transform = "";
              adsNotfi.style.opacity = "";
            }, 3500);
          }
        }

        clearInterval(timer);
        if (adsBtnn) adsBtnn.style.display = "none";
        if (adsBtn) adsBtn.style.display  = "block";

        // if dailyProgres depleted, set long cooldown
        if (state.dailyAds != null) {
          const DAILY_LIMIT = 100;
          let remaining = DAILY_LIMIT - (Number(state.dailyAds) || 0);
          if (remaining <= 0) {
            if (adsBtn) adsBtn.style.display = 'none';
            if (adsBtnn) {
              adsBtnn.style.display = 'block';
              adsBtnn.textContent = String(progresLimit);
              adsBtnn.style.background = 'red';
            }

            dailyLimit = setInterval(function(){
              progresLimit--;
              if (adsBtnn) adsBtnn.textContent = String(progresLimit);

              if (progresLimit <= 0) {
                clearInterval(dailyLimit);

                if (adsBtnn) {
                  adsBtnn.style.display = 'none';
                  adsBtnn.style.background = '';
                }
                if (adsBtn) adsBtn.style.display = 'block';

                progresLimit = 24 * 60 * 60;
                dailyProgres = 100;
                if (progres) progres.textContent = String(dailyProgres);
              }

            }, 1000);
          }
        }
      }

    }, 1000);

    // Show the ad(s) — showSingleAd handles cooldowns itself
    await showSingleAd();
    await showSingleAd();
    await showSingleAd();
    await showSingleAd();

  });
}

/* =======================
   شاشة التحميل عند الدخول
======================= */
loadpage.style.display = "block";
pagename.style.display = "none";

setTimeout(function () {
  loadpage.style.display = "none";
  loadpage.style.background = "black";
  pagename.style.display = "block";
}, 8000);

let menubtn = document.querySelector(".menub");
if (menubtn) menubtn.style.display = 'none';

setTimeout(function(){
  if (menubtn) menubtn.style.display = 'flex';
}, 8100);

/* =======================
   نسخ رابط الإحالة
======================= */
let copyrefal = document.getElementById("copy");
let link = document.getElementById("link");
let copyImge = document.getElementById("copyImg");
let copynotifi = document.querySelector(".copynotifi");

if (copyrefal) {
  copyrefal.addEventListener("click",function(){
    if (copyImge) copyImge.src = 'https://files.catbox.moe/cr5q08.png';
    if (copynotifi) {
      copynotifi.style.display = 'block';
      copynotifi.style.top = '-48%';
    }
    if (copyrefal) copyrefal.style.boxShadow = '0 0px 0 #EBEBF0';

    setTimeout(function(){
      if (copynotifi) {
        copynotifi.style.display = 'none';
        copynotifi.style.top = '';
      }
    }, 2000);

    navigator.clipboard.writeText(link.textContent).then(function() {

      setTimeout(function(){
        if (copyImge) copyImge.src = 'copy.png';
        if (copyrefal) copyrefal.style.boxShadow = '0 5px 0 #7880D3';
      }, 800);

    });
  });
}

/* =======================
   إضافة مهمة جديدة
======================= */
let creatTask = document.getElementById("creatTask");

if (creatTask) {
  creatTask.addEventListener("click", async function(){
    let nametask = document.getElementById("taskNameInput").value;
    let linktask = document.getElementById("taskLinkInput").value;

    if (!nametask || !linktask) {
      alert("Please enter task name and link");
      return;
    }

    const res = await fetchApi({
      type: "createTask",
      data: { name: nametask, link: linktask }
    });

    if (res.success) {
      let taskcontainer = document.querySelector(".task-container");
      let taskcard = document.createElement("div");
      taskcard.className = "task-card";

      // لا نغيّر شكل DOM الأصلي بشكل جوهري — نستخدم نفس البنية المستخدمة سابقاً
      taskcard.innerHTML = `
      <span class="task-name">${nametask}</span>
      <span class="task-prize">30 <img src="coins.png" width="25"></span>
      <a class="task-link" href="${linktask}">start</a>
      `;

      taskcontainer.appendChild(taskcard);

      document.getElementById("taskNameInput").value = '';
      document.getElementById("taskLinkInput").value = '';
    } else {
      console.warn("createTask failed:", res.error);
      alert("Failed to create task: " + (res.error || "unknown"));
    }
  });
}

/* =======================
   Telegram WebApp User Data
   - important: ensure syncUser runs first, then getBalance
   - save userId to localStorage
   - do not show default 0 before server responds
======================= */
document.addEventListener("DOMContentLoaded", async function () {

  // إذا لم توجد واجهة تيليجرام، لا ننفّذ المزامنة التلقائية لكن نستخ��م أي معرف مخزن
  const storedId = getStoredUserId();
  if (storedId) {
    state.userId = storedId;
  }

  if (typeof window.Telegram === "undefined") {
    // If Telegram WebApp not present, we still try to fetch balance if we have stored userId.
    if (state.userId) {
      // لا نعرض أي قيمة افتراضية 0 — ندع التحديث يتم عبر الدالة الموحدة عند وصول البيانات
      const res = await fetchApi({ type: "getBalance" });
      if (res.success) {
        updateBalanceUI(Number(res.balance) || 0, res.dailyAds);
      }
    }
    return;
  }

  const tg = window.Telegram.WebApp;
  tg.ready();
  try { tg.expand(); } catch (e) {}

  // تأكد من وجود بيانات المستخدم المرسلة من تيليجرام
  if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    const user = tg.initDataUnsafe.user;
    const userId = user.id;
    const firstName = user.first_name ? user.first_name : "";
    const photoUrl = user.photo_url ? user.photo_url : "";

    // حفظ userId في الstate و localStorage
    state.userId = userId;
    setStoredUserId(userId);

    // أولاً: مزامنة المستخدم على السيرفر
    await fetchApi({
      type: "syncUser",
      data: {
        id: userId,
        name: firstName,
        photo: photoUrl
      }
    });

    // ثم مباشرةً: جلب الرصيد/الإحصاءات وتحديث الواجهة عبر الدالة الموحدة
    const res = await fetchApi({ type: "getBalance" });
    if (res.success) {
      updateBalanceUI(Number(res.balance) || 0, res.dailyAds);
    } else {
      console.warn("Initial getBalance failed:", res.error);
    }

    // تحديث عرض صورة واسم المستخدم (يبقى كما في السابق)
    const userPhotoContainer = document.querySelector(".user-fhoto");
    const userNameContainer = document.querySelector(".user-name");

    if (photoUrl) {
      // هذا لا علاقة له بتحديث الرصيد لذا يمكن استخدام innerHTML هنا كما كان سابقاً
      userPhotoContainer.innerHTML =
        '<img src="' + photoUrl + '" style="width:95px;height:95px;border-radius:50%;">';
    } else {
      userPhotoContainer.innerHTML =
        '<div style="width:80px;height:80px;border-radius:50%;background:#444;color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px;">' +
        (firstName ? firstName.charAt(0) : "") +
        "</div>";
    }

    if (userNameContainer) {
      userNameContainer.textContent = firstName;
    }

    if (link) {
      // رابط الإحالة لا يتضمن رصيد، لذلك تحديثه كما كان
      link.textContent =
        "https://t.me/Bot_ad_watchbot/earn?startapp=ref_" + userId;
    }
  } else {
    // If Telegram exists but no user info, still try to fetch balance if stored userId exists
    if (state.userId) {
      const res = await fetchApi({ type: "getBalance" });
      if (res.success) updateBalanceUI(Number(res.balance) || 0, res.dailyAds);
    }
  }
});