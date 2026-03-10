// ================================
// Telegram WebApp
// ================================
let tg = window.Telegram.WebApp;
tg.expand();

let API_URL = "/api";

async function fetchApi({ type, data = {} }) {
  try {

    let res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: type,
        data: data
      })
    });

    let result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || "API Error");
    }

    return result;

  } catch (err) {

    showNotification("Server Error");

    console.error(err);

    return null;
  }
}

// ================================
// جلب بيانات المستخدم
// ================================
let user = tg.initDataUnsafe.user;

let userid = 0;
let fullname = "";
let photo = "";

if (user) {

  userid = user.id;

  let firstname = user.first_name || "";
  let lastname = user.last_name || "";

  fullname = firstname + " " + lastname;
  photo = user.photo_url || "";

  // صورة المستخدم
  let userPhoto = document.querySelector(".user-fhoto");

  if (photo) {
    userPhoto.innerHTML = `<img src="${photo}">`;
  } else {
    userPhoto.innerHTML = `<img src="asesst/user.png">`;
  }

  // الاسم
  let usernameBox = document.querySelector(".user-name");

  usernameBox.innerHTML = `
<span style="color:#ffeedd;font-size:20px;">♪WellCome♫</span>
<span>${fullname}</span>
`;

  // رابط الاحالة
  let refLink = `https://t.me/Bot_ad_watchbot/earn?startapp=ref_${userid}`;

  let refBox = document.querySelector(".refal-link span");

  if (refBox) {
    refBox.innerHTML = refLink;
  }

  // تسجيل المستخدم
  fetchApi({
    type: "registerUser",
    data: {
      id: userid,
      name: fullname,
      photo: photo
    }
  });

}

// ================================
// الصفحات
// ================================
let mainpage = document.getElementById("main");
let taskpage = document.getElementById("task");
let walletpage = document.getElementById("wallet");
let gamepage = document.getElementById("game");
let refalpage = document.getElementById("refal");

function showpage(page) {

  mainpage.style.display = 'none';
  taskpage.style.display = 'none';
  walletpage.style.display = 'none';
  gamepage.style.display = 'none';
  refalpage.style.display = 'none';

  page.style.display = 'block';

}

// ================================
// الاشعارات
// ================================
function showNotification(text) {

  let notifi = document.querySelector(".notifi h3");

  notifi.textContent = text;

  document.querySelector(".notifi").style.display = "block";

  setTimeout(() => {

    document.querySelector(".notifi").style.display = "none";

  }, 3000);

}

// ================================
// جلب الرصيد
// ================================
let userBalance = 0;

async function loadBalance() {

  let res = await fetchApi({
    type: "getBalance",
    data: {
      userId: userid
    }
  });

  if (res) {

    userBalance = res.balance;

    document.querySelector(".user-balance span").innerHTML =
      userBalance + `<img src="asesst/pepe.png" width="23" height="30">`;

  }

}

loadBalance();

// ================================
// صور الاعلانات
// ================================
let boximg = document.querySelector(".box-ads");

let images = [
  "asesst/113.png",
  "asesst/125.png",
  "asesst/104.png",
  "asesst/130.png",
  "asesst/711.png",
  "asesst/719.png",
];

let i = 0;

boximg.innerHTML = `<img src="${images[i]}" width="250">`;

setInterval(function () {

  i++;

  if (i >= images.length) {
    i = 0;
  }

  boximg.innerHTML = `<img src="${images[i]}" width="250">`;

}, 10000);

// ================================
// نظام المهام
// ================================
function setupTasks() {

  document.querySelectorAll(".task-card").forEach((task, index) => {

    let btn = task.querySelector(".task-link a");

    if (!btn) return;

    let taskId = "task_" + index;

    if (localStorage.getItem(taskId)) {

      btn.innerHTML = `<img src="asesst/check.gif" width="23">`;
      btn.removeAttribute("href");

    }

    btn.onclick = async function (e) {

      if (localStorage.getItem(taskId)) {

        e.preventDefault();

        showNotification("Task Already Completed");

        return;
      }

      // join
      if (btn.innerText === "Join") {

        btn.innerText = "Check";

      }

      // check
      else if (btn.innerText === "Check") {

        e.preventDefault();

        let res = await fetchApi({
          type: "completeTask",
          data: {
            userId: userid,
            taskId: taskId
          }
        });

        if (res) {

          userBalance = res.balance;

          document.querySelector(".user-balance span").innerHTML =
            userBalance + `<img src="asesst/pepe.png" width="23" height="30">`;

          showNotification("Task Complete +500");

          localStorage.setItem(taskId, true);

          btn.innerHTML = `<img src="asesst/check.gif" width="23">`;

        }

      }

    }

  });

}

setupTasks();

// ================================
// نسخ رابط الاحالة
// ================================
let copyBtn = document.getElementById("copy");

if (copyBtn) {

  copyBtn.addEventListener("click", function () {

    let link = document.querySelector(".refal-link span").innerText;

    navigator.clipboard.writeText(link);

    copyBtn.innerHTML = `<img src="asesst/approve.png" width="26">`;

    setTimeout(() => {

      copyBtn.innerHTML = `<img src="asesst/copy.png" width="26">`;

    }, 2000);

  });

}

// ================================
// الصوت
// ================================
const audio = document.getElementById("audio");

document.addEventListener("click", () => {
  audio.play();
});

let btnsound = document.getElementById("clicksound");

let btns = document.querySelector(".btn-bar");

btns.addEventListener("click", function () {
  btnsound.play();
});

// ================================
// نظام مشاهدة الاعلانات
// ================================
let watchBtn = document.getElementById("watch");

let adsWatched = 0;

watchBtn.addEventListener("click", startAds);

function startAds() {

  adsWatched = 0;

  showAd();

}

function showAd() {

  let adController = window.Adsgram.init({
    blockId: "int-20679",
    debug: true
  });

  adController.show().then(async () => {

    adsWatched++;

    if (adsWatched < 4) {

      setTimeout(() => {

        showAd();

      }, 6000);

    } else {

      let res = await fetchApi({
        type: "watchAds",
        data: {
          userId: userid,
          count: adsWatched
        }
      });

      if (res) {

        userBalance = res.balance;

        document.querySelector(".user-balance span").innerHTML =
          userBalance + `<img src="asesst/pepe.png" width="23" height="30">`;

        document.querySelector(".user-ads h3").innerText++;

        showNotification("Ads Watched +100");

      }

    }

  }).catch(() => {

    showNotification("Error Try Again");

  });

}