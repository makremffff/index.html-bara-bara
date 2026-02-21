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

async function fetchApi({ type, data = {} }) {
  try {
    // attach userId automatically when available and not explicitly provided
    if (USER_ID && (!data.userId)) {
      data.userId = USER_ID;
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

    if (res.success) {
      ADS = Number(res.balance) || 0;

      walletbalance.innerHTML = `
      <img src="coins.png" style="width:20px; vertical-align:middle;">
      ${ADS}
      `;

      // update progress (daily remaining)
      const DAILY_LIMIT = 100;
      const remaining = DAILY_LIMIT - (Number(res.dailyAds) || 0);
      dailyProgres = remaining >= 0 ? remaining : 0;
      if (progres) progres.textContent = dailyProgres;
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
    adsBtnn.style.display = "block";

    let timeLeft = 50;
    adsBtnn.textContent = timeLeft + "s";

    timer = setInterval(async function () {
      timeLeft--;
      adsBtnn.textContent = timeLeft + "s";

      if (timeLeft <= 0) {

        // Reward user (attach userId automatically via fetchApi)
        const res = await fetchApi({
          type: "rewardUser",
          data: { amount: 100 }
        });

        if (res.success) {
          ADS = Number(res.balance) || ADS;
          adsBalance.textContent = ADS;

          // update daily progress with server value
          const DAILY_LIMIT = 100;
          dailyProgres = DAILY_LIMIT - (Number(res.dailyAds) || 0);
          if (dailyProgres < 0) dailyProgres = 0;
          if (progres) progres.textContent = dailyProgres;
        } else {
          // handle errors (e.g., daily limit reached)
          console.warn("rewardUser failed:", res.error);
          if (res.error && res.error.toString().toLowerCase().includes("daily limit")) {
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
          }
        }

        // UI feedback for success (or even for failure it's fine to show)
        if (res.success) {
          try {
            soundads.currentTime = 0;
            soundads.play();
          } catch (e) {}
          // visual notification
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

        // if dailyProgres depleted, set long cooldown
        if (dailyProgres <= 0) {
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
======================= */
document.addEventListener("DOMContentLoaded", async function () {

  if (typeof window.Telegram === "undefined") return;

  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();

  if (!tg.initDataUnsafe || !tg.initDataUnsafe.user) return;

  const user = tg.initDataUnsafe.user;
  const userId = user.id;
  const firstName = user.first_name ? user.first_name : "";
  const photoUrl = user.photo_url ? user.photo_url : "";

  // Store userId globally so subsequent API calls include it automatically
  USER_ID = userId;

  // Sync user on server
  await fetchApi({
    type: "syncUser",
    data: {
      id: userId,
      name: firstName,
      photo: photoUrl
    }
  });

  // Immediately fetch balance/stats to populate UI
  const res = await fetchApi({ type: "getBalance" });
  if (res.success) {
    ADS = Number(res.balance) || 0;
    if (walletbalance) {
      walletbalance.innerHTML = `
      <img src="coins.png" style="width:20px; vertical-align:middle;">
      ${ADS}
      `;
    }
    const DAILY_LIMIT = 100;
    dailyProgres = DAILY_LIMIT - (Number(res.dailyAds) || 0);
    if (dailyProgres < 0) dailyProgres = 0;
    if (progres) progres.textContent = dailyProgres;
  } else {
    console.warn("Initial getBalance failed:", res.error);
  }

  const userPhotoContainer = document.querySelector(".user-fhoto");
  const userNameContainer = document.querySelector(".user-name");

  if (photoUrl) {
    userPhotoContainer.innerHTML =
      '<img src="' + photoUrl + '" style="width:95px;height:95px;border-radius:50%;">';
  } else {
    userPhotoContainer.innerHTML =
      '<div style="width:80px;height:80px;border-radius:50%;background:#444;color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px;">' +
      firstName.charAt(0) +
      "</div>";
  }

  if (userNameContainer) {
    userNameContainer.textContent = firstName;
  }

  if (link) {
    link.textContent =
      "https://t.me/Bot_ad_watchbot/earn?startapp=ref_" + userId;
  }
});