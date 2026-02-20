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

let userbalancce = document.querySelector('.user-balance');
let walletbalance = document.getElementById("adsbalancce");
let barbtn = document.querySelector(".bar");

/* =======================
   الأصوات
======================= */
let soundbtn  = document.getElementById("soundbtn");
let soundads  = document.getElementById("soundads");

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
  barbtn.style.display = 'none';

  setTimeout(function(){
    barbtn.style.display = 'block';
  }, 2000);

  if (soundbtn) {
    try {
      soundbtn.currentTime = 0;
      soundbtn.play();
    } catch (e){}
  }

  setTimeout(function () {
    loadpage.style.display = "none";
  }, 2000);
}

/* =======================
   ربط الأزرار بالصفحات
======================= */
btnMain.addEventListener("click", function () {
  showPage(mainPage);
});

btnTask.addEventListener("click", function () {
  showPage(taskPage);
});

btnWallet.addEventListener("click", function () {
  showPage(walletPage);

  // update wallet display using currentUser
  if (currentUser && typeof currentUser.balance !== 'undefined') {
    walletbalance.innerHTML = `
    <img src="coins.png" style="width:20px; vertical-align:middle;">
    ${currentUser.balance}
    `;
  } else {
    walletbalance.innerHTML = `
    <img src="coins.png" style="width:20px; vertical-align:middle;">
    0
    `;
  }
});

btnshare.addEventListener("click",function(){
  showPage(sharePage);
});

bntaddTask.addEventListener('click',function(){
  showPage(addTaskpage);
});

/* =======================
   أزرار الإعلانات + الرصيد
======================= */
const adsBtn     = document.getElementById("adsbtn");
const adsBtnn    = document.getElementById("adsbtnn");
const adsBalance = document.getElementById("adsbalance");
const adsNotfi   = document.getElementById("adsnotifi");
let progres = document.getElementById("progres");
let adstime = document.getElementById("adstime");

let timer = null;
let dailyLimit = null;
let dailyProgres = 100;
let progresLimit = 24 * 60 * 60; // 24 ساعة بالثواني

/* ===== منع to often + توقيت بين كل إعلان ===== */
let adCooldown = false;
let adCooldownTime = 6000; // 6 ثانية بين كل إعلان (frontend local guard)

/* =======================
   USER (from server)
======================= */
let currentUser = null;

/* =======================
   Telegram WebApp Init
======================= */
const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  try {
    tg.ready();
  } catch(e){}
  (async function initTelegramUser(){
    try {
      const u = tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : null;
      if (!u) {
        console.warn('Telegram user data not available');
        return;
      }
      const payload = {
        telegram_id: String(u.id || ''),
        first_name: u.first_name || '',
        last_name: u.last_name || '',
        username: u.username || '',
        language_code: u.language_code || '',
        is_premium: !!u.is_premium
      };

      const resp = await fetch('/api/user/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (resp.ok) {
        const data = await resp.json();
        currentUser = data.user || null;
        // initialize UI balances
        if (currentUser && typeof currentUser.balance !== 'undefined') {
          adsBalance.textContent = currentUser.balance;
          // update any wallet snippet that might exist
          if (walletbalance) {
            walletbalance.innerHTML = `
            <img src="coins.png" style="width:20px; vertical-align:middle;">
            ${currentUser.balance}
            `;
          }
        }
      } else {
        console.error('init user failed', await resp.text());
      }
    } catch (e) {
      console.error('init error', e);
    }
  })();
} else {
  console.warn('Telegram WebApp not found. Web features disabled.');
}

/* =======================
   دالة عرض إعلان واحد مع انتظار
   (يحاول عرض AdsGram SDK أو محاكاة محلياً)
======================= */
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
      // simulate ad shown
      setTimeout(function(){
        setTimeout(function(){
          adCooldown = false;
        }, adCooldownTime);
        resolve(true);
      }, 2000);
    }
  });
}

/* =======================
   لمعالجة مكافأة الإعلان إلى السيرفر
======================= */
async function rewardAdOnServer() {
  if (!currentUser || !currentUser.telegram_id) {
    console.warn('No currentUser to reward');
    return null;
  }
  try {
    const resp = await fetch('/api/ad/reward', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ telegram_id: String(currentUser.telegram_id) })
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.user) {
        currentUser = data.user;
        // update UI
        if (adsBalance) adsBalance.textContent = currentUser.balance;
        if (walletbalance) {
          walletbalance.innerHTML = `
          <img src="coins.png" style="width:20px; vertical-align:middle;">
          ${currentUser.balance}
          `;
        }
        // update progress/daily if provided
        if (data.user.daily_count !== undefined && progres) {
          // show remaining progress as (100 - daily_count) or provided field
          const remaining = Math.max(0, 100 - (data.user.daily_count || 0));
          progres.textContent = remaining;
        }
        return data.user;
      } else {
        console.warn('reward response missing user', data);
        return null;
      }
    } else {
      const txt = await resp.text();
      console.warn('reward failed', resp.status, txt);
      return null;
    }
  } catch (e) {
    console.error('reward error', e);
    return null;
  }
}

/* =======================
   عند الضغط على زر الإعلان
   (تم تعديل السلوك لطلب المكافأة من السيرفر عند اكتمال الإعلان)
======================= */
adsBtn.addEventListener("click", async function () {

  if (adCooldown) return;

  adsBtn.style.display  = "none";
  adsBtnn.style.display = "block";

  /* ===== بدء عداد 50 ثانية ===== */
  let timeLeft = 50;
  adsBtnn.textContent = timeLeft + "s";

  timer = setInterval(function () {
    timeLeft--;
    adsBtnn.textContent = timeLeft + "s";

    if (timeLeft <= 0) {

      // stop timer UI
      clearInterval(timer);
      adsBtnn.style.display = "none";
      adsBtn.style.display  = "block";

      // play sound
      try {
        soundads.currentTime = 0;
        soundads.play();
      } catch(e){}

      // show notification animation
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

      // Notify server to reward
      await rewardAdOnServer();

      // reduce local daily progress view (best-effort)
      if (dailyProgres > 0) {
        dailyProgres--;
        progres.textContent = dailyProgres;
      }

    }

  }, 1000);

  /* ===== عرض 4 إعلانات متتالية مع فاصل زمني ===== */
  // We still attempt to show 4 SDK ads sequentially (if available).
  // Each showSingleAd call will respect a small local cooldown guard.
  let ad1 = await showSingleAd();
  if (!ad1) return;

  let ad2 = await showSingleAd();
  if (!ad2) return;

  let ad3 = await showSingleAd();
  if (!ad3) return;

  let ad4 = await showSingleAd();
  if (!ad4) return;

});

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
let refaltext = document.getElementById("link").textContent;
let copyImge = document.getElementById("copyImg");
let copynotifi = document.querySelector(".copynotifi");

if (copyrefal) {
  copyrefal.addEventListener("click",function(){
    copyImge.src = 'https://files.catbox.moe/cr5q08.png';
    copynotifi.style.display = 'block';
    copynotifi.style.top = '-48%';
    copyrefal.style.boxShadow = '0 0px 0 #EBEBF0';

    setTimeout(function(){
      copynotifi.style.display = 'none';
      copynotifi.style.top = '';
    }, 2000);

    navigator.clipboard.writeText(refaltext).then(function() {

      setTimeout(function(){
        copyImge.src = 'copy.png';
        copyrefal.style.boxShadow = '0 5px 0 #7880D3';
      }, 800);

    });
  });
}

/* =======================
   إضافة مهمة جديدة
======================= */
let creatTask = document.getElementById("creatTask");

if (creatTask) {
  creatTask.addEventListener("click",function(){
    let nametask = document.getElementById("taskNameInput").value;
    let linktask = document.getElementById("taskLinkInput").value;
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
  });
}