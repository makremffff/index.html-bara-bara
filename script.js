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
   حالة الإعلان والرصيد
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

/* =======================
   نسخ رابط الإحالة
======================= */
let copyrefal = document.getElementById("copy");
let link = document.getElementById("link");
let copyImge = document.getElementById("copyImg");
let copynotifi = document.querySelector(".copynotifi");

/* =======================
   إضافة مهمة جديدة
======================= */
let creatTask = document.getElementById("creatTask");

/* =======================
   عناصر أخرى
======================= */
let menubtn = document.querySelector(".menub");

/* =======================
   الدالة المركزية fetchApi
   - تستقبل كائن { type, data }
   - تُنفّذ الأكشن المناسب وتعيد Promise
   - تحوي معالجة أخطاء مركزية
======================= */
async function fetchApi({ type, data = {} }) {
  try {
    switch (type) {

      /* -----------------------
         التنقّل بين الصفحات
      ----------------------- */
      case "navigate": {
        const page = data.page; // "main" | "task" | "wallet" | "share" | "addTask"
        const pageMap = {
          main: mainPage,
          task: taskPage,
          wallet: walletPage,
          share: sharePage,
          addTask: addTaskpage
        };
        const target = pageMap[page];
        if (!target) throw new Error("Unknown page: " + page);

        // إخفاء كل الصفحات ثم إظهار الصفحة المحددة
        mainPage.style.display    = "none";
        taskPage.style.display    = "none";
        walletPage.style.display  = "none";
        sharePage.style.display   = "none";
        addTaskpage.style.display = "none";
        target.style.display = "block";

        // شاشة تحميل مشتركة
        loadpage.style.display = "block";
        pagename.textContent = "Loading";
        barbtn.style.display = 'none';
        setTimeout(function(){
          barbtn.style.display = 'block';
        }, 2000);

        // تشغيل صوت التنقّل إن وُجد
        if (soundbtn) {
          try { soundbtn.currentTime = 0; soundbtn.play(); } catch(e){ /* ignore play error */ }
        }

        // إخفاء شاشة التحميل بعد 2 ثانية
        await new Promise(res => setTimeout(res, 2000));
        loadpage.style.display = "none";

        // تحديث المحفظة عند التنقّل لصفحة المحفظة
        if (page === "wallet") {
          await fetchApi({ type: "updateWalletBalance" });
        }
        return true;
      }

      /* -----------------------
         تحديث رصيد المحفظة في الواجهة
      ----------------------- */
      case "updateWalletBalance": {
        if (!walletbalance) return false;
        walletbalance.innerHTML = `
          <img src="coins.png" style="width:20px; vertical-align:middle;">
          ${ADS}
        `;
        if (adsBalance) adsBalance.textContent = ADS;
        return true;
      }

      /* -----------------------
         عرض إعلان واحد (يعيد true/false)
         تعيد Promise لتسهيل الاستخدام async/await
      ----------------------- */
      case "showSingleAd": {
        if (adCooldown) return false;
        adCooldown = true;

        if (AdsGramController && typeof AdsGramController.show === "function") {
          try {
            await AdsGramController.show();
            // ضمّ تأخير إزالة ا��كولداون
            await new Promise(res => setTimeout(res, adCooldownTime));
            adCooldown = false;
            return true;
          } catch (err) {
            adCooldown = false;
            return false;
          }
        } else {
          // محاكاة عرض إعلان محليًا
          await new Promise(res => setTimeout(res, 2000));
          setTimeout(function(){
            adCooldown = false;
          }, adCooldownTime);
          return true;
        }
      }

      /* -----------------------
         تسلسل مشاهدة إعلان كامل كما في الواجهة الأصلية
         - يخفي/يظهر الأزرار، يدير العداد، يكافئ المستخدم
      ----------------------- */
      case "watchAdSequence": {
        if (adCooldown) return false;

        // بدء واجهة العدّ التنازلي
        adsBtn.style.display  = "none";
        adsBtnn.style.display = "block";

        let timeLeft = 50;
        adsBtnn.textContent = timeLeft + "s";

        // نستخدم Promise لانتظار انتهاء العد
        await new Promise((resolve) => {
          timer = setInterval(function () {
            timeLeft--;
            adsBtnn.textContent = timeLeft + "s";

            if (timeLeft <= 0) {
              // مكافأة المستخدم
              ADS += 100;
              if (adsBalance) adsBalance.textContent = ADS;

              try { soundads.currentTime = 0; soundads.play(); } catch(e){}

              dailyProgres--;
              if (progres) progres.textContent = dailyProgres;

              clearInterval(timer);
              adsBtnn.style.display = "none";
              adsBtn.style.display  = "block";

              // إشعار مكافأة
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

              // إذا انتهى الحِصّة اليومية
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

              resolve(true);
            }

          }, 1000);
        });

        // بعد انتهاء العد نعرض/نحاول عرض الإعلانات الفعلية أربع مرات (كما في الكود الأصلي)
        // كل استدعاء showSingleAd يُحترم الكولداون المركزي.
        await fetchApi({ type: "showSingleAd" });
        await fetchApi({ type: "showSingleAd" });
        await fetchApi({ type: "showSingleAd" });
        await fetchApi({ type: "showSingleAd" });

        return true;
      }

      /* -----------------------
         نسخ رابط الإحالة
      ----------------------- */
      case "copyReferral": {
        const linkText = data.linkText || "";
        try {
          if (copyImge) copyImge.src = 'https://files.catbox.moe/cr5q08.png';
          if (copynotifi) {
            copynotifi.style.display = 'block';
            copynotifi.style.top = '-48%';
          }
          if (copyrefal) copyrefal.style.boxShadow = '0 0px 0 #EBEBF0';

          // نكتب في الحافظة
          await navigator.clipboard.writeText(linkText);

          // إرجاع الواجهة للوضع الطبيعي بعد لحظات
          setTimeout(function(){
            if (copyImge) copyImge.src = 'copy.png';
            if (copyrefal) copyrefal.style.boxShadow = '0 5px 0 #7880D3';
            if (copynotifi) { copynotifi.style.display = 'none'; copynotifi.style.top = ''; }
          }, 800);

          return true;
        } catch (err) {
          // فشل الوصول للحافظة
          console.error("copyReferral error:", err);
          if (copynotifi) {
            copynotifi.style.display = 'block';
            copynotifi.textContent = 'Copy failed';
            setTimeout(() => { copynotifi.style.display = 'none'; }, 1500);
          }
          return false;
        }
      }

      /* -----------------------
         إضافة مهمة جديدة (DOM)
      ----------------------- */
      case "createTask": {
        const nametask = data.name || "";
        const linktask = data.link || "";
        const taskcontainer = document.querySelector(".task-container");
        if (!taskcontainer) throw new Error("task container not found");

        const taskcard = document.createElement("div");
        taskcard.className = "task-card";

        taskcard.innerHTML = `
          <span class="task-name">${escapeHtml(nametask)}</span>
          <span class="task-prize">30 <img src="coins.png" width="25"></span>
          <a class="task-link" href="${escapeAttr(linktask)}">start</a>
        `;

        taskcontainer.appendChild(taskcard);

        // تفريغ الحقول
        document.getElementById("taskNameInput").value = '';
        document.getElementById("taskLinkInput").value = '';

        return true;
      }

      /* -----------------------
         تهيئة بيانات Telegram WebApp في DOM
      ----------------------- */
      case "initTelegram": {
        const tg = data.tg;
        if (!tg) return false;

        try {
          tg.ready();
          if (tg.expand) tg.expand();

          if (!tg.initDataUnsafe || !tg.initDataUnsafe.user) return false;

          const user = tg.initDataUnsafe.user;
          const userId = user.id;
          const firstName = user.first_name ? user.first_name : "";
          const photoUrl = user.photo_url ? user.photo_url : "";

          const userPhotoContainer = document.querySelector(".user-fhoto");
          const userNameContainer = document.querySelector(".user-name");

          if (photoUrl) {
            userPhotoContainer.innerHTML =
              '<img src="' + escapeAttr(photoUrl) + '" style="width:95px;height:95px;border-radius:50%;">';
          } else {
            userPhotoContainer.innerHTML =
              '<div style="width:80px;height:80px;border-radius:50%;background:#444;color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px;">' +
              (firstName ? firstName.charAt(0) : '') +
              "</div>";
          }

          if (userNameContainer) {
            userNameContainer.textContent = firstName;
          }

          if (link) {
            link.textContent =
              "https://t.me/Bot_ad_watchbot/earn?startapp=ref_" + userId;
          }

          return true;
        } catch (err) {
          console.error("initTelegram error:", err);
          return false;
        }
      }

      /* -----------------------
         التحميل الابتدائي للصفحة (شاشة التحميل الأولى)
      ----------------------- */
      case "initialLoad": {
        loadpage.style.display = "block";
        pagename.style.display = "none";

        await new Promise(res => setTimeout(res, 8000));

        loadpage.style.display = "none";
        loadpage.style.background = "black";
        pagename.style.display = "block";

        if (menubtn) menubtn.style.display = 'none';
        setTimeout(function(){
          if (menubtn) menubtn.style.display = 'flex';
        }, 100);

        return true;
      }

      default:
        throw new Error("Unknown fetchApi type: " + type);
    }
  } catch (err) {
    console.error("fetchApi error for type", type, err);
    // هنا يمكنك إضافة منطق إرسال الأخطاء إلى خدمة تسجيل مركزية إن رغبت
    return Promise.reject(err);
  }
}

/* =======================
   مساعدات: تهيئة سلامة HTML/ATTR
======================= */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function escapeAttr(str) {
  if (!str) return "";
  return String(str)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* =======================
   ربط مزيج الأحداث ليستخدم fetchApi
======================= */
btnMain.addEventListener("click", function () {
  fetchApi({ type: "navigate", data: { page: "main" } }).catch(()=>{});
});

btnTask.addEventListener("click", function () {
  fetchApi({ type: "navigate", data: { page: "task" } }).catch(()=>{});
});

btnWallet.addEventListener("click", function () {
  fetchApi({ type: "navigate", data: { page: "wallet" } }).catch(()=>{});
});

btnshare.addEventListener("click",function(){
  fetchApi({ type: "navigate", data: { page: "share" } }).catch(()=>{});
});

bntaddTask.addEventListener('click',function(){
  fetchApi({ type: "navigate", data: { page: "addTask" } }).catch(()=>{});
});

/* زر مشاهدة الإعلان - الآن يمر عبر fetchApi */
adsBtn.addEventListener("click", async function () {
  try {
    await fetchApi({ type: "watchAdSequence" });
  } catch (e) {
    console.error("ads watch failed:", e);
  }
});

/* =======================
   نسخ رابط الإحالة عبر fetchApi
======================= */
copyrefal.addEventListener("click", function(){
  fetchApi({ type: "copyReferral", data: { linkText: link ? link.textContent : "" } }).catch(()=>{});
});

/* =======================
   إضافة مهمة جديدة عبر fetchApi
======================= */
creatTask.addEventListener("click", function(){
  const nametask = document.getElementById("taskNameInput").value;
  const linktask = document.getElementById("taskLinkInput").value;
  fetchApi({ type: "createTask", data: { name: nametask, link: linktask } }).catch(()=>{});
});

/* =======================
   تهيئة Telegram WebApp عند DOMContentLoaded عبر fetchApi
======================= */
document.addEventListener("DOMContentLoaded", function () {
  if (typeof window.Telegram === "undefined") {
    // نقوم بعملية التحميل الابتدائي على أية حال
    fetchApi({ type: "initialLoad" }).catch(()=>{});
    return;
  }

  const tg = window.Telegram.WebApp;
  // نمرّر الكائن إلى fetchApi لكي يتعامل مع البيانات ويحدّث الواجهة
  fetchApi({ type: "initTelegram", data: { tg } })
    .catch(()=>{});
  // نعرض شاشة التحميل الابتدائية بعد تهيئة Telegram أيضاً
  fetchApi({ type: "initialLoad" }).catch(()=>{});
});