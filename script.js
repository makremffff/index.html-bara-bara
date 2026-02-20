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
let adstime = document.getElementById("adstime");

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
    }

  }, 1000);

  let ad1 = await showSingleAd();
  if (!ad1) return;

  let ad2 = await showSingleAd();
  if (!ad2) return;

  let ad3 = await showSingleAd();
  if (!ad3) return;

  let ad4 = await showSingleAd();
  if (!ad4) return;

});

loadpage.style.display = "block";
pagename.style.display = "none";

setTimeout(function () {
  loadpage.style.display = "none";
  loadpage.style.background = "black";
  pagename.style.display = "block";
}, 8000);

let menubtn = document.querySelector(".menub");
menubtn.style.display = 'none';

setTimeout(function(){
  menubtn.style.display = 'flex';
}, 8100);

let copyrefal = document.getElementById("copy");
let link = document.getElementById("link");
let refaltext = document.getElementById("link").textContent;
let copyImge = document.getElementById("copyImg");
let copynotifi = document.querySelector(".copynotifi");

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

let creatTask = document.getElementById("creatTask");

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