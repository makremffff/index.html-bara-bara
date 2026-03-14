// ===========================
// Telegram WebApp
// ===========================
let tg = window.Telegram.WebApp;
tg.expand();

let user = tg.initDataUnsafe.user;

// ===========================
// دالة API المركزية
// ===========================
async function fetchApi({ type, data = {} }) {
  try {
    const response = await fetch("/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data }),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "Unknown error");
    }

    return result;

  } catch (err) {
    console.error(`[fetchApi] Error in action "${type}":`, err.message);
    showNotification("⚠️ Error: " + err.message);
    return null;
  }
}

// ===========================
// بيانات المستخدم
// ===========================
let userid = null;
let userBalance = 0;

if (user) {
  userid = user.id;
  let firstname = user.first_name || "";
  let lastname = user.last_name || "";
  let fullname = firstname + " " + lastname;
  let photo = user.photo_url || "";

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

  // رابط الإحالة
  let refLink = `https://t.me/Bot_ad_watchbot/earn?startapp=ref_${userid}`;
  let refBox = document.querySelector(".refal-link span");
  if (refBox) refBox.innerHTML = refLink;

  // تسجيل المستخدم في الباك اند وجلب رصيده
  fetchApi({
    type: "registerUser",
    data: { userid, fullname, photo },
  }).then((res) => {
    if (res && res.balance !== undefined) {
      userBalance = res.balance;
      updateBalanceUI();
    }
  });
}

// ===========================
// تحديث الرصيد في الواجهة
// ===========================
function updateBalanceUI() {
  document.querySelector(".user-balance span").innerHTML =
    userBalance + `<img src="asesst/pepe.png" width="23" height="30">`;
}

// ===========================
// الصفحات
// ===========================
let mainpage = document.getElementById("main");
let taskpage = document.getElementById("task");
let walletpage = document.getElementById("wallet");
let gamepage = document.getElementById("game");
let refalpage = document.getElementById("refal");

function showpage(page) {
  mainpage.style.display = "none";
  taskpage.style.display = "none";
  gamepage.style.display = "none";
  refalpage.style.display = "none";
  walletpage.style.display = "none";
  page.style.display = "block";
}

// ===========================
// الإشعارات
// ===========================
function showNotification(text) {
  let notifi = document.querySelector(".notifi h3");
  notifi.textContent = text;
  document.querySelector(".notifi").style.display = "block";
  setTimeout(() => {
    document.querySelector(".notifi").style.display = "none";
  }, 3000);
}

// ===========================
// صور الإعلانات
// ===========================
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
  if (i >= images.length) i = 0;
  boximg.innerHTML = `<img src="${images[i]}" width="250">`;
}, 10000);

// ===========================
// تغيير لون topup
// ===========================
let topup = document.querySelector(".top-up");
let taskadd = document.getElementById("taskadd");

taskadd.addEventListener("change", function () {
  topup.style.color = taskadd.checked ? "blue" : "";
});

// ===========================
// إنشاء مهمة
// ===========================
let creatTaskbtn = document.getElementById("createtask");

creatTaskbtn.addEventListener("click", async function () {
  let taskname = document.getElementById("taskname").value;
  let tasklink = document.getElementById("tasklink").value;

  const res = await fetchApi({
    type: "createTask",
    data: { userid, taskname, tasklink },
  });

  if (!res) return;

  let taskcard = document.createElement("div");
  taskcard.classList = "task-card";
  taskcard.innerHTML = `
    <img class="task-img" src="asesst/telegram.png" width="25">
    <span class="task-name">${taskname}</span>
    <span class="task-prize">500 <img src="asesst/pepe.png" width="25" height="28"></span>
    <div class="task-link">
      <a href="${tasklink}" target="_blank">Join</a>
    </div>
  `;

  document.getElementById("task").appendChild(taskcard);

  document.getElementById("taskname").value = "";
  document.getElementById("tasklink").value = "";

  setupTasks();
});

// ===========================
// الصوت
// ===========================
const audio = document.getElementById("audio");
document.addEventListener("click", () => { audio.play(); });

let btnsound = document.getElementById("clicksound");
let btns = document.querySelector(".btn-bar");
btns.addEventListener("click", function () { btnsound.play(); });

// ===========================
// نظام المهام
// ===========================
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

      if (btn.innerText === "Join") {
        btn.innerText = "Check";

      } else if (btn.innerText === "Check") {
        e.preventDefault();

        const res = await fetchApi({
          type: "completeTask",
          data: { userid, taskId },
        });

        if (!res) return;

        userBalance = res.balance ?? userBalance + 500;
        updateBalanceUI();

        showNotification("Task Complete +500");
        localStorage.setItem(taskId, true);
        btn.innerHTML = `<img src="asesst/check.gif" width="23">`;
      }
    };
  });
}

setupTasks();

// ===========================
// نسخ رابط الإحالة
// ===========================
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

// ===========================
// مشاهدة الإعلانات
// ===========================
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
    debug: true,
  });

  adController.show().then(async () => {
    adsWatched++;

    if (adsWatched < 4) {
      setTimeout(() => { showAd(); }, 6000);
    } else {
      const res = await fetchApi({
        type: "watchAds",
        data: { userid, adsCount: adsWatched },
      });

      if (!res) return;

      userBalance = res.balance ?? userBalance + 100;
      updateBalanceUI();

      document.querySelector(".user-ads h3").innerText =
        parseInt(document.querySelector(".user-ads h3").innerText) + 1;

      showNotification("Ads Watched +100");
    }

  }).catch(() => {
    showNotification("Error Try Again");
  });
}

// ===========================
// السحب (Withdraw)
// ===========================
let sendwithBtn = document.getElementById("sendwith");

if (sendwithBtn) {
  sendwithBtn.addEventListener("click", async function () {
    let email = document.getElementById("faucetmail").value;
    let amount = document.getElementById("amount").value;

    if (!email || !amount) {
      showNotification("⚠️ Please fill all fields");
      return;
    }

    const res = await fetchApi({
      type: "withdraw",
      data: { userid, email, amount: parseInt(amount) },
    });

    if (!res) return;

    showNotification("✅ Withdrawal request sent!");
    document.getElementById("faucetmail").value = "";
    document.getElementById("amount").value = "";
  });
}
