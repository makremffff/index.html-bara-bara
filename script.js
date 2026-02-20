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

  soundbtn.currentTime = 0;
  soundbtn.play();

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

  walletbalance.innerHTML = `
  <img src="coins.png" style="width:20px; vertical-align:middle;">
  ${ADS}
  `;
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

adsBtn.addEventListener("click", async function () {

  if (adCooldown) return;

  adsBtn.style.display  = "none";
  adsBtnn.style.display = "block";

  let timeLeft = 50;
  adsBtnn.textContent = timeLeft + "s";

  timer = setInterval(function () {
    timeLeft--;
    adsBtnn.textContent = timeLeft + "s";

    if (timeLeft <= 0) {

      ADS += 100;
      adsBalance.textContent = ADS;

      soundads.currentTime = 0;
      soundads.play();

      clearInterval(timer);
      adsBtnn.style.display = "none";
      adsBtn.style.display  = "block";

      dailyProgres--;
      progres.textContent = dailyProgres;

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
            progres.textContent = dailyProgres;
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

/* =======================
   Telegram User Data Integration
======================= */

const tg = window.Telegram.WebApp;
tg.expand();

let userPhotoContainer = document.querySelector(".user-fhoto");
let linkSpan = document.getElementById("link");

if (tg.initDataUnsafe && tg.initDataUnsafe.user) {

  let user = tg.initDataUnsafe.user;
  let userId = user.id;
  let firstName = user.first_name ? user.first_name : "";
  let photoUrl = user.photo_url ? user.photo_url : "";

  if (photoUrl !== "") {
    userPhotoContainer.innerHTML = `
      <img src="${photoUrl}" style="width:80px;height:80px;border-radius:50%;">
    `;
  } else {
    userPhotoContainer.innerHTML = `
      <div style="width:80px;height:80px;border-radius:50%;background:#444;color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px;">
        ${firstName.charAt(0)}
      </div>
    `;
  }

  linkSpan.textContent = `https://t.me/Bot_ad_watchbot/earn?startapp=ref_${userId}`;
}