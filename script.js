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
   API CENTRAL HANDLER
======================= */
const API_ENDPOINT = "/api";

let USER_ID = null; 

const MIN_API_INTERVAL_MS = 5000;
let lastApiCallTimestamp = 0;

async function fetchApi({ type, data = {} }) {
  try {
    if (USER_ID && (!data.userId) && !data.id) {
      data.userId = USER_ID;
    }

    const now = Date.now();
    const sinceLast = now - (lastApiCallTimestamp || 0);
    if (sinceLast < MIN_API_INTERVAL_MS) {
      const wait = MIN_API_INTERVAL_MS - sinceLast;
      await new Promise((r) => setTimeout(r, wait));
    }

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data })
    });

    lastApiCallTimestamp = Date.now();

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || result || "Network response was not ok" };
    }

    return result;

  } catch (error) {
    console.error("API Error:", error);
    lastApiCallTimestamp = Date.now();
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

  if (btnpage === sharePage) {
    startReferralPolling();
    refreshReferralCounts();
  } else {
    stopReferralPolling();
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

    const res = await fetchApi({ type: "getBalance" });

    if (res && res.success) {
      ADS = Number(res.balance) || 0;

      if (walletbalance) {
        walletbalance.innerHTML = `
        <img src="coins.png" style="width:20px; vertical-align:middle;">
        ${ADS}
        `;
      }

      const DAILY_LIMIT = 100;
      const remaining = DAILY_LIMIT - (Number(res.dailyAds) || 0);
      dailyProgres = remaining >= 0 ? remaining : 0;
      if (progres) progres.textContent = dailyProgres;
    } else {
      console.warn("getBalance failed:", res && res.error);
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
======================= */
const adsBtn     = document.getElementById("adsbtn");
const adsBtnn    = document.getElementById("adsbtnn");
const adsBalance = document.getElementById("adsbalance");
const adsNotfi   = document.getElementById("adsnotifi");
let progres = document.getElementById("progres");

let ADS   = 0;
let timer = null;
let dailyLimit = null;
let dailyProgres = 100;
let progresLimit = 24 * 60 * 60;

const MIN_CLIENT_AD_INTERVAL = 5; 
let lastAdTimestamp = 0;

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

async function playNotificationSound() {
  try {
    if (soundads && typeof soundads.play === "function") {
      try {
        soundads.currentTime = 0;
      } catch (e) {}
      const playResult = soundads.play();
      if (playResult && typeof playResult.then === "function") {
        await playResult;
      }
      return;
    }

    const el = document.getElementById("soundads");
    if (el && el.src) {
      const a = new Audio(el.src);
      a.volume = typeof el.volume !== 'undefined' ? el.volume : 1;
      try {
        await a.play();
        return;
      } catch (e) {
      }
    }

    if (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.08;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(function(){
        try { o.stop(); } catch (e) {}
        try { ctx.close(); } catch (e) {}
      }, 150);
      return;
    }
  } catch (e) {
    console.warn("playNotificationSound failed:", e);
  }
}

if (adsBtn) {
  adsBtn.addEventListener("click", async function (evt) {

    if (evt && typeof evt.isTrusted !== "undefined" && !evt.isTrusted) {
      console.warn("Ignored non-user initiated click");
      return;
    }

    const nowTs = Date.now();
    if (nowTs - lastAdTimestamp < MIN_CLIENT_AD_INTERVAL * 1000) {
      const wait = Math.ceil((MIN_CLIENT_AD_INTERVAL * 1000 - (nowTs - lastAdTimestamp)) / 1000);
      if (adsBtnn) {
        adsBtnn.style.display = "block";
        adsBtn.style.display = "none";
        adsBtnn.textContent = `${wait}s`;
        adsBtnn.style.background = 'orange';
        setTimeout(function(){
          adsBtnn.style.display = 'none';
          adsBtn.style.display = 'block';
          adsBtnn.style.background = '';
        }, Math.min(wait * 1000, 5000));
      }
      return;
    }

    if (adCooldown) return;

    adsBtn.style.display  = "none";
    adsBtnn.style.display = "block";

    let timeLeft = 50;
    adsBtnn.textContent = timeLeft + "s";

    timer = setInterval(async function () {
      timeLeft--;
      adsBtnn.textContent = timeLeft + "s";

      if (timeLeft <= 0) {

        // تم إزالة amount من هنا، الخادم يتولى تحديد القيمة لمنع التلاعب
        const res = await fetchApi({
          type: "rewardUser",
          data: {} 
        });

        if (res && res.success) {
          ADS = Number(res.balance) || ADS;
          if (adsBalance) adsBalance.textContent = ADS;

          const DAILY_LIMIT = 100;
          dailyProgres = DAILY_LIMIT - (Number(res.dailyAds) || 0);
          if (dailyProgres < 0) dailyProgres = 0;
          if (progres) progres.textContent = dailyProgres;

          refreshReferralCounts();
          lastAdTimestamp = Date.now();
        } else {
          console.warn("rewardUser failed:", res && res.error);
          const errText = (res && res.error) ? String(res.error).toLowerCase() : "";

          if (errText.includes("daily limit")) {
            adsBtn.style.display = 'none';
            adsBtnn.style.display = "block";
            adsBtnn.textContent = progresLimit;
            adsBtnn.style.background = 'red';
            dailyLimit = setInterval(function(){
              progresLimit--;
              adsBtnn.textContent = progresLimit;

              if (progresLimit <= 0) {
                clearInterval(dailyLimit);

                adsBtnn.style.display = 'none';
                adsBtn.style.display = 'block';
                adsBtnn.style.background = '';
                progresLimit = 24 * 60 * 60;
                dailyProgres = 100;
                if (progres) progres.textContent = dailyProgres;
              }

            }, 1000);
          } else if (errText.includes("cooldown") || errText.includes("please wait")) {
            const match = String(res.error).match(/wait\s+([0-9]+)/i);
            let waitSec = match ? Number(match[1]) : MIN_CLIENT_AD_INTERVAL;
            adsBtn.style.display = 'none';
            adsBtnn.style.display = 'block';
            adsBtnn.textContent = `${waitSec}s`;
            adsBtnn.style.background = 'orange';

            let remaining = waitSec;
            if (dailyLimit) clearInterval(dailyLimit);
            dailyLimit = setInterval(function(){
              remaining--;
              adsBtnn.textContent = `${remaining}s`;
              if (remaining <= 0) {
                clearInterval(dailyLimit);
                adsBtnn.style.display = 'none';
                adsBtn.style.display = 'block';
                adsBtnn.style.background = '';
                if (progres) progres.textContent = dailyProgres;
              }
            }, 1000);
          } else {
            alert("Failed to claim ad reward: " + ((res && res.error) || "unknown error"));
          }
        }

        if (res && res.success) {
          try {
            await playNotificationSound();
          } catch (e) {
            console.warn("Notification sound play failed:", e);
          }
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
        adsBtnn.style.display = "none";
        adsBtn.style.display  = "block";

        if (dailyProgres <= 0) {
          adsBtn.style.display = 'none';
          adsBtnn.style.display = 'block';
          adsBtnn.textContent = progresLimit;
          adsBtnn.style.background = 'red';

          dailyLimit = setInterval(function(){

            progresLimit--;
            adsBtnn.textContent = progresLimit;

            if (progresLimit <= 0) {
              clearInterval(dailyLimit);

              adsBtnn.style.display = 'none';
              adsBtn.style.display = 'block';
              adsBtnn.style.background = '';
              progresLimit = 24 * 60 * 60;
              dailyProgres = 100;
              if (progres) progres.textContent = dailyProgres;
            }

          }, 1000);
        }
      }

    }, 1000);

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
      data: { name: nametask, link: linktask, userId: USER_ID } // يتم تمرير المعرف للتحقق من الصلاحيات
    });

    if (res && res.success) {
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
      console.warn("createTask failed:", res && res.error);
      alert("Failed to create task: " + ((res && res.error) || "unknown"));
    }
  });
}

/* =======================
   HELPER: تحديث واجهة الرصيد
======================= */
function updateBalanceUI(res) {
  if (!res) return;

  if (res.success) {
    ADS = Number(res.balance) || ADS;

    if (walletbalance) {
      walletbalance.innerHTML = `
      <img src="coins.png" style="width:20px; vertical-align:middle;">
      ${ADS}
      `;
    }

    if (adsBalance) {
      adsBalance.textContent = ADS;
    }

    const DAILY_LIMIT = 100;
    dailyProgres = DAILY_LIMIT - (Number(res.dailyAds) || 0);
    if (dailyProgres < 0) dailyProgres = 0;
    if (progres) progres.textContent = dailyProgres;

    if (res.lastAdTime) {
      try {
        const last = new Date(res.lastAdTime).getTime();
        if (!isNaN(last)) {
          lastAdTimestamp = last;
        }
      } catch (e) {}
    }
  } else {
    console.warn("updateBalanceUI: getBalance failed:", res && res.error);
  }
}

function updateReferralCountsUI(counts) {
  if (!counts) return;
  const activeEl = document.querySelector('.refal .active.count span');
  const pendingEl = document.querySelector('.refal .pending.count span');

  if (activeEl) activeEl.textContent = String(counts.active ||