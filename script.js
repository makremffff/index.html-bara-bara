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

let USER_ID = null; // store Telegram user id after sync

// Client-side global API call throttling: minimum interval between any fetchApi calls
// Reduced to improve responsiveness while still preventing accidental spamming
const MIN_API_INTERVAL_MS = 800;
let lastApiCallTimestamp = 0;

async function fetchApi({ type, data = {} }) {
  try {
    // attach userId automatically when available and not explicitly provided
    if (USER_ID && (!data.userId) && !data.id) {
      data.userId = USER_ID;
    }

    // Enforce client-side minimum interval between API calls (throttle)
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

    // Update lastApiCallTimestamp after actual network call completed
    lastApiCallTimestamp = Date.now();

    const result = await response.json();

    if (!response.ok) {
      // Normalize error shape
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
   الآن تتعامل مع بدء/ايقاف استدعاء عداد الدعوات عندما تدخل صفحة invite
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

  // Start/stop referral polling depending on the shown page
  if (btnpage === sharePage) {
    startReferralPolling();
    // ensure immediate refresh when opening invite page
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

      // update progress (daily remaining)
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
   تحسين: منع النقرات الآلية عن طريق:
   - التحقق من event.isTrusted (يمنع dispatch programmatic)
   - إضافة حماية client-side cooldown
   - الاعتماد على تحقق server-side للفاصل الزمني الفعلي
   - تحسينات للاستجابة الفورية (optimistic UI) ولإلغاء حظر الصوت
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

// client-side cooldown in seconds (should be slightly less than server MIN to give responsive UX)
const MIN_CLIENT_AD_INTERVAL = 5; // seconds
let lastAdTimestamp = 0;

let adCooldown = false;
let adCooldownTime = 6000;

// Audio unlock to ensure sound can play reliably after a real user gesture
let audioUnlocked = false;
let audioContext = null;
function unlockAudioOnUserGesture() {
  if (audioUnlocked) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      audioUnlocked = true; // nothing to unlock
      return;
    }
    audioContext = new AudioCtx();
    // create a silent oscillator briefly to unlock audio playback
    const o = audioContext.createOscillator();
    const g = audioContext.createGain();
    o.type = "sine";
    o.frequency.value = 0;
    g.gain.value = 0;
    o.connect(g);
    g.connect(audioContext.destination);
    o.start();
    setTimeout(function(){
      try { o.stop(); } catch (e) {}
      try { g.disconnect(); } catch (e) {}
      // keep context resumed for future small beeps
    }, 50);
    // resume ensures unlocked in modern browsers
    if (audioContext.state === 'suspended' && typeof audioContext.resume === 'function') {
      audioContext.resume().catch(()=>{});
    }
    audioUnlocked = true;
  } catch (e) {
    // fail gracefully
    audioUnlocked = true;
  }
}
// Attach once to capture first real user interaction anywhere on the page
document.addEventListener('click', function onFirstUserGesture(e){
  // Only treat trusted events as unlocking
  if (e && e.isTrusted) {
    unlockAudioOnUserGesture();
    document.removeEventListener('click', onFirstUserGesture, true);
  }
}, true);

/* =======================
   SHOW SINGLE AD wrapper
   Ensures audio unlocked before resolving, and improves handling
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
          // ensure audio unlocked on success gesture
          unlockAudioOnUserGesture();
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
      // simulate ad
      setTimeout(function(){
        unlockAudioOnUserGesture();
        setTimeout(function(){
          adCooldown = false;
        }, adCooldownTime);
        resolve(true);
      }, 2000);
    }
  });
}

/* =======================
   Helper: play notification sound with robust fallback (element, created Audio, WebAudio)
   Ensures notification sound plays reliably when user finishes ad and receives reward.
   Uses unlocked AudioContext when available.
======================= */
async function playNotificationSound() {
  try {
    // Ensure we tried to unlock audio if possible
    try { unlockAudioOnUserGesture(); } catch (e) {}

    // Prefer existing soundads element if present
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

    // Try to find element by id again (defensive)
    const el = document.getElementById("soundads");
    if (el && el.src) {
      const a = new Audio(el.src);
      a.volume = typeof el.volume !== 'undefined' ? el.volume : 1;
      try {
        await a.play();
        return;
      } catch (e) {
        // continue to webaudio fallback
      }
    }

    // If we have an unlocked audioContext, use a short beep
    if (audioContext) {
      try {
        const ctx = audioContext;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = 880;
        g.gain.value = 0.08;
        o.connect(g);
        g.connect(ctx.destination);
        // start/stop quickly
        if (typeof ctx.resume === 'function') {
          await ctx.resume().catch(()=>{});
        }
        o.start();
        setTimeout(function(){
          try { o.stop(); } catch (e) {}
        }, 120);
        return;
      } catch (e) {
        // fallback continues
      }
    }

    // Fallback: small beep using WebAudio API (create new context)
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

/* =======================
   Unified ads notification animation (used for box open and ad reward)
======================= */
function showAdsNotification() {
  if (!adsNotfi) return;

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

/* =======================
   Reward button handler
   Improvements:
   - Optimistic UI update (immediate perceived reward)
   - Better error handling and immediate audio/notification when appropriate
   - Parse server-side cooldown messages robustly
======================= */
if (adsBtn) {
  adsBtn.addEventListener("click", async function (evt) {

    // 1) Reject synthetic/programmatic clicks
    if (evt && typeof evt.isTrusted !== "undefined" && !evt.isTrusted) {
      // ignore programmatic clicks to mitigate automation
      console.warn("Ignored non-user initiated click");
      return;
    }

    // 2) Enforce client-side minimum interval
    const nowTs = Date.now();
    if (nowTs - lastAdTimestamp < MIN_CLIENT_AD_INTERVAL * 1000) {
      const wait = Math.ceil((MIN_CLIENT_AD_INTERVAL * 1000 - (nowTs - lastAdTimestamp)) / 1000);
      // Provide user feedback
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

        // Optimistic UI: increment balance immediately for perceived responsiveness
        const optimisticAmount = 100;
        const prevADS = ADS;
        ADS = Number(ADS) + optimisticAmount;
        if (adsBalance) adsBalance.textContent = ADS;
        if (walletbalance) {
          walletbalance.innerHTML = `
          <img src="coins.png" style="width:20px; vertical-align:middle;">
          ${ADS}
          `;
        }

        // Try to play notification immediately (likely allowed because this started from user gesture)
        try {
          await playNotificationSound();
        } catch (e) {}

        // visual notification immediately
        showAdsNotification();

        // Reward user (attach userId automatically via fetchApi)
        const res = await fetchApi({
          type: "rewardUser",
          data: { amount: optimisticAmount }
        });

        if (res && res.success) {
          // Use server canonical balance if provided
          ADS = Number(res.balance) || ADS;
          if (adsBalance) adsBalance.textContent = ADS;
          if (walletbalance) {
            walletbalance.innerHTML = `
            <img src="coins.png" style="width:20px; vertical-align:middle;">
            ${ADS}
            `;
          }

          // update daily progress with server value
          const DAILY_LIMIT = 100;
          dailyProgres = DAILY_LIMIT - (Number(res.dailyAds) || 0);
          if (dailyProgres < 0) dailyProgres = 0;
          if (progres) progres.textContent = dailyProgres;

          // refresh referral counts in case this watch activated a referral
          refreshReferralCounts();

          // If referral activated, give immediate feedback
          if (res.referralActivated || res.inviterRewarded) {
            try { await playNotificationSound(); } catch (e) {}
            showAdsNotification();
            // Optionally show a short alert/visual
            // alert("Referral activated! Reward has been granted.");
          }

          // update client-side lastAdTimestamp to now (server returned lastAdTime but use local now)
          lastAdTimestamp = Date.now();
        } else {
          // On failure, revert optimistic update if needed
          if (!res || !res.success) {
            // revert balance to prev value if server didn't accept
            ADS = prevADS;
            if (adsBalance) adsBalance.textContent = ADS;
            if (walletbalance) {
              walletbalance.innerHTML = `
              <img src="coins.png" style="width:20px; vertical-align:middle;">
              ${ADS}
              `;
            }
          }

          // handle errors (e.g., daily limit reached or server-side cooldown)
          console.warn("rewardUser failed:", res && res.error);
          const errText = (res && res.error) ? String(res.error).toLowerCase() : "";

          if (errText.includes("daily limit")) {
            // reflect limit in UI
            adsBtn.style.display = 'none';
            adsBtnn.style.display = "block";
            adsBtnn.textContent = progresLimit;
            adsBtnn.style.background = 'red';
            // start cooldown countdown for the remaining day limit
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
            // server-side ad cooldown enforced -> parse seconds
            const match = String(res.error).match(/wait\s+([0-9]+)/i);
            let waitSec = match ? Number(match[1]) : MIN_CLIENT_AD_INTERVAL;
            // reflect server cooldown in UI
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
            // generic failure feedback
            alert("Failed to claim ad reward: " + ((res && res.error) || "unknown error"));
          }
        }

        clearInterval(timer);
        adsBtnn.style.display = "none";
        adsBtn.style.display  = "block";

        // if dailyProgres depleted, set long cooldown
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

    // Show the ad(s) — showSingleAd handles cooldowns itself
    await showSingleAd();
    await showSingleAd();
    await showSingleAd();
    await showSingleAd();

  });
}

/* =======================
   BOX (Open chest) FEATURE
   - User must watch 2 ads (client-side)
   - Server grants a random reward (100..200) without affecting ad progress
   - Button locked for 5 minutes after opening (client and server-side)
   - Show same ads notification animation when box opened
   - Ensure sound plays reliably by unlocking audio on the user gesture
======================= */
const openBoxBtn = document.getElementById("openbox");
let boxCooldown = false;
let boxCooldownInterval = null;
let lastBoxTimestamp = 0; // ms since epoch
const BOX_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function formatCountdown(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const mm = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const ss = (totalSec % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function startBoxCooldownFrom(nowMs) {
  lastBoxTimestamp = nowMs;
  const end = lastBoxTimestamp + BOX_COOLDOWN_MS;

  if (!openBoxBtn) return;

  boxCooldown = true;
  openBoxBtn.style.pointerEvents = "none";
  openBoxBtn.style.opacity = "0.6";

  if (boxCooldownInterval) clearInterval(boxCooldownInterval);

  function tick() {
    const remaining = end - Date.now();
    if (remaining <= 0) {
      clearInterval(boxCooldownInterval);
      boxCooldown = false;
      openBoxBtn.style.pointerEvents = "";
      openBoxBtn.style.opacity = "";
      openBoxBtn.textContent = "OPEN";
    } else {
      openBoxBtn.textContent = formatCountdown(remaining);
    }
  }

  // first immediate tick
  tick();
  boxCooldownInterval = setInterval(tick, 1000);
}

async function handleOpenBoxClick(evt) {
  if (!openBoxBtn) return;

  if (evt && typeof evt.isTrusted !== "undefined" && !evt.isTrusted) {
    console.warn("Ignored non-user initiated click on box");
    return;
  }

  if (!USER_ID) {
    alert("Please login with Telegram to open the box.");
    return;
  }

  if (boxCooldown) {
    // already cooling — do nothing
    return;
  }

  // Ensure audio unlocked for reliable sound feedback
  try { unlockAudioOnUserGesture(); } catch (e) {}

  // Play quick click sound
  try {
    if (soundbtn) { soundbtn.currentTime = 0; soundbtn.play(); }
  } catch (e) {}

  // 1) Show two ads sequentially, require both to succeed
  let ad1 = await showSingleAd();
  if (!ad1) {
    alert("Ad was not completed. Please try again.");
    return;
  }

  // small pause to simulate UX
  await new Promise(r => setTimeout(r, 400));

  let ad2 = await showSingleAd();
  if (!ad2) {
    alert("Ad was not completed. Please try again.");
    return;
  }

  // 2) Call server to grant box reward (server will enforce server-side cooldown)
  const res = await fetchApi({ type: "openBox" });

  if (!res || !res.success) {
    // If server returned cooldown, reflect it
    if (res && res.error && String(res.error).toLowerCase().includes("cooldown")) {
      // parse seconds if present
      const match = String(res.error).match(/wait\s+([0-9]+)/i);
      const waitSec = match ? Number(match[1]) : 5 * 60;
      const nowMs = Date.now();
      startBoxCooldownFrom(nowMs - (BOX_COOLDOWN_MS - waitSec * 1000));
      alert(res.error);
      return;
    }

    alert("Failed to open box: " + ((res && res.error) || "unknown error"));
    return;
  }

  // 3) Update UI with received reward and balance
  if (res.reward) {
    // Show a visual summary and play sound reliably
    try {
      await playNotificationSound();
    } catch (e) {}

    // Update global ADS balance display (server returned canonical balance)
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

    // show the same ads notification animation
    showAdsNotification();
  }

  // 4) Start client-side box cooldown using server-provided lastBoxTime if available
  if (res.lastBoxTime) {
    try {
      const ms = new Date(res.lastBoxTime).getTime();
      if (!isNaN(ms)) {
        startBoxCooldownFrom(ms);
      } else {
        // Fallback to now
        startBoxCooldownFrom(Date.now());
      }
    } catch (e) {
      startBoxCooldownFrom(Date.now());
    }
  } else {
    // fallback if server didn't return lastBoxTime
    startBoxCooldownFrom(Date.now());
  }
}

if (openBoxBtn) {
  openBoxBtn.addEventListener("click", handleOpenBoxClick);
}

/* =======================
   شاشة التحميل عند الدخول
======================= */
if (loadpage) loadpage.style.display = "block";
if (pagename) pagename.style.display = "none";

setTimeout(function () {
  if (loadpage) { loadpage.style.display = "none"; loadpage.style.background = "black"; }
  if (pagename) pagename.style.display = "block";
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

    if (res && res.success) {
      let taskcontainer = document.querySelector(".task-container");
      let taskcard = document.createElement("div");
      taskcard.className = "task-card";

      taskcard.innerHTML = `
      <img class="taskimg" src="telegram.png" width="25">
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
   HELPER: تحديث واجهة الرصيد (يظهر للمستخدم أول مرّة و يتحدّث تلقائياً)
   تحسّن التعامل مع بداية يوم جديد و ضبط التوقيت المحلي لآخر إعلان وصناديق
======================= */
function updateBalanceUI(res) {
  if (!res) return;

  if (res.success) {
    // Update global ADS and wallet UI
    ADS = Number(res.balance) || ADS;

    if (walletbalance) {
      walletbalance.innerHTML = `
      <img src="coins.png" style="width:20px; vertical-align:middle;">
      ${ADS}
      `;
    }

    if (adsBalance) {
      // Keep adsBalance as text content (original place)
      adsBalance.textContent = ADS;
    }

    // Handle daily progress with server-provided fields
    const DAILY_LIMIT = 100;
    // If server provides lastAdDate/lastAdTime, use them to compute current dailyAds
    let serverDailyAds = typeof res.dailyAds !== 'undefined' ? Number(res.dailyAds) : null;
    let lastAdDate = res.lastAdDate || null;

    // If lastAdDate differs from today, reset daily count
    try {
      const today = new Date().toISOString().split("T")[0];
      if (lastAdDate && lastAdDate !== today) {
        serverDailyAds = 0;
      }
    } catch (e) {}

    if (serverDailyAds === null) serverDailyAds = 0;
    dailyProgres = DAILY_LIMIT - serverDailyAds;
    if (dailyProgres < 0) dailyProgres = 0;
    if (progres) progres.textContent = dailyProgres;

    // If server provides lastAdTime, align client cooldown to it (defensive)
    if (res.lastAdTime) {
      try {
        const last = new Date(res.lastAdTime).getTime();
        if (!isNaN(last)) {
          lastAdTimestamp = last;
        }
      } catch (e) {}
    }

    // If server provides lastBoxTime, align box cooldown
    if (res.lastBoxTime) {
      try {
        const lastBoxMs = new Date(res.lastBoxTime).getTime();
        if (!isNaN(lastBoxMs)) {
          const diff = Date.now() - lastBoxMs;
          if (diff < BOX_COOLDOWN_MS) {
            startBoxCooldownFrom(lastBoxMs);
          } else {
            // ensure button shows OPEN
            if (openBoxBtn) openBoxBtn.textContent = "OPEN";
            boxCooldown = false;
            if (openBoxBtn) {
              openBoxBtn.style.pointerEvents = "";
              openBoxBtn.style.opacity = "";
            }
          }
        }
      } catch (e) {}
    }

  } else {
    console.warn("updateBalanceUI: getBalance failed:", res && res.error);
  }
}

/* =======================
   Update referral counts UI (pending & active)
   selectors match index.html structure:
   .refal .active.count span and .refal .pending.count span
======================= */
function updateReferralCountsUI(counts) {
  if (!counts) return;
  const activeEl = document.querySelector('.refal .active.count span');
  const pendingEl = document.querySelector('.refal .pending.count span');

  if (activeEl) activeEl.textContent = String(counts.active || 0);
  if (pendingEl) pendingEl.textContent = String(counts.pending || 0);
}

/* =======================
   Refresh referral counts from backend
   Calls API type "getReferrals" which returns { success, active, pending }
   fetchApi will attach USER_ID automatically if available.
======================= */
async function refreshReferralCounts() {
  try {
    const res = await fetchApi({ type: "getReferrals" });
    if (res && res.success) {
      updateReferralCountsUI({ active: res.active || 0, pending: res.pending || 0 });
    } else {
      // If no user or not authorized, show 0s
      updateReferralCountsUI({ active: 0, pending: 0 });
    }
  } catch (e) {
    console.warn("refreshReferralCounts failed:", e);
  }
}

/* =======================
   Referral polling: start/stop while on invite page
   Poll interval set to 30s (adjustable)
======================= */
let referralPoll = null;
const REFERRAL_POLL_INTERVAL = 30000; // 30s

function startReferralPolling() {
  // clear any existing
  if (referralPoll) clearInterval(referralPoll);
  // immediate refresh
  refreshReferralCounts();
  // set interval
  referralPoll = setInterval(refreshReferralCounts, REFERRAL_POLL_INTERVAL);
}

function stopReferralPolling() {
  if (referralPoll) {
    clearInterval(referralPoll);
    referralPoll = null;
  }
}

/* =======================
   Utility: استخراج قيمة start param بطريقة مرنة
   يمكن قراءة start_param من Telegram initDataUnsafe أو من URL (startapp, start)
   نتعامل مع حالات وجود حروف عربية ملصقة بعد الرقم مثل:
   https://...startapp=ref_7741750541رابط
   فنقوم باستخراج الرقم بعد ref_ فقط.
======================= */
function extractReferrerFromStartParam(raw) {
  if (!raw || typeof raw !== "string") return null;

  // Decode in case it's URI encoded
  try {
    raw = decodeURIComponent(raw);
  } catch (e) {}

  // Trim whitespace
  raw = raw.trim();

  // Look for patterns like "ref_7741750541" possibly followed by other chars
  const m = raw.match(/ref_([0-9]+)/i);
  if (m && m[1]) return m[1];

  // Also allow alphanumeric ids after ref_ (if your ids are not pure numeric)
  const m2 = raw.match(/ref_([A-Za-z0-9-_]+)/i);
  if (m2 && m2[1]) return m2[1];

  return null;
}

/* =======================
   Telegram WebApp User Data + referral (start params)
   عند الدخول نقرا start params ونخزن referrerId لإرساله أثناء syncUser
   كما نجلب عدد الدعوات ونحدّث واجهة invite
======================= */
document.addEventListener("DOMContentLoaded", async function () {

  // 1) Read start param from Telegram initDataUnsafe if present
  let startParam = null;
  try {
    if (typeof window.Telegram !== "undefined" && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
      const init = window.Telegram.WebApp.initDataUnsafe;
      // Telegram may provide start_param, start_payload, or start
      startParam = init.start_param || init.startpayload || init.start_payload || init.start || null;
    }
  } catch (e) {}

  // 2) Fallback: read from URL query (startapp or start)
  if (!startParam) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      startParam = urlParams.get('startapp') || urlParams.get('start') || urlParams.get('start_param') || null;
    } catch (e) {}
  }

  // 3) Extract referrer id robustly (handles cases like "...ref_7741750541رابط")
  let referrerId = extractReferrerFromStartParam(startParam);

  // 4) If still not found, also try to find "ref_<id>" anywhere in the full URL
  if (!referrerId) {
    try {
      const fullUrl = decodeURIComponent(window.location.href || "");
      const m = fullUrl.match(/ref_([0-9A-Za-z-_]+)/i);
      if (m && m[1]) referrerId = m[1];
    } catch (e) {}
  }

  // 5) Store referrerId locally so it can be attached later if user logs in after navigation
  if (referrerId) {
    try {
      localStorage.setItem('referrerId', String(referrerId));
    } catch (e) {}
  }

  // If Telegram WebApp present -> initialize and sync user (include referrer if available)
  if (typeof window.Telegram !== "undefined") {
    const tg = window.Telegram.WebApp;
    try { tg.ready(); } catch (e) {}
    try { tg.expand(); } catch (e) {}

    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
      const user = tg.initDataUnsafe.user;
      const userId = user.id;
      const firstName = user.first_name ? user.first_name : "";
      const photoUrl = user.photo_url ? user.photo_url : "";

      USER_ID = userId;

      // If we didn't get referrerId earlier from startParam, try localStorage (in case it was saved previously)
      if (!referrerId) {
        try {
          const stored = localStorage.getItem('referrerId');
          if (stored) referrerId = stored;
        } catch (e) {}
      }

      // Send syncUser including referrerId (may be null)
      await fetchApi({
        type: "syncUser",
        data: {
          id: userId,
          name: firstName,
          photo: photoUrl,
          referrerId: referrerId || null
        }
      });

      // After sync, clear stored referrer (optional)
      try { localStorage.removeItem('referrerId'); } catch (e) {}

      // Immediately fetch balance/stats to populate UI (do not wait long)
      const res = await fetchApi({ type: "getBalance" });
      if (res && res.success) {
        updateBalanceUI(res);
      } else {
        console.warn("Initial getBalance failed:", res && res.error);
      }

      // Also fetch referral counts so invite page reflects pending/active
      refreshReferralCounts();

      const userPhotoContainer = document.querySelector(".user-fhoto");
      const userNameContainer = document.querySelector(".user-name");

      if (photoUrl) {
        if (userPhotoContainer) {
          userPhotoContainer.innerHTML =
            '<img src="' + photoUrl + '" style="width:95px;height:95px;border-radius:50%;">';
        }
      } else {
        if (userPhotoContainer) {
          userPhotoContainer.innerHTML =
            '<div style="width:80px;height:80px;border-radius:50%;background:#444;color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px;">' +
            (firstName ? firstName.charAt(0) : "") +
            "</div>";
        }
      }

      if (userNameContainer) {
        userNameContainer.textContent = firstName;
      }

      // Update personal referral link shown to the user
      if (link && userId) {
        try {
          link.textContent =
            "https://t.me/Bot_ad_watchbot/earn?startapp=ref_" + userId;
        } catch (e) {}
      }
    } else {
      // If Telegram present but no user data, still refresh referrals if USER_ID exists
      if (USER_ID) refreshReferralCounts();
    }
  } else {
    // Not a Telegram WebApp visitor.
    // Keep referrerId in localStorage so it can be used when the user registers/logs in later.
    if (referrerId) {
      try {
        localStorage.setItem('referrerId', String(referrerId));
      } catch (e) {}
    }

    // Try to fetch balance for non-Telegram user if USER_ID exists (edge cases)
    if (USER_ID) {
      try {
        const res = await fetchApi({ type: "getBalance" });
        updateBalanceUI(res);
        refreshReferralCounts();
      } catch (e) {
        console.warn("Initial balance fetch failed:", e);
      }
    } else {
      // If user not logged in yet, still set invite UI to 0s
      updateReferralCountsUI({ active: 0, pending: 0 });
    }
  }

});

/* =======================
   Ensure balance is also fetched on full load (fallback)
   This makes sure balance is displayed even if DOMContentLoaded already fired earlier
   and corrects day rollover/progress display.
======================= */
window.addEventListener('load', async function() {
  try {
    const res = await fetchApi({ type: "getBalance" });
    updateBalanceUI(res);
    refreshReferralCounts();
  } catch (e) {
    console.warn("Load balance fetch failed:", e);
  }
});

let sendwithdraw = document.getElementById("request");

if (sendwithdraw) {
  sendwithdraw.addEventListener("click", function() {

    let coin = document.getElementById("coin").value;

    let now = new Date();

    // اليوم
    let day = now.getDate();

    // أسماء الأشهر
    let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let monthName = months[now.getMonth()];

    // ساعة ودقيقة بصيغة 2 أرقام
    let hours = String(now.getHours()).padStart(2, "0");
    let minutes = String(now.getMinutes()).padStart(2, "0");

    let formattedDate = `${day} ${monthName} ${hours}:${minutes}`;

    let historyCard = document.createElement("div");
    historyCard.className = 'history-card';

    let withdrawhistory = document.querySelector(".withdraw-history");

    historyCard.innerHTML = `
      <span class="date">${formattedDate}</span>
      <span class="amount">${coin}<img src="coins.png" width="17"></span>
      <span class="statu">pending</span>
    `;

    sendwithdraw.style.background = 'black';
    if (withdrawhistory) withdrawhistory.appendChild(historyCard);
    let withdrawnotifi = document.querySelector(".withdraw-notifi")

    if (withdrawnotifi) {
      withdrawnotifi.style.display = 'block'
      setTimeout(function(){
          withdrawnotifi.style.display = 'none'
      }, 2500)
    }

  });
}