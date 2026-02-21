/* =======================
   Main script.js - Corrected and unified
   - Fixes initial balance loading
   - Ensures getBalance is called after syncUser
   - Updates all balance UI elements consistently
   - Prevents variable name collisions
   - Always attaches Telegram userId to API calls (persists to localStorage)
   - Keeps all original features (ads, tasks, copy referral, etc.)
======================= */

/* =======================
   Config / State
======================= */
const API_ENDPOINT = "/api";
let USER_ID = null; // Telegram user id (persisted to localStorage when available)

let state = {
  balance: 0,          // numeric user balance
  dailyAdsServer: 0,   // value returned by server for today's ads count/usage
  dailyProgress: 100,  // UI remaining daily (computed)
  adCooldown: false,
  adCooldownTime: 6000,
  progresLimit: 24 * 60 * 60,
  progresCountdownInterval: null,
  dailyLimitInterval: null
};

/* =======================
   DOM elements (queried once)
   Note: keep ids/classes matching your HTML
======================= */

/* Navigation buttons */
const btnMain     = document.querySelector("button");
const btnTask     = document.getElementById("btn2");
const btnWallet   = document.getElementById("btn3");
const btnShare    = document.getElementById("sharebtn");
const btnAddTask  = document.getElementById("addtask");

/* Pages */
const mainPage    = document.getElementById("main");
const taskPage    = document.getElementById("task");
const walletPage  = document.getElementById("wallet");
const sharePage   = document.getElementById("share");
const addTaskPage = document.getElementById("addTask");

/* Loading + page name */
const loadPageEl  = document.getElementById("loading");
const pageNameEl  = document.getElementById("page-load");
const barbtn      = document.querySelector(".bar");

/* Balance display elements (multiple places) */
const elUserBalance   = document.querySelector(".user-balance");      // main page user-balance
const elWalletBalance = document.getElementById("adsbalancce");      // wallet balance (keeps the original id)
const elAdsBalance    = document.getElementById("adsbalance");       // another balance element
const elAdsNotifi     = document.getElementById("adsnotifi");
const elProgres       = document.getElementById("progres");          // daily remaining

/* Sounds */
const soundBtn   = document.getElementById("soundbtn");
const soundAds   = document.getElementById("soundads");

/* Ads buttons */
const adsBtn      = document.getElementById("adsbtn");
const adsBtnTimer = document.getElementById("adsbtnn");

/* Ads controller (external SDK) */
let AdsGramController = null;
if (window.Adsgram && typeof window.Adsgram.init === "function") {
  AdsGramController = window.Adsgram.init({ blockId: "int-20679" });
}

/* Misc UI */
const copyReferralBtn = document.getElementById("copy");
const referralLinkEl   = document.getElementById("link");
const copyImgEl        = document.getElementById("copyImg");
const copyNotifiEl     = document.querySelector(".copynotifi");
const createTaskBtn    = document.getElementById("creatTask");
const menubtn          = document.querySelector(".menub");

/* =======================
   Utility: persist / restore USER_ID
======================= */
(function restoreUserIdFromStorage() {
  try {
    const stored = localStorage.getItem("tg_user_id");
    if (stored) {
      USER_ID = stored;
    }
  } catch (e) {
    // ignore storage errors
  }
})();

function persistUserId(id) {
  try {
    localStorage.setItem("tg_user_id", String(id));
  } catch (e) {
    // ignore
  }
}

/* =======================
   API helper - always attach userId when available
======================= */
async function fetchApi({ type, data = {} }) {
  try {
    // ensure we do not mutate caller's object
    const payloadData = Object.assign({}, data);

    if (!payloadData.userId && USER_ID) {
      payloadData.userId = USER_ID;
    }

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data: payloadData })
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
   Balance UI updater (single source-of-truth)
   - Call this whenever you get a new balance/dailyAds from server
======================= */
function updateBalancesUI(serverBalance = null, serverDailyAds = null) {
  if (serverBalance !== null) {
    state.balance = Number(serverBalance) || 0;
  }
  if (serverDailyAds !== null) {
    state.dailyAdsServer = Number(serverDailyAds) || 0;
  }

  // compute daily progress (matching existing logic)
  const DAILY_LIMIT = 100;
  state.dailyProgress = DAILY_LIMIT - (Number(state.dailyAdsServer) || 0);
  if (state.dailyProgress < 0) state.dailyProgress = 0;

  // Update user-visible balance elements (use safe checks)
  const coinImgHTML = '<img src="coins.png" style="width:20px; vertical-align:middle;">';

  if (elUserBalance) {
    // small inline version or full text depending on markup
    elUserBalance.innerHTML = `${coinImgHTML} ${state.balance}`;
  }
  if (elWalletBalance) {
    elWalletBalance.innerHTML = `${coinImgHTML} ${state.balance}`;
  }
  if (elAdsBalance) {
    elAdsBalance.textContent = state.balance;
  }
  if (elProgres) {
    elProgres.textContent = state.dailyProgress;
  }
}

/* =======================
   Request a fresh balance from server
   Returns the server response object for extra handling
======================= */
async function refreshBalance() {
  const res = await fetchApi({ type: "getBalance" });
  if (res && res.success) {
    // Expect server to return { success: true, balance: number, dailyAds: number }
    updateBalancesUI(res.balance, res.dailyAds);
  } else {
    console.warn("getBalance failed:", res ? res.error : "no response");
  }
  return res;
}

/* =======================
   Show page utility (hide others)
======================= */
function showPage(pageEl) {
  // hide all pages if they exist
  const pages = [mainPage, taskPage, walletPage, sharePage, addTaskPage];
  pages.forEach(p => { if (p) p.style.display = "none"; });

  if (pageEl) pageEl.style.display = "block";

  // loading UX
  if (loadPageEl) loadPageEl.style.display = "block";
  if (pageNameEl) pageNameEl.textContent = "Loading";
  if (barbtn) barbtn.style.display = 'none';

  setTimeout(() => {
    if (barbtn) barbtn.style.display = 'block';
  }, 2000);

  if (soundBtn) {
    try {
      soundBtn.currentTime = 0;
      soundBtn.play();
    } catch (e) { /* ignore play errors */ }
  }

  setTimeout(() => {
    if (loadPageEl) loadPageEl.style.display = "none";
  }, 2000);
}

/* =======================
   Ads: helper to show a single ad respecting cooldown
======================= */
function showSingleAd() {
  return new Promise((resolve) => {
    if (state.adCooldown) {
      resolve(false);
      return;
    }

    state.adCooldown = true;

    const finish = (success) => {
      // release cooldown after configured time
      setTimeout(() => {
        state.adCooldown = false;
      }, state.adCooldownTime);
      resolve(success);
    };

    if (AdsGramController && typeof AdsGramController.show === "function") {
      AdsGramController.show()
        .then(() => finish(true))
        .catch(() => finish(false));
    } else {
      // fallback fake ad (simulate delay)
      setTimeout(() => finish(true), 2000);
    }
  });
}

/* =======================
   Ads button handler (watch ad -> reward)
   Preserves the original flow but uses refreshBalance/updateBalancesUI
======================= */
if (adsBtn) {
  adsBtn.addEventListener("click", async function () {
    if (state.adCooldown) return;

    if (adsBtn) adsBtn.style.display = "none";
    if (adsBtnTimer) {
      adsBtnTimer.style.display = "block";
      let timeLeft = 50;
      adsBtnTimer.textContent = timeLeft + "s";

      // start visual countdown for the timer button
      const localTimer = setInterval(async function () {
        timeLeft--;
        if (adsBtnTimer) adsBtnTimer.textContent = timeLeft + "s";

        if (timeLeft <= 0) {
          clearInterval(localTimer);

          // reward the user on the server
          const res = await fetchApi({ type: "rewardUser", data: { amount: 100 } });

          if (res && res.success) {
            // server returned updated balance/dailyAds ideally
            updateBalancesUI(res.balance, res.dailyAds);

            // try to play ad success sound
            try { if (soundAds) { soundAds.currentTime = 0; soundAds.play(); } } catch (e) {}
          } else {
            console.warn("rewardUser failed:", res ? res.error : "no response");

            // If server indicates daily limit reached, show long cooldown
            if (res && res.error && String(res.error).toLowerCase().includes("daily limit")) {
              // switch to big countdown UI
              if (adsBtn) adsBtn.style.display = 'none';
              if (adsBtnTimer) {
                adsBtnTimer.style.display = 'block';
                adsBtnTimer.style.background = 'red';
              }

              // start a countdown to reset daily limit (fallback)
              state.progresLimit = state.progresLimit || (24 * 60 * 60);
              if (state.dailyLimitInterval) clearInterval(state.dailyLimitInterval);
              state.dailyLimitInterval = setInterval(function () {
                state.progresLimit--;
                if (adsBtnTimer) adsBtnTimer.textContent = state.progresLimit;
                if (state.progresLimit <= 0) {
                  clearInterval(state.dailyLimitInterval);
                  if (adsBtnTimer) {
                    adsBtnTimer.style.display = 'none';
                    adsBtnTimer.style.background = '';
                  }
                  if (adsBtn) adsBtn.style.display = 'block';
                  state.progresLimit = 24 * 60 * 60;
                  updateBalancesUI(null, 0); // reset progress
                }
              }, 1000);
            }
          }

          // show small notification animation even on success
          if (elAdsNotifi) {
            elAdsNotifi.style.display = "block";
            elAdsNotifi.style.opacity = "0.8";

            setTimeout(() => { if (elAdsNotifi) elAdsNotifi.style.opacity = "0.4"; }, 2500);

            elAdsNotifi.style.transform = "translateY(-150%)";
            setTimeout(() => { if (elAdsNotifi) elAdsNotifi.style.transform = "translateY(135px)"; }, 100);

            setTimeout(() => {
              if (elAdsNotifi) {
                elAdsNotifi.style.transform = "translateY(-150%)";
                elAdsNotifi.style.opacity = "0";
              }
            }, 3000);

            setTimeout(() => {
              if (elAdsNotifi) {
                elAdsNotifi.style.display = "none";
                elAdsNotifi.style.transform = "";
                elAdsNotifi.style.opacity = "";
              }
            }, 3500);
          }

          // reset UI after reward flow
          if (adsBtnTimer) {
            adsBtnTimer.style.display = "none";
            adsBtnTimer.style.background = '';
          }
          if (adsBtn) adsBtn.style.display = "block";

          // ensure daily progress and large cooldown application
          if (state.dailyProgress <= 0) {
            // same large cooldown as above (if needed)
            if (adsBtn) adsBtn.style.display = 'none';
            if (adsBtnTimer) {
              adsBtnTimer.style.display = 'block';
              adsBtnTimer.style.background = 'red';
              state.progresLimit = state.progresLimit || (24 * 60 * 60);
              if (state.dailyLimitInterval) clearInterval(state.dailyLimitInterval);
              state.dailyLimitInterval = setInterval(function () {
                state.progresLimit--;
                if (adsBtnTimer) adsBtnTimer.textContent = state.progresLimit;
                if (state.progresLimit <= 0) {
                  clearInterval(state.dailyLimitInterval);
                  if (adsBtnTimer) {
                    adsBtnTimer.style.display = 'none';
                    adsBtnTimer.style.background = '';
                  }
                  if (adsBtn) adsBtn.style.display = 'block';
                  state.progresLimit = 24 * 60 * 60;
                  updateBalancesUI(null, 0);
                }
              }, 1000);
            }
          }
        }
      }, 1000);
    }

    // Show actual ads (we keep original multiple show logic)
    await showSingleAd();
    await showSingleAd();
    await showSingleAd();
    await showSingleAd();
  });
}

/* =======================
   Page navigation bindings
======================= */
if (btnMain) {
  btnMain.addEventListener("click", () => showPage(mainPage));
}
if (btnTask) {
  btnTask.addEventListener("click", () => showPage(taskPage));
}
if (btnWallet) {
  btnWallet.addEventListener("click", async () => {
    showPage(walletPage);

    // fetch fresh balances for wallet view
    await refreshBalance();
  });
}
if (btnShare) {
  btnShare.addEventListener("click", () => showPage(sharePage));
}
if (btnAddTask) {
  btnAddTask.addEventListener("click", () => showPage(addTaskPage));
}

/* =======================
   Copy referral
======================= */
if (copyReferralBtn) {
  copyReferralBtn.addEventListener("click", function () {
    if (copyImgEl) copyImgEl.src = 'https://files.catbox.moe/cr5q08.png';
    if (copyNotifiEl) {
      copyNotifiEl.style.display = 'block';
      copyNotifiEl.style.top = '-48%';
    }
    if (copyReferralBtn) copyReferralBtn.style.boxShadow = '0 0px 0 #EBEBF0';

    setTimeout(function () {
      if (copyNotifiEl) {
        copyNotifiEl.style.display = 'none';
        copyNotifiEl.style.top = '';
      }
    }, 2000);

    navigator.clipboard && navigator.clipboard.writeText && navigator.clipboard.writeText(referralLinkEl ? referralLinkEl.textContent : "")
      .then(function () {
        setTimeout(function () {
          if (copyImgEl) copyImgEl.src = 'copy.png';
          if (copyReferralBtn) copyReferralBtn.style.boxShadow = '0 5px 0 #7880D3';
        }, 800);
      })
      .catch(() => {
        // fallback: do nothing
      });
  });
}

/* =======================
   Create task (add new task)
======================= */
if (createTaskBtn) {
  createTaskBtn.addEventListener("click", async function () {
    const nameEl = document.getElementById("taskNameInput");
    const linkEl = document.getElementById("taskLinkInput");
    const nametask = nameEl ? nameEl.value.trim() : "";
    const linktask = linkEl ? linkEl.value.trim() : "";

    if (!nametask || !linktask) {
      alert("Please enter task name and link");
      return;
    }

    const res = await fetchApi({
      type: "createTask",
      data: { name: nametask, link: linktask }
    });

    if (res && res.success) {
      const taskContainer = document.querySelector(".task-container");
      const taskCard = document.createElement("div");
      taskCard.className = "task-card";

      taskCard.innerHTML = `
        <span class="task-name">${escapeHtml(nametask)}</span>
        <span class="task-prize">30 <img src="coins.png" width="25"></span>
        <a class="task-link" href="${escapeAttribute(linktask)}">start</a>
      `;

      if (taskContainer) taskContainer.appendChild(taskCard);

      if (nameEl) nameEl.value = '';
      if (linkEl) linkEl.value = '';
    } else {
      console.warn("createTask failed:", res ? res.error : "no response");
      alert("Failed to create task: " + (res && res.error ? res.error : "unknown"));
    }
  });
}

/* helper to avoid XSS in inserted HTML (simple) */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttribute(str) {
  if (!str) return "";
  return String(str)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* =======================
   Initial loading UI behavior (kept original timings)
======================= */
if (loadPageEl) loadPageEl.style.display = "block";
if (pageNameEl) pageNameEl.style.display = "none";

setTimeout(function () {
  if (loadPageEl) {
    loadPageEl.style.display = "none";
    loadPageEl.style.background = "black";
  }
  if (pageNameEl) pageNameEl.style.display = "block";
}, 8000);

if (menubtn) menubtn.style.display = 'none';
setTimeout(function () {
  if (menubtn) menubtn.style.display = 'flex';
}, 8100);

/* =======================
   Telegram WebApp integration + initial sync
   Ensures:
   - USER_ID is set and persisted
   - syncUser is awaited
   - getBalance is called immediately after syncUser
   - updates referral link and profile UI
======================= */
document.addEventListener("DOMContentLoaded", async function () {
  // If Telegram WebApp exists, integrate and sync
  if (typeof window.Telegram !== "undefined" && window.Telegram.WebApp) {
    try {
      const tg = window.Telegram.WebApp;
      tg.ready && tg.ready();
      tg.expand && tg.expand();

      // Only continue if initDataUnsafe.user exists
      const initUnsafe = tg.initDataUnsafe || {};
      if (initUnsafe.user) {
        const user = initUnsafe.user;
        const userId = user.id;
        const firstName = user.first_name || "";
        const photoUrl = user.photo_url || "";

        // persist and store globally
        USER_ID = userId;
        persistUserId(userId);

        // sync on server
        await fetchApi({
          type: "syncUser",
          data: {
            id: userId,
            name: firstName,
            photo: photoUrl
          }
        });

        // Immediately fetch balance/stats to populate UI after syncUser
        await refreshBalance();

        // Update UI profile display
        const userPhotoContainer = document.querySelector(".user-fhoto");
        const userNameContainer = document.querySelector(".user-name");

        if (userPhotoContainer) {
          if (photoUrl) {
            userPhotoContainer.innerHTML =
              '<img src="' + escapeAttribute(photoUrl) + '" style="width:95px;height:95px;border-radius:50%;">';
          } else {
            userPhotoContainer.innerHTML =
              '<div style="width:80px;height:80px;border-radius:50%;background:#444;color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px;">' +
              escapeHtml(firstName.charAt(0) || "") +
              "</div>";
          }
        }
        if (userNameContainer) userNameContainer.textContent = firstName || "";

        // referral link
        if (referralLinkEl) {
          referralLinkEl.textContent = "https://t.me/Bot_ad_watchbot/earn?startapp=ref_" + userId;
        }
      } else {
        // no user data: try to refresh balance if we have stored USER_ID
        if (USER_ID) {
          await refreshBalance();
        }
      }
    } catch (err) {
      console.warn("Telegram integration error:", err);
      // If anything failed, but we have a stored user id, still try to get balance
      if (USER_ID) await refreshBalance();
    }
  } else {
    // Not a Telegram WebApp: if we have a stored user id call refreshBalance
    if (USER_ID) {
      await refreshBalance();
    }
  }
});

/* =======================
   Optional: also refresh balance on page visible (when user returns)
======================= */
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") {
    // best-effort refresh; do not block UI
    if (USER_ID) {
      refreshBalance().catch(() => {});
    }
  }
});