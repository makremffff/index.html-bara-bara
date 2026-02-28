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

// Client-side global API call throttling: minimum 5 seconds between any fetchApi calls
const MIN_API_INTERVAL_MS = 5000;
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

  // If opened tasks page -> load tasks from server
  if (btnpage === taskPage) {
    loadTasks().catch(e => console.warn("loadTasks failed:", e));
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
      // show error to user via withdraw notification element (reuse as general notification)
      const withdrawnotifi = document.querySelector(".withdraw-notifi");
      if (withdrawnotifi) {
        withdrawnotifi.textContent = "Failed to fetch balance";
        withdrawnotifi.style.display = 'block';
        setTimeout(() => { withdrawnotifi.style.display = 'none'; }, 2500);
      }
    }

    // Load withdraw history when opening wallet
    await loadWithdrawHistory();
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
======================= */
const adsBtn     = document.getElementById("adsbtn");
const adsBtnn    = document.getElementById("adsbtnn");
const adsBalance = document.getElementById("adsbalance");
const adsNotfi   = document.getElementById("adsnotifi");
let progres = document.getElementById("progres");

let ADS   = 0;
let timer = null; // main ad countdown interval
let dailyLimit = null; // interval for long cooldowns
let dailyProgres = 100;
let progresLimit = 24 * 60 * 60;

// client-side cooldown in seconds (should be slightly less than server MIN to give responsive UX)
const MIN_CLIENT_AD_INTERVAL = 5; // changed to 5 seconds per request
let lastAdTimestamp = 0;

let adCooldown = false;
let adCooldownTime = 6000;

// Protect against double-claiming ad reward
let adRewardClaimed = false;

/* =======================
   Show single ad (general)
   - useGlobalCooldown: when true (default) this ad affects the global adCooldown used by the main reward button.
     When false the ad will be shown without changing global adCooldown (useful for box ads which shouldn't interfere).
   - Ensures it resolves to true/false and never throws
======================= */
function showSingleAd({ useGlobalCooldown = true } = {}) {
  return new Promise((resolve) => {
    try {
      if (useGlobalCooldown && adCooldown) {
        resolve(false);
        return;
      }

      if (useGlobalCooldown) adCooldown = true;

      if (AdsGramController && typeof AdsGramController.show === "function") {
        AdsGramController.show()
          .then(() => {
            setTimeout(function(){
              if (useGlobalCooldown) adCooldown = false;
              resolve(true);
            }, adCooldownTime);
          })
          .catch(() => {
            if (useGlobalCooldown) adCooldown = false;
            resolve(false);
          });
      } else {
        // fallback: simulate ad with timeouts
        setTimeout(function(){
          if (useGlobalCooldown) {
            setTimeout(function(){
              adCooldown = false;
            }, adCooldownTime);
          }
          resolve(true);
        }, 2000);
      }
    } catch (e) {
      if (useGlobalCooldown) adCooldown = false;
      resolve(false);
    }
  });
}

/* =======================
   Helper: play notification sound with robust fallback (element, created Audio, WebAudio)
   Ensures notification sound plays reliably when user finishes ad and receives reward.
======================= */
async function playNotificationSound() {
  try {
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

    // Fallback: small beep using WebAudio API
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
   Notification helper (single element)
   - Uses #adsnotifi element for both ad and box notifications.
   - Keeps the image (<img src="done.gif">) as in original design.
   - Avoids overlap by queuing the next notification if one is currently visible.
   - Ensures a given notification content is shown only once at a time.
======================= */
let notificationQueue = [];
let notificationShowing = false;

function showMainNotificationInner(htmlContent) {
  if (!adsNotfi) return;
  adsNotfi.innerHTML = htmlContent;
  adsNotfi.style.display = "block";
  adsNotfi.style.opacity = "0.9";
  adsNotfi.style.transform = "translateY(-150%)";

  // play sound
  playNotificationSound().catch(e => console.warn("Notification sound failed:", e));

  setTimeout(function () {
    try { adsNotfi.style.transform = "translateY(135px)"; } catch (e) {}
  }, 100);

  setTimeout(function () {
    try {
      adsNotfi.style.transform = "translateY(-150%)";
      adsNotfi.style.opacity = "0";
    } catch (e) {}
  }, 3000);

  setTimeout(function () {
    try { adsNotfi.style.display = "none"; } catch (e) {}
    try { adsNotfi.style.transform = ""; adsNotfi.style.opacity = ""; } catch (e) {}
    notificationShowing = false;
    // show next queued notification if any
    if (notificationQueue.length > 0) {
      const next = notificationQueue.shift();
      // small delay to avoid immediate flicker
      setTimeout(() => {
        notificationShowing = true;
        showMainNotificationInner(next);
      }, 120);
    }
  }, 3500);
}

function showMainNotification(htmlContent) {
  if (!adsNotfi) return;
  if (notificationShowing) {
    // queue it
    notificationQueue.push(htmlContent);
    return;
  }
  notificationShowing = true;
  showMainNotificationInner(htmlContent);
}

/* =======================
   Helper: show a box reward notification (text + image)
   Reuses the main ads notification element and preserves the image.
   Sets the notification content to "you get <amount> coin" plus the image (innerHTML).
   NOTE: Caller is responsible to ensure this is invoked once per box operation.
======================= */
function showBoxRewardNotification(amount) {
  const html = `you get ${amount} coin <img src="done.gif" width="40" height="40">`;
  showMainNotification(html);
}

/* =======================
   Reward button handler
   Fixed: avoid leaving adsBtnn with yellow background/countdown after successful reward.
         Ensure cleanup of any cooldown UI/intervals that could cause a second countdown.
   Additional protections:
   - prevent multiple timers
   - disable button immediately
   - ensure reward is claimed once
   - robust cleanup on errors
======================= */
if (adsBtn) {
  adsBtn.addEventListener("click", async function (evt) {

    // 0) Prevent double interval creation
    if (timer) return;

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

    // Ensure any previous background is cleared
    if (adsBtnn) adsBtnn.style.background = '';

    // Disable button to prevent duplicate submits / rapid clicks
    try {
      adsBtn.disabled = true;
      adsBtn.style.pointerEvents = 'none';
    } catch (e) {}

    adsBtn.style.display  = "none";
    if (adsBtnn) {
      adsBtnn.style.display = "block";
      adsBtnn.style.background = '';
    }

    let timeLeft = 50;
    if (adsBtnn) adsBtnn.textContent = timeLeft + "s";

    // clear any previous dailyLimit interval when starting new ad flow to avoid multiple intervals
    if (dailyLimit) {
      clearInterval(dailyLimit);
      dailyLimit = null;
    }

    // Reset claim guard
    adRewardClaimed = false;

    // create interval only if not present (guard at start ensures timer is null)
    timer = setInterval(async function () {
      try {
        // If timer got cleared elsewhere, exit
        if (!timer) return;

        timeLeft--;
        if (adsBtnn) adsBtnn.textContent = timeLeft + "s";

        if (timeLeft <= 0) {

          // Prevent double claiming due to races
          if (adRewardClaimed) {
            // cleanup just in case and return
            try { clearInterval(timer); } catch (e) {}
            timer = null;
            // Restore UI
            if (adsBtnn) {
              adsBtnn.style.display = "none";
              adsBtnn.style.background = '';
              adsBtnn.textContent = '';
            }
            try {
              adsBtn.style.display = 'block';
              adsBtn.disabled = false;
              adsBtn.style.pointerEvents = '';
            } catch (e) {}
            return;
          }

          adRewardClaimed = true;

          // Reward user (attach userId automatically via fetchApi)
          let res = null;
          try {
            res = await fetchApi({
              type: "rewardUser",
              data: { amount: 100 }
            });
          } catch (e) {
            console.warn("rewardUser threw:", e);
            res = { success: false, error: String(e) };
          }

          if (res && res.success) {
            ADS = Number(res.balance) || ADS;
            if (adsBalance) adsBalance.textContent = ADS;

            // update daily progress with server value
            const DAILY_LIMIT = 100;
            dailyProgres = DAILY_LIMIT - (Number(res.dailyAds) || 0);
            if (dailyProgres < 0) dailyProgres = 0;
            if (progres) progres.textContent = dailyProgres;

            // refresh referral counts in case this watch activated a referral
            refreshReferralCounts();

            // update client-side lastAdTimestamp to now (server returned lastAdTime but use local now)
            lastAdTimestamp = Date.now();

            // Clean up any leftover cooldown UI/intervals that could cause a second countdown
            if (dailyLimit) {
              clearInterval(dailyLimit);
              dailyLimit = null;
            }
            if (adsBtnn) {
              adsBtnn.style.background = '';
            }

            // UI feedback for success: play sound and show notification once
            try {
              await playNotificationSound();
            } catch (e) {
              console.warn("Notification sound play failed:", e);
            }
            const html = `ADS WATCHED <img src="done.gif" width="40" height="40">`;
            showMainNotification(html);

          } else {
            // handle errors (e.g., daily limit reached or server-side cooldown)
            console.warn("rewardUser failed:", res && res.error);
            const errText = (res && res.error) ? String(res.error).toLowerCase() : "";

            if (errText.includes("daily limit")) {
              // reflect limit in UI
              if (adsBtn) adsBtn.style.display = 'none';
              if (adsBtnn) {
                adsBtnn.style.display = "block";
                adsBtnn.textContent = progresLimit;
                adsBtnn.style.background = 'red';
              }
              // start cooldown countdown for the remaining day limit
              if (dailyLimit) clearInterval(dailyLimit);
              dailyLimit = setInterval(function(){
                progresLimit--;
                if (adsBtnn) adsBtnn.textContent = progresLimit;

                if (progresLimit <= 0) {
                  clearInterval(dailyLimit);
                  dailyLimit = null;

                  if (adsBtnn) {
                    adsBtnn.style.display = 'none';
                    adsBtnn.style.background = '';
                    adsBtnn.textContent = '';
                  }
                  if (adsBtn) {
                    adsBtn.style.display = 'block';
                    adsBtn.disabled = false;
                    adsBtn.style.pointerEvents = '';
                  }
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
              if (adsBtn) adsBtn.style.display = 'none';
              if (adsBtnn) {
                adsBtnn.style.display = 'block';
                adsBtnn.textContent = `${waitSec}s`;
                adsBtnn.style.background = 'orange';
              }

              let remaining = waitSec;
              if (dailyLimit) clearInterval(dailyLimit);
              dailyLimit = setInterval(function(){
                remaining--;
                if (adsBtnn) adsBtnn.textContent = `${remaining}s`;
                if (remaining <= 0) {
                  clearInterval(dailyLimit);
                  dailyLimit = null;
                  if (adsBtnn) {
                    adsBtnn.style.display = 'none';
                    adsBtnn.style.background = '';
                    adsBtnn.textContent = '';
                  }
                  if (adsBtn) {
                    adsBtn.style.display = 'block';
                    adsBtn.disabled = false;
                    adsBtn.style.pointerEvents = '';
                  }
                  if (progres) progres.textContent = dailyProgres;
                }
              }, 1000);
            } else {
              // generic failure feedback
              alert("Failed to claim ad reward: " + ((res && res.error) || "unknown error"));
            }
          }

          // Final cleanup for this ad operation
          try { clearInterval(timer); } catch (e) {}
          timer = null;

          // Make sure adsBtnn style/background are reset to avoid leftover yellow
          if (adsBtnn) {
            adsBtnn.style.display = "none";
            adsBtnn.style.background = '';
            adsBtnn.textContent = '';
          }

          try {
            adsBtn.style.display  = "block";
            adsBtn.disabled = false;
            adsBtn.style.pointerEvents = '';
          } catch (e) {}

          // if dailyProgres depleted, set long cooldown
          if (dailyProgres <= 0) {
            if (adsBtn) adsBtn.style.display = 'none';
            if (adsBtnn) {
              adsBtnn.style.display = 'block';
              adsBtnn.textContent = progresLimit;
              adsBtnn.style.background = 'red';
            }

            if (dailyLimit) clearInterval(dailyLimit);
            dailyLimit = setInterval(function(){

              progresLimit--;
              if (adsBtnn) adsBtnn.textContent = progresLimit;

              if (progresLimit <= 0) {
                clearInterval(dailyLimit);
                dailyLimit = null;

                if (adsBtnn) {
                  adsBtnn.style.display = 'none';
                  adsBtnn.style.background = '';
                  adsBtnn.textContent = '';
                }
                if (adsBtn) {
                  adsBtn.style.display = 'block';
                  adsBtn.disabled = false;
                  adsBtn.style.pointerEvents = '';
                }
                progresLimit = 24 * 60 * 60;
                dailyProgres = 100;
                if (progres) progres.textContent = dailyProgres;
              }

            }, 1000);
          }
        }
      } catch (e) {
        console.error("ads timer loop error:", e);
        try { clearInterval(timer); } catch (e2) {}
        timer = null;
        if (adsBtnn) {
          adsBtnn.style.display = "none";
          adsBtnn.style.background = '';
          adsBtnn.textContent = '';
        }
        try {
          adsBtn.style.display = 'block';
          adsBtn.disabled = false;
          adsBtn.style.pointerEvents = '';
        } catch (e3) {}
      }

    }, 1000);

    // Show the ad(s) — showSingleAd handles cooldowns itself
    // Keep these awaited separately; UI timer is running independently.
    try {
      await showSingleAd();
      await showSingleAd();
      await showSingleAd();
      await showSingleAd();
    } catch (e) {
      console.warn("showSingleAd sequence threw:", e);
    }

  });
}

/* =======================
   BOX (OPEN BOX) FEATURE
   - When user clicks OPEN -> show two ads (they don't affect main ad counter)
   - After ads complete award random reward (75|100|150|200) added to balance
   - After finishing disable open button for 5 minutes (countdown shown)
   - Show box notification by reusing the main notification element (text + image preserved)
   - Persist cooldown in localStorage to survive reloads.
   - Box ad displays do not interfere with main adCooldown (use useGlobalCooldown=false).
   - Make cooldown per-account (use USER_ID in key) so each account has independent timing.
   - When box ads finish, the main ads notification (#adsnotifi) will be shown with text "you get <amount> coin" and the image.
   - New: hidden 23s timer controlling when the notification is shown, ensuring single notification and clean cancellation on failure.
======================= */
const openBoxBtn = document.getElementById("openbox");
const BOX_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
let boxCooldownTimer = null;
let boxCooldownInterval = null;
const BOX_REWARDS = [75, 100, 150, 200];

// Hidden box notification timer and guards
let boxHiddenTimer = null; // as requested
let boxHiddenTimerExpired = false;
let boxNotificationShown = false;
let rewardPendingForBox = null;

function formatMsToMMSS(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function getBoxCooldownKey() {
  return USER_ID ? `boxCooldownUntil_${USER_ID}` : 'boxCooldownUntil';
}

function setOpenBoxDisabled(state, untilTs = null) {
  if (!openBoxBtn) return;
  const key = getBoxCooldownKey();
  if (state) {
    openBoxBtn.style.pointerEvents = 'none';
    openBoxBtn.style.opacity = '0.5';
    // store cooldown until timestamp for this account/key
    try {
      if (untilTs) localStorage.setItem(key, String(untilTs));
    } catch (e) {}
    // start interval to update text
    if (boxCooldownInterval) clearInterval(boxCooldownInterval);
    boxCooldownInterval = setInterval(function(){
      try {
        const stored = Number(localStorage.getItem(key) || 0);
        const remain = stored - Date.now();
        if (remain <= 0) {
          clearInterval(boxCooldownInterval);
          boxCooldownInterval = null;
          openBoxBtn.textContent = "OPEN";
          openBoxBtn.style.pointerEvents = '';
          openBoxBtn.style.opacity = '';
          try { localStorage.removeItem(key); } catch (e) {}
        } else {
          openBoxBtn.textContent = formatMsToMMSS(remain);
        }
      } catch (e) {
        console.error("box cooldown interval error:", e);
      }
    }, 1000);
  } else {
    openBoxBtn.style.pointerEvents = '';
    openBoxBtn.style.opacity = '';
    openBoxBtn.textContent = "OPEN";
    try { localStorage.removeItem(key); } catch (e) {}
    if (boxCooldownInterval) {
      clearInterval(boxCooldownInterval);
      boxCooldownInterval = null;
    }
  }
}

// Ensure dataset running initialized
if (openBoxBtn && typeof openBoxBtn.dataset.running === 'undefined') {
  openBoxBtn.dataset.running = "0";
  if (openBoxBtn.style) openBoxBtn.style.cursor = "pointer";
}

async function handleBoxClick(evt) {
  if (!openBoxBtn) return;
  // reject synthetic
  if (evt && typeof evt.isTrusted !== "undefined" && !evt.isTrusted) {
    console.warn("Ignored non-user initiated click (box)");
    return;
  }

  // Prevent multiple concurrent box operations
  if (boxHiddenTimer || openBoxBtn.dataset.running === "1") {
    // Already in progress, ignore
    return;
  }

  const key = getBoxCooldownKey();

  // check persistent cooldown
  try {
    const stored = Number(localStorage.getItem(key) || 0);
    if (stored && stored > Date.now()) {
      // still cooling
      return;
    }
  } catch (e) {}

  // Provide immediate UI feedback
  openBoxBtn.style.pointerEvents = 'none';
  openBoxBtn.style.opacity = '0.6';
  openBoxBtn.dataset.running = "1";

  // Clear existing hidden timer/state before starting
  if (boxHiddenTimer) {
    try { clearTimeout(boxHiddenTimer); } catch (e) {}
    boxHiddenTimer = null;
  }
  boxHiddenTimerExpired = false;
  boxNotificationShown = false;
  rewardPendingForBox = null;

  // Start hidden 23-second timer (do not show any notification before it expires)
  // Ensure single timer at a time
  if (boxHiddenTimer) {
    clearTimeout(boxHiddenTimer);
    boxHiddenTimer = null;
  }
  boxHiddenTimer = setTimeout(function() {
    boxHiddenTimer = null;
    boxHiddenTimerExpired = true;
    // If reward already ready and notification not yet shown -> show it now
    if (rewardPendingForBox != null && !boxNotificationShown) {
      boxNotificationShown = true;
      try {
        showBoxRewardNotification(rewardPendingForBox);
      } catch (e) {
        console.warn("Showing box notification failed:", e);
      }
      rewardPendingForBox = null;
    }
  }, 23000);

  // Show two ads that should NOT affect the main ad counters (useGlobalCooldown=false)
  let ad1 = false;
  let ad2 = false;
  try {
    ad1 = await showSingleAd({ useGlobalCooldown: false });
    ad2 = await showSingleAd({ useGlobalCooldown: false });
  } catch (e) {
    console.warn("Box ads threw:", e);
    ad1 = ad1 || false;
    ad2 = ad2 || false;
  }

  // If at least one ad failed, cancel hidden timer and restore button
  if (!ad1 || !ad2) {
    // cancel hidden notification timer
    if (boxHiddenTimer) {
      try { clearTimeout(boxHiddenTimer); } catch (e) {}
      boxHiddenTimer = null;
    }
    boxHiddenTimerExpired = false;
    boxNotificationShown = false;
    rewardPendingForBox = null;

    // restore button (short delay to avoid rapid retries)
    setTimeout(function(){
      openBoxBtn.style.pointerEvents = '';
      openBoxBtn.style.opacity = '';
      openBoxBtn.dataset.running = "0";
    }, 200);

    alert("Failed to show both ads. Please try again.");
    return;
  }

  // Both ads shown: award random reward
  const reward = BOX_REWARDS[Math.floor(Math.random() * BOX_REWARDS.length)];
  rewardPendingForBox = reward;

  // Try server-side reward (preferable). Backend may implement "rewardBox" to avoid counting toward ad counters.
  let res = null;
  try {
    res = await fetchApi({ type: "rewardBox", data: { amount: reward } });
    if (res && res.success) {
      // server returned updated balance
      ADS = Number(res.balance) || ADS;
    } else {
      // If server didn't support rewardBox, fallback to local UI update and attempt to call rewardUser as a best-effort
      try {
        const fallback = await fetchApi({ type: "rewardUser", data: { amount: reward, isBox: true } });
        if (fallback && fallback.success) {
          ADS = Number(fallback.balance) || ADS;
        } else {
          ADS = Number(ADS) + Number(reward);
        }
      } catch (e) {
        ADS = Number(ADS) + Number(reward);
      }
    }
  } catch (e) {
    ADS = Number(ADS) + Number(reward);
  }

  // Update UI
  if (adsBalance) adsBalance.textContent = ADS;
  if (walletbalance) {
    walletbalance.innerHTML = `
      <img src="coins.png" style="width:20px; vertical-align:middle;">
      ${ADS}
    `;
  }

  // If hidden timer already expired -> show notification immediately (but ensure only once)
  if (boxHiddenTimerExpired && !boxNotificationShown) {
    boxNotificationShown = true;
    try {
      showBoxRewardNotification(reward);
    } catch (e) {
      console.warn("box notification failed:", e);
    }
    // clear pending reward since shown
    rewardPendingForBox = null;
  } else {
    // Wait for timer to expire; when it does the setTimeout handler will show the notification
    // but ensure we do not schedule a second notify here.
  }

  // Start persistent cooldown for BOX_COOLDOWN_MS
  const until = Date.now() + BOX_COOLDOWN_MS;
  setOpenBoxDisabled(true, until);

  // Final cleanup: ensure we do not leave running flag set (cooldown manages pointerEvents)
  openBoxBtn.dataset.running = "0";
  openBoxBtn.style.pointerEvents = 'none';
  openBoxBtn.style.opacity = '0.5';

  // If hidden timer is null and notification still pending, show it now
  if (!boxHiddenTimer && rewardPendingForBox != null && !boxNotificationShown) {
    boxNotificationShown = true;
    try {
      showBoxRewardNotification(rewardPendingForBox);
    } catch (e) {
      console.warn("box notification (post) failed:", e);
    }
    rewardPendingForBox = null;
  }
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

    navigator.clipboard.writeText((link && link.textContent) ? link.textContent : "").then(function() {

      setTimeout(function(){
        if (copyImge) copyImge.src = 'copy.png';
        if (copyrefal) copyrefal.style.boxShadow = '0 5px 0 #7880D3';
      }, 800);

    }).catch((e) => {
      console.warn("copy failed:", e);
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

    // update daily progress with server value
    const DAILY_LIMIT = 100;
    dailyProgres = DAILY_LIMIT - (Number(res.dailyAds) || 0);
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

    // Also if res.balance provided, ensure local ADS updated
    if (typeof res.balance !== 'undefined') ADS = Number(res.balance) || ADS;
  } else {
    // show error in withdraw-notifi element
    const withdrawnotifi = document.querySelector(".withdraw-notifi");
    if (withdrawnotifi) {
      withdrawnotifi.textContent = "Failed to update balance";
      withdrawnotifi.style.display = 'block';
      setTimeout(() => { withdrawnotifi.style.display = 'none'; }, 2500);
    }
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
   Render referrals list into .my-refal
   Each referral card must use the existing class names:
   .refal-card, .refal-fhoto, .refal-name, .refal-ads, .refal-statu
   We will not change class names in the HTML as requested.
======================= */
function renderReferralsList(referrals) {
  const container = document.querySelector('.my-refal');
  if (!container) return;

  // Clear existing cards
  container.innerHTML = '';

  if (!Array.isArray(referrals) || referrals.length === 0) {
    // Optionally keep a placeholder card (or nothing)
    const noCard = document.createElement('div');
    noCard.className = 'refal-card';
    noCard.innerHTML = `
      <span class="refal-fhoto" style="display:inline-block;width:40px;height:40px;border-radius:50%;background:#ddd;vertical-align:middle;margin-right:8px;"></span>
      <span class="refal-name">No referrals</span>
      <span class="refal-ads">0 ADS</span>
      <span class="refal-statu">-</span>
    `;
    container.appendChild(noCard);
    return;
  }

  referrals.forEach(ref => {
    // Create card
    const card = document.createElement('div');
    card.className = 'refal-card';

    // Photo element: keep class .refal-fhoto
    const photoWrapper = document.createElement('span');
    photoWrapper.className = 'refal-fhoto';
    photoWrapper.style.display = 'inline-block';
    photoWrapper.style.verticalAlign = 'middle';
    photoWrapper.style.marginRight = '8px';

    if (ref.photo) {
      const img = document.createElement('img');
      img.src = ref.photo;
      img.alt = ref.name || 'User';
      img.style.width = '40px';
      img.style.height = '40px';
      img.style.borderRadius = '50%';
      img.style.objectFit = 'cover';
      photoWrapper.appendChild(img);
    } else {
      // fallback placeholder with initial
      const ph = document.createElement('div');
      ph.style.width = '40px';
      ph.style.height = '40px';
      ph.style.borderRadius = '50%';
      ph.style.background = '#666';
      ph.style.color = '#fff';
      ph.style.display = 'flex';
      ph.style.alignItems = 'center';
      ph.style.justifyContent = 'center';
      ph.style.fontSize = '16px';
      ph.textContent = ref.name ? String(ref.name).charAt(0).toUpperCase() : '?';
      photoWrapper.appendChild(ph);
    }

    // Name
    const nameEl = document.createElement('span');
    nameEl.className = 'refal-name';
    nameEl.style.marginRight = '8px';
    nameEl.style.verticalAlign = 'middle';
    nameEl.textContent = ref.name || `User ${ref.id || ''}`;

    // Ads count
    const adsEl = document.createElement('span');
    adsEl.className = 'refal-ads';
    adsEl.style.marginRight = '8px';
    adsEl.style.verticalAlign = 'middle';
    const adsCount = typeof ref.ads_watched !== 'undefined' ? Number(ref.ads_watched) : 0;
    adsEl.textContent = `${adsCount} ADS`;

    // Status
    const statusEl = document.createElement('span');
    statusEl.className = 'refal-statu';
    statusEl.style.verticalAlign = 'middle';
    statusEl.textContent = ref.referral_active ? 'ACTIVE' : 'PENDING';
    statusEl.style.color = ref.referral_active ? 'green' : '#b8860b';

    // Append to card in a layout similar to samples
    // Keep the order and class names as requested (photo, name, ads, status)
    card.appendChild(photoWrapper);
    card.appendChild(nameEl);
    card.appendChild(adsEl);
    card.appendChild(statusEl);

    container.appendChild(card);
  });
}

/* =======================
   Render tasks dynamically (requirements):
   - Fetch tasks from server (getTasks)
   - Do NOT create tasks manually in code
   - Use same classes as existing card (.task-card, .taskimg, .task-name, .task-prize, .task-link)
   - Button is the existing .task-link anchor
   - Clicking start opens link in new tab, marks started in localStorage and turns button to "check" with black background
   - Clicking check sends completeTask to server; server enforces idempotency and returns new balance
   - Upon successful claim, update balance in UI and set button to Done/disabled
======================= */
function getTaskStartedKey(taskId) {
  return USER_ID ? `taskStarted_${USER_ID}_${taskId}` : `taskStarted_guest_${taskId}`;
}
function getTaskCompletedKey(taskId) {
  return USER_ID ? `taskCompleted_${USER_ID}_${taskId}` : `taskCompleted_guest_${taskId}`;
}

function createTaskCard(task, completedIds = []) {
  const card = document.createElement('div');
  card.className = 'task-card';

  const img = document.createElement('img');
  img.className = 'taskimg';
  img.src = 'telegram.png';
  img.width = 25;

  const nameSpan = document.createElement('span');
  nameSpan.className = 'task-name';
  nameSpan.textContent = task.name || '';

  const prizeSpan = document.createElement('span');
  prizeSpan.className = 'task-prize';
  prizeSpan.innerHTML = `${task.reward || 0} <img src="coins.png" width="25">`;

  const linkA = document.createElement('a');
  linkA.className = 'task-link';
  linkA.href = task.link || '#';
  linkA.target = '_blank';
  linkA.rel = 'noopener noreferrer';
  linkA.style.cursor = 'pointer';

  // Determine initial state: completed (server) or started (local)
  const completedKey = getTaskCompletedKey(task.id);
  const startedKey = getTaskStartedKey(task.id);

  const isCompletedServer = Array.isArray(completedIds) && completedIds.indexOf(task.id) !== -1;
  const isCompletedLocal = localStorage.getItem(completedKey) === '1';
  const isStartedLocal = localStorage.getItem(startedKey) === '1';

  if (isCompletedServer || isCompletedLocal) {
    linkA.textContent = 'Done';
    // visually disabled: but keep class and element; ensure no navigation and no click
    linkA.style.pointerEvents = 'none';
    linkA.style.opacity = '0.6';
  } else if (isStartedLocal) {
    linkA.textContent = 'check';
    linkA.style.background = 'black';
    // keep clickable for check action
  } else {
    linkA.textContent = 'start';
  }

  // Click handler: respects the "start" -> open tab & mark started; "check" -> call server; "Done" -> noop
  linkA.addEventListener('click', async function (e) {
    const txt = (linkA.textContent || '').trim().toLowerCase();

    if (txt === 'start') {
      // allow default link opening in a new tab
      try {
        // mark started before navigation to ensure persisted state
        localStorage.setItem(startedKey, '1');
      } catch (err) {}
      // change UI to check immediately
      linkA.textContent = 'check';
      linkA.style.background = 'black';
      // Let the anchor open in new tab (target=_blank)
      return;
    }

    if (txt === 'check') {
      // prevent navigating the href
      e.preventDefault();
      // Disable multiple clicks
      linkA.style.pointerEvents = 'none';
      linkA.style.opacity = '0.7';

      try {
        const res = await fetchApi({
          type: "completeTask",
          data: { taskId: task.id }
        });

        if (res && res.success) {
          // mark completed locally
          try { localStorage.setItem(completedKey, '1'); } catch (err) {}
          // update balance UI if provided
          if (typeof res.balance !== 'undefined') {
            ADS = Number(res.balance) || ADS;
            if (adsBalance) adsBalance.textContent = ADS;
            if (walletbalance) {
              walletbalance.innerHTML = `
                <img src="coins.png" style="width:20px; vertical-align:middle;">
                ${ADS}
              `;
            }
          }
          // show success state
          linkA.textContent = 'Done';
          linkA.style.background = '';
          linkA.style.pointerEvents = 'none';
          linkA.style.opacity = '0.6';
        } else {
          // if server indicates already claimed, mark done
          const err = res && res.error ? String(res.error).toLowerCase() : '';
          if (err.includes('already') || err.includes('claimed') || err.includes('completed')) {
            try { localStorage.setItem(completedKey, '1'); } catch (err) {}
            linkA.textContent = 'Done';
            linkA.style.pointerEvents = 'none';
            linkA.style.opacity = '0.6';
          } else {
            // show error feedback and restore clickable state
            alert("Failed to complete task: " + ((res && res.error) || "Unknown error"));
            linkA.style.pointerEvents = '';
            linkA.style.opacity = '';
          }
        }
      } catch (e) {
        console.warn("completeTask call failed:", e);
        alert("Network error while verifying task. Please try again.");
        linkA.style.pointerEvents = '';
        linkA.style.opacity = '';
      }
      return;
    }

    // If text is 'done' or others -> prevent default and do nothing
    if (txt === 'done') {
      e.preventDefault();
      return;
    }
  });

  card.appendChild(img);
  card.appendChild(nameSpan);
  card.appendChild(prizeSpan);
  card.appendChild(linkA);

  return card;
}

async function loadTasks() {
  const container = document.querySelector('.task-container');
  if (!container) return;

  // Show simple loading placeholder (do not alter HTML structure)
  container.innerHTML = `<div class="task-card"><span class="task-name">Loading tasks...</span></div>`;

  try {
    const res = await fetchApi({ type: "getTasks", data: {} });
    // When user is logged in, fetchApi attaches USER_ID automatically

    if (res && res.success) {
      // server may return tasks and optionally completedTaskIds
      const tasks = Array.isArray(res.tasks) ? res.tasks : [];
      const completedIds = Array.isArray(res.completedTaskIds) ? res.completedTaskIds : [];

      // Clear container
      container.innerHTML = '';

      if (tasks.length === 0) {
        // keep a placeholder card indicating no tasks
        const noCard = document.createElement('div');
        noCard.className = 'task-card';
        noCard.innerHTML = `
          <img class="taskimg" src="telegram.png" width="25">
          <span class="task-name">No tasks available</span>
          <span class="task-prize">0 <img src="coins.png" width="25"></span>
          <a class="task-link" href="#" style="pointer-events:none;opacity:0.6">start</a>
        `;
        container.appendChild(noCard);
        return;
      }

      // Render tasks preserving classes and layout
      tasks.forEach(t => {
        // ensure required fields exist
        const task = {
          id: t.id,
          name: t.name,
          link: t.link,
          reward: t.reward
        };
        const card = createTaskCard(task, completedIds);
        container.appendChild(card);
      });

    } else {
      // On failure show message and keep container empty or placeholder
      container.innerHTML = `<div class="task-card"><span class="task-name">Failed to load tasks</span></div>`;
      console.warn("getTasks failed:", res && res.error);
    }
  } catch (e) {
    console.warn("loadTasks error:", e);
    container.innerHTML = `<div class="task-card"><span class="task-name">Failed to load tasks</span></div>`;
  }
}

/* =======================
   Update referral counts and list from backend
   Calls API type "getReferrals" which now returns { success, active, pending, referrals }
   fetchApi will attach USER_ID automatically if available.
======================= */
async function refreshReferralCounts() {
  try {
    const res = await fetchApi({ type: "getReferrals" });
    if (res && res.success) {
      updateReferralCountsUI({ active: res.active || 0, pending: res.pending || 0 });
      renderReferralsList(res.referrals || []);
    } else {
      // If no user or not authorized, show 0s and empty list
      updateReferralCountsUI({ active: 0, pending: 0 });
      renderReferralsList([]);
      console.warn("getReferrals failed:", res && res.error);
    }
  } catch (e) {
    console.warn("refreshReferralCounts failed:", e);
    updateReferralCountsUI({ active: 0, pending: 0 });
    renderReferralsList([]);
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
   Balance polling: keep balance UI updated regularly
   Poll interval set to 30s (adjustable). Always running.
======================= */
let balancePoll = null;
const BALANCE_POLL_INTERVAL = 30000;

function startBalancePolling() {
  if (balancePoll) clearInterval(balancePoll);
  // immediate fetch
  (async () => {
    try {
      const res = await fetchApi({ type: "getBalance" });
      updateBalanceUI(res);
    } catch (e) {
      console.warn("startBalancePolling initial fetch failed:", e);
    }
  })();
  balancePoll = setInterval(async function() {
    try {
      const res = await fetchApi({ type: "getBalance" });
      updateBalanceUI(res);
    } catch (e) {
      console.warn("balance poll failed:", e);
    }
  }, BALANCE_POLL_INTERVAL);
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
   Withdraw history rendering + loader
======================= */
function formatCreatedAt(createdAt) {
  try {
    const dt = new Date(createdAt);
    if (isNaN(dt.getTime())) return createdAt;
    const day = dt.getDate();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthName = months[dt.getMonth()];
    const hours = String(dt.getHours()).padStart(2,"0");
    const minutes = String(dt.getMinutes()).padStart(2,"0");
    return `${day} ${monthName} ${hours}:${minutes}`;
  } catch (e) {
    return createdAt;
  }
}

function renderWithdrawHistory(withdraws) {
  const container = document.querySelector(".withdraw-history");
  if (!container) return;
  container.innerHTML = "";

  if (!Array.isArray(withdraws) || withdraws.length === 0) {
    const emptyCard = document.createElement("div");
    emptyCard.className = "history-card";
    emptyCard.innerHTML = `
      <span class="date">-</span>
      <span class="amount">0<img src="coins.png" width="17"></span>
      <span class="statu">No withdraws</span>
    `;
    container.appendChild(emptyCard);
    return;
  }

  withdraws.forEach(w => {
    const card = document.createElement("div");
    card.className = "history-card";
    card.dataset.withdrawId = w.id || "";

    const dateText = w.created_at ? formatCreatedAt(w.created_at) : "-";
    const amountText = `${w.amount || 0}<img src="coins.png" width="17">`;
    const statusText = w.status ? String(w.status) : "pending";

    card.innerHTML = `
      <span class="date">${dateText}</span>
      <span class="amount">${amountText}</span>
      <span class="statu">${statusText}</span>
    `;
    container.appendChild(card);
  });
}

async function loadWithdrawHistory() {
  const withdrawnotifi = document.querySelector(".withdraw-notifi");
  try {
    const res = await fetchApi({ type: "getWithdraws" });
    if (res && res.success) {
      renderWithdrawHistory(res.withdraws || []);
    } else {
      // show message to user
      if (withdrawnotifi) {
        withdrawnotifi.textContent = "Failed to load withdraw history";
        withdrawnotifi.style.display = 'block';
        setTimeout(() => { withdrawnotifi.style.display = 'none'; }, 2500);
      }
      renderWithdrawHistory([]);
    }
  } catch (e) {
    if (withdrawnotifi) {
      withdrawnotifi.textContent = "Failed to load withdraw history";
      withdrawnotifi.style.display = 'block';
      setTimeout(() => { withdrawnotifi.style.display = 'none'; }, 2500);
    }
    renderWithdrawHistory([]);
  }
}

/* =======================
   Telegram WebApp User Data + referral (start params)
   عند الدخول نقرا start params ونخزن referrerId لإرساله أثناء syncUser
   كما نجلب عدد الدعوات ونحدّث واجهة invite
======================= */
document.addEventListener("DOMContentLoaded", async function () {

  // Start balance polling always (keeps UI updated)
  startBalancePolling();

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

      // Immediately fetch balance/stats to populate UI
      const res = await fetchApi({ type: "getBalance" });
      if (res && res.success) {
        updateBalanceUI(res);
      } else {
        const withdrawnotifi = document.querySelector(".withdraw-notifi");
        if (withdrawnotifi) {
          withdrawnotifi.textContent = "Failed to fetch initial balance";
          withdrawnotifi.style.display = 'block';
          setTimeout(() => { withdrawnotifi.style.display = 'none'; }, 2500);
        }
      }

      // Also fetch referral counts and list so invite page reflects pending/active
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

      // Load withdraw history after sync
      await loadWithdrawHistory();
    } else {
      // If Telegram present but no user data, still refresh referrals if USER_ID exists
      if (USER_ID) {
        refreshReferralCounts();
        await loadWithdrawHistory();
      }
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
        await loadWithdrawHistory();
      } catch (e) {
        console.warn("Initial balance fetch failed:", e);
      }
    } else {
      // If user not logged in yet, still set invite UI to 0s
      updateReferralCountsUI({ active: 0, pending: 0 });
      renderReferralsList([]);
      renderWithdrawHistory([]); // show empty history until login
    }
  }

  // Initialize OPEN BOX cooldown state from localStorage (if present)
  try {
    const key = getBoxCooldownKey();
    const stored = Number(localStorage.getItem(key) || 0);
    if (stored && stored > Date.now()) {
      setOpenBoxDisabled(true, stored);
    } else {
      // cleanup any stale
      try { localStorage.removeItem(key); } catch (e) {}
      setOpenBoxDisabled(false, null);
    }
  } catch (e) {
    console.warn("Failed to initialize box cooldown from storage:", e);
  }

  // Attach box click listener
  if (openBoxBtn) {
    openBoxBtn.style.cursor = "pointer";
    openBoxBtn.addEventListener("click", handleBoxClick);
  }
});

/* =======================
   Ensure balance is also fetched on full load (fallback)
   This makes sure balance is displayed even if DOMContentLoaded already fired earlier
   Also start polling for balance if not already started.
======================= */
window.addEventListener('load', async function() {
  try {
    const res = await fetchApi({ type: "getBalance" });
    updateBalanceUI(res);
    refreshReferralCounts();
    await loadWithdrawHistory();
  } catch (e) {
    console.warn("Load balance fetch failed:", e);
  }

  // ensure polling active
  if (!balancePoll) startBalancePolling();
});

let sendwithdraw = document.getElementById("request");

if (sendwithdraw) {
  sendwithdraw.addEventListener("click", async function() {

    // Read input values
    let coinInput = document.getElementById("coin");
    let emailInput = document.getElementById("email");
    let coin = coinInput ? Number(coinInput.value) : 0;
    let destination = emailInput ? String(emailInput.value).trim() : null;

    const MIN_WITHDRAW = 300;
    let withdrawnotifi = document.querySelector(".withdraw-notifi");

    // Basic validation
    if (!coin || isNaN(coin)) {
      if (withdrawnotifi) {
        withdrawnotifi.textContent = `Please enter a valid amount`;
        withdrawnotifi.style.display = "block";
        setTimeout(() => { withdrawnotifi.style.display = 'none'; }, 2500);
      } else {
        alert("Please enter a valid amount");
      }
      return;
    }

    // Fetch the latest balance from server to be safe
    let balanceRes = null;
    try {
      balanceRes = await fetchApi({ type: "getBalance" });
    } catch (e) {
      console.warn("Failed to fetch balance before withdraw:", e);
    }

    let currentBalance = ADS;
    if (balanceRes && balanceRes.success) {
      currentBalance = Number(balanceRes.balance) || currentBalance;
    }

    // Check minimum and sufficient balance
    if (coin < MIN_WITHDRAW) {
      if (withdrawnotifi) {
        withdrawnotifi.textContent = `Minimum withdraw is ${MIN_WITHDRAW} coins`;
        withdrawnotifi.style.display = "block";
        setTimeout(() => { withdrawnotifi.style.display = 'none'; }, 2500);
      }
      return;
    }

    if (coin > currentBalance) {
      if (withdrawnotifi) {
        withdrawnotifi.textContent = `Insufficient balance`;
        withdrawnotifi.style.display = "block";
        setTimeout(() => { withdrawnotifi.style.display = 'none'; }, 2500);
      }
      return;
    }

    // Disable button to prevent duplicate submits
    sendwithdraw.disabled = true;
    sendwithdraw.style.opacity = '0.6';

    // Optimistic UI: insert a temporary pending history card to make send feel faster
    let withdrawhistory = document.querySelector(".withdraw-history");
    let tempId = `temp_${Date.now()}`;
    let now = new Date();
    let day = now.getDate();
    let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let monthName = months[now.getMonth()];
    let hours = String(now.getHours()).padStart(2, "0");
    let minutes = String(now.getMinutes()).padStart(2, "0");
    let formattedDate = `${day} ${monthName} ${hours}:${minutes}`;

    let tempCard = document.createElement("div");
    tempCard.className = 'history-card';
    tempCard.id = tempId;
    tempCard.innerHTML = `
      <span class="date">${formattedDate}</span>
      <span class="amount">${coin}<img src="coins.png" width="17"></span>
      <span class="statu">pending</span>
    `;

    if (withdrawhistory) {
      withdrawhistory.insertBefore(tempCard, withdrawhistory.firstChild);
    }

    // Show notification quickly (English)
    if (withdrawnotifi) {
      withdrawnotifi.textContent = "Sending withdraw request...";
      withdrawnotifi.style.display = 'block';
    }

    // Attempt to create withdraw on server
    try {
      const res = await fetchApi({
        type: "createWithdraw",
        data: {
          amount: coin,
          destination: destination || null
          // userId will be attached automatically by fetchApi if USER_ID available
        }
      });

      if (res && res.success) {
        // Update ADS and UI with returned balance if present
        if (typeof res.balance !== 'undefined') {
          ADS = Number(res.balance) || ADS;
          if (adsBalance) adsBalance.textContent = ADS;
          if (walletbalance) {
            walletbalance.innerHTML = `
              <img src="coins.png" style="width:20px; vertical-align:middle;">
              ${ADS}
            `;
          }
        } else {
          // Fallback decrement locally
          ADS = Number(ADS) - Number(coin);
          if (adsBalance) adsBalance.textContent = ADS;
          if (walletbalance) {
            walletbalance.innerHTML = `
              <img src="coins.png" style="width:20px; vertical-align:middle;">
              ${ADS}
            `;
          }
        }

        // Remove temp card and insert server-provided card (most accurate)
        if (tempCard && tempCard.parentNode) {
          tempCard.parentNode.removeChild(tempCard);
        }

        let created = res.withdraw || null;
        let createdDate = formattedDate;
        let statusText = "pending";
        if (created && created.created_at) {
          createdDate = formatCreatedAt(created.created_at);
        }
        if (created && created.status) {
          statusText = created.status;
        }

        let historyCard = document.createElement("div");
        historyCard.className = 'history-card';
        historyCard.dataset.withdrawId = created && created.id ? created.id : "";
        historyCard.innerHTML = `
          <span class="date">${createdDate}</span>
          <span class="amount">${coin}<img src="coins.png" width="17"></span>
          <span class="statu">${statusText}</span>
        `;

        if (withdrawhistory) {
          withdrawhistory.insertBefore(historyCard, withdrawhistory.firstChild);
        }

        // Show success notification in English
        if (withdrawnotifi) {
          withdrawnotifi.textContent = "Withdraw request sent";
          withdrawnotifi.style.display = 'block';
          setTimeout(function(){
            withdrawnotifi.style.display = 'none';
          }, 2500);
        }

        // Clear inputs
        if (coinInput) coinInput.value = '';
        if (emailInput) emailInput.value = '';

      } else {
        // Server returned failure. Update temp card to failed and show error notification.
        if (tempCard) {
          const statuEl = tempCard.querySelector(".statu");
          if (statuEl) statuEl.textContent = "failed";
        }

        const err = res && res.error ? res.error : "Unknown error during withdraw";
        if (withdrawnotifi) {
          withdrawnotifi.textContent = `Withdraw failed: ${err}`;
          withdrawnotifi.style.display = 'block';
          setTimeout(function(){
            withdrawnotifi.style.display = 'none';
          }, 4000);
        }
      }
    } catch (e) {
      // Network or unexpected error
      if (tempCard) {
        const statuEl = tempCard.querySelector(".statu");
        if (statuEl) statuEl.textContent = "failed";
      }
      if (withdrawnotifi) {
        withdrawnotifi.textContent = `Withdraw error`;
        withdrawnotifi.style.display = 'block';
        setTimeout(function(){
          withdrawnotifi.style.display = 'none';
        }, 4000);
      }
      console.error("createWithdraw threw:", e);
    } finally {
      // restore button
      sendwithdraw.disabled = false;
      sendwithdraw.style.opacity = '';

      // Refresh history from server to ensure accurate state (non-blocking)
      try { loadWithdrawHistory(); } catch (e) {}
    }

  });
}

// Play background music on first click (defensive)
document.addEventListener("click", function () {
  try {
    const music = document.getElementById("bg-music");
    if (music && typeof music.play === "function") {
      music.play().catch(() => {});
    }
  } catch (e) {}
});