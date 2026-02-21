/* =======================
   أزرار التنقّل
======================= */
let btnMain    = document.querySelector("button");
let btnTask    = document.getElementById("btn2");
let btnWallet  = document.getElementById("btn3");
let btnshare   = document.getElementById("sharebtn");
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

let userbalancce    = document.querySelector('.user-balance'); // عنصر عرض رصيد في الصفحة الرئيسية (اسم كما في ملفك الأصلي)
let walletbalance   = document.getElementById("adsbalancce");  // عنصر عرض رصيد المحفظة
let adsBalance      = document.getElementById("adsbalance");   // عنصر آخر لعرض الرصيد إن وُجد
let adsNotfi        = document.getElementById("adsnotifi");
let progres         = document.getElementById("progres");
let barbtn          = document.querySelector(".bar");

/* =======================
   الأصوات
======================= */
let soundbtn  = document.getElementById("soundbtn");
let soundads  = document.getElementById("soundads");

/* =======================
   حالة واحدة مشتركة (state)
   - userId, balance, dailyAds
   - لا تستخدم متغيرات مكررة مثل ADS
======================= */
const state = {
  userId: null,
  balance: null,   // null = لم يتم جلبه بعد
  dailyAds: null
};

/* =======================
   localStorage helpers لحفظ userId
======================= */
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

/* =======================
   API CENTRAL HANDLER
   - يرسل userId تلقائياً إذا وُجد في state أو localStorage
======================= */
const API_ENDPOINT = "/api";

async function fetchApi({ type, data = {} }) {
  try {
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
  if (barbtn) barbtn.style.display = 'none';

  setTimeout(function(){
    if (barbtn) barbtn.style.display = 'block';
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
   تحديث نص الرصيد بطريقة آمنة (بدون innerHTML)
   - نحاول تحديث عنصر داخلي مخصص إن وُجد [data-balance-value] أو .balance-number
   - إن لم يوجد، نحدّث عقدة نصية داخل العنصر إن وُجدت لإبقاء الصور/العناصر الأخرى كما هي
   - كخيار أخير نحدث textContent (قد يستبدل المحتوى)
   - لا نضيف عناصر HTML جديدة ولا نغيّر بنية DOM
======================= */
function updateBalanceInElement(el, value) {
  if (!el) return;

  // 1) عنصر داخلي مخصص للقيمة
  const inner = el.querySelector && (el.querySelector('[data-balance-value]') || el.querySelector('.balance-number'));
  if (inner) {
    inner.textContent = String(value);
    return;
  }

  // 2) البحث عن عقدة نصية داخل العنصر (نحافظ على العناصر الأخرى مثل الصور)
  const textNodes = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
  if (textNodes.length > 0) {
    // اختر عقدة نصية تحتوي أرقام إن وُجدت، وإلا اختر الأخيرة
    let target = textNodes.find(n => /\d/.test(n.nodeValue));
    if (!target) target = textNodes[textNodes.length - 1];
    target.nodeValue = ' ' + String(value);
    return;
  }

  // 3) كخيار أخير: نعيد ضبط النص (هذا قد يستبدل المحتوى، لكنه حل احتياطي)
  el.textContent = String(value);
}

/* =======================
   الدالة الموحدة لتحديث الواجهة: updateBalanceUI(balance, dailyAds)
   - تحفظ الحالة وتحدّث كل عناصر الرصيد
   - لا تستخدم innerHTML لتحديث الرصيد
======================= */
function updateBalanceUI(balance, dailyAds) {
  // normalize values
  const b = (typeof balance === "number") ? balance : (balance != null ? Number(balance) : null);
  const d = (typeof dailyAds === "number") ? dailyAds : (dailyAds != null ? Number(dailyAds) : null);

  if (b != null && !Number.isNaN(b)) state.balance = b;
  if (d != null && !Number.isNaN(d)) state.dailyAds = d;

  // تحديث عناصر الواجهة المرتبطة بالرصيد
  updateBalanceInElement(userbalancce, state.balance != null ? state.balance : "");
  updateBalanceInElement(walletbalance, state.balance != null ? state.balance : "");
  updateBalanceInElement(adsBalance, state.balance != null ? state.balance : "");

  // تحديث تقدم الإعلانات اليومية إن وُجد
  if (progres) {
    const DAILY_LIMIT = 100;
    let remaining = (state.dailyAds != null) ? (DAILY_LIMIT - Number(state.dailyAds)) : DAILY_LIMIT;
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

    // جلب الرصيد بعد الانتقال للصفحة وتحديث الواجهة عبر الدالة الموحدة
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
   - نحافظ على باقي المنطق (مؤقت، حد يومي، أصوات، إشعارات)
   - عند مكافأة المستخدم نحدث الواجهة باستخدام updateBalanceUI فقط
======================= */
const adsBtn = document.getElementById("adsbtn");
const adsBtnn = document.getElementById("adsbtnn");

let timer = null;
let dailyLimit = null;
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
          // استخدم الدالة الموحدة لتحديث الرصيد/التقدّم
          updateBalanceUI(Number(res.balance) || state.balance || 0, res.dailyAds);
        } else {
          console.warn("rewardUser failed:", res.error);
          if (res.error && res.error.toString().toLowerCase().includes("daily limit")) {
            // reflect limit in UI (محافظة على المنطق الأصلي)
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
                if (progres) progres.textContent = String(100);
              }

            }, 1000);
          }
        }

        // صوت وإشعار كما في الكود الأصلي
        if (res.success) {
          try {
            if (soundads) {
              soundads.currentTime = 0;
              soundads.play();
            }
          } catch (e) {}
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

        // إذا استنفدت الحصة اليومية حسب state.dailyAds
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
                if (progres) progres.textContent = String(100);
              }

            }, 1000);
          }
        }
      }

    }, 1000);

    // عرض الإعلان / الإعلانات
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
   - يبقى كما في الأصل (يستخدم innerHTML لإنشاء كرت المهمة كما كان)
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
   - ضمان تنفيذ syncUser أولاً ثم getBalance
   - حفظ userId في localStorage
   - عدم عرض قيمة افتراضية 0 قبل وصول بيانات السيرفر
   - استخدام updateBalanceUI لتحديث كل أماكن الرصيد
======================= */
document.addEventListener("DOMContentLoaded", async function () {

  // استخدم معرف مخزن إن وُجد
  const storedId = getStoredUserId();
  if (storedId) {
    state.userId = storedId;
  }

  // إذا لم توجد واجهة تيليجرام، حاول جلب الرصيد فقط إذا وُجد userId مخزن
  if (typeof window.Telegram === "undefined") {
    if (state.userId) {
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

  if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    const user = tg.initDataUnsafe.user;
    const userId = user.id;
    const firstName = user.first_name ? user.first_name : "";
    const photoUrl = user.photo_url ? user.photo_url : "";

    // حفظ userId في state و localStorage
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

    // ثم مباشرة: جلب الرصيد وتحديث الواجهة عبر الدالة الموحدة
    const res = await fetchApi({ type: "getBalance" });
    if (res.success) {
      updateBalanceUI(Number(res.balance) || 0, res.dailyAds);
    } else {
      console.warn("Initial getBalance failed:", res.error);
    }

    // تحديث عرض صورة واسم المستخدم كما في الأصل
    const userPhotoContainer = document.querySelector(".user-fhoto");
    const userNameContainer = document.querySelector(".user-name");

    if (photoUrl) {
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
      // تحديث رابط الإحالة كما كان
      link.textContent =
        "https://t.me/Bot_ad_watchbot/earn?startapp=ref_" + userId;
    }
  } else {
    // إذا تيليجرام موجود لكن لا يحتوي على بيانات المستخدم، نحاول جلب الرصيد عبر userId المخزن
    if (state.userId) {
      const res = await fetchApi({ type: "getBalance" });
      if (res.success) updateBalanceUI(Number(res.balance) || 0, res.dailyAds);
    }
  }
});