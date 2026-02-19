/* =======================
   أزرار التنقّل
======================= */
let btnMain   = document.querySelector("button");
let btnTask   = document.getElementById("btn2");
let btnWallet = document.getElementById("btn3");
let btnshare = document.getElementById("sharebtn");
let bntaddTask = document.getElementById("addtask");

/* =======================
   الصفحات
======================= */
let mainPage    = document.getElementById("main");
let taskPage    = document.getElementById("task");
let walletPage  = document.getElementById("wallet");
let sharePage = document.getElementById("share");
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
   Telegram WebApp
======================= */
let tgUser = null;
if (typeof Telegram !== 'undefined' && Telegram.WebApp && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user) {
    tgUser = Telegram.WebApp.initDataUnsafe.user;
}

const API_URL = '/api';

/* =======================
   دالة إخفاء كل الصفحات
   وإظهار الصفحة المطلوبة
======================= */
function showPage(btnpage) {
  // إخفاء جميع الصفحات
  mainPage.style.display    = "none";
  taskPage.style.display    = "none";
  walletPage.style.display  = "none";
  sharePage.style.display = 'none';
  addTaskpage.style.display = 'none';
  
  // إظهار الصفحة المطلوبة
  btnpage.style.display = "block";

  // إظهار شاشة التحميل
  loadpage.style.display = "block";
  pagename.textContent = "Loading";
  barbtn.style.display = 'none';
  setTimeout(function(){
    barbtn.style.display = 'block';
  }, 2000);

  // تشغيل صوت التنقّل
  if (soundbtn) {
    soundbtn.currentTime = 0;
    soundbtn.play();
  }

  // إخفاء شاشة التحميل بعد 4 ثواني
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
  btnWallet.addEventListener("click", function () {
    showPage(walletPage);
    if (walletbalance) {
      walletbalance.innerHTML = `
        <img src="coins.png" style="width:20px; vertical-align:middle;">
        ${ADS}
      `;
    }
  });
}

if (btnshare) {
  btnshare.addEventListener("click", function() {
    showPage(sharePage);
  });
}

if (bntaddTask) {
  bntaddTask.addEventListener('click', function() {
    showPage(addTaskpage);
  });
}

/* =======================
   نظام الإعلانات (من ads.html)
======================= */

// AdsGram Controller
let AdsGramController = null;

function initAdsGram() {
  try {
    if (window.Adsgram && typeof window.Adsgram.init === 'function') {
      AdsGramController = window.Adsgram.init({ blockId: "int-20679" });
      return true;
    }
    console.warn('[AdsGram] SDK not loaded yet.');
    return false;
  } catch (e) {
    console.warn('[AdsGram] init error:', e);
    return false;
  }
}

async function showAdsGramRewarded() {
  if (!AdsGramController) initAdsGram();
  
  if (!AdsGramController || typeof AdsGramController.show !== 'function') {
    return { ok: false, reason: 'not_ready' };
  }

  try {
    const result = await AdsGramController.show();
    if (result && result.done === false) {
      return { ok: false, reason: 'not_done', result };
    }
    return { ok: true, result };
  } catch (error) {
    return { ok: false, reason: 'error', error };
  }
}

// libtl.com SDK
async function showLibtlAd() {
  return new Promise((resolve, reject) => {
    if (typeof show_10245709 === 'function') {
      try {
        show_10245709();
        setTimeout(() => resolve(true), 1000);
      } catch (e) {
        reject(e);
      }
    } else {
      reject('libtl SDK not available');
    }
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
let adstime = document.getElementById("adstime");

let ADS   = 0;
let timer = null;
let dailyLimit = null;
let dailyProgres = 100;
let progresLimit = 60 * 60000;
let isProcessingAd = false;

// Toast notification system
function showToast(message, type = 'info') {
  // إنشاء عنصر Toast
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
    color: white;
    padding: 15px 25px;
    border-radius: 10px;
    font-weight: bold;
    z-index: 999999;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    animation: slideDown 0.3s ease;
  `;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideUp 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// إضافة أنيميشن CSS للـ Toast
const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
    to { transform: translateX(-50%) translateY(0); opacity: 1; }
  }
  @keyframes slideUp {
    from { transform: translateX(-50%) translateY(0); opacity: 1; }
    to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

/* =======================
   عند الضغط على زر الإعلان (محدث)
======================= */
if (adsBtn) {
  adsBtn.addEventListener("click", async function () {
    if (isProcessingAd) return;
    
    // التحقق من الحد اليومي
    if (dailyProgres <= 0) {
      showToast('Daily limit reached! Please wait.', 'warning');
      return;
    }

    isProcessingAd = true;
    
    // إظهار حالة التحميل
    adsBtn.style.display = "none";
    if (adsBtnn) {
      adsBtnn.style.display = "block";
      adsBtnn.textContent = "Loading...";
      adsBtnn.disabled = true;
    }

    try {
      // تحميل 3 إعلانات متتالية
      // إعلان 1: libtl
      await showLibtlAd();
      
      // إعلان 2: libtl
      await showLibtlAd();
      
      // إعلان 3: AdsGram
      const adsgramResult = await showAdsGramRewarded();
      
      if (!adsgramResult.ok) {
        if (adsgramResult.reason === 'not_ready') {
          showToast('Ads not ready. Please try again.', 'error');
        } else if (adsgramResult.reason === 'not_done') {
          showToast('Please watch the full ad to get reward!', 'warning');
        } else {
          showToast('Ad error. Please try again.', 'error');
        }
        
        // إعادة الزر للحالة الطبيعية
        if (adsBtnn) adsBtnn.style.display = "none";
        adsBtn.style.display = "block";
        isProcessingAd = false;
        return;
      }

      // ✅ جميع الإعلانات شُاهدت بنجاح - إعطاء المكافأة
      
      // زيادة الرصيد
      ADS += 100;
      if (adsBalance) adsBalance.textContent = ADS;
      
      // تحديث الرصيد في صفحة المحفظة
      if (walletbalance) {
        walletbalance.innerHTML = `
          <img src="coins.png" style="width:20px; vertical-align:middle;">
          ${ADS}
        `;
      }

      // تشغيل صوت المكافأة
      if (soundads) {
        soundads.currentTime = 0;
        soundads.play();
      }

      // إظهار الإشعار
      if (adsNotfi) {
        adsNotfi.style.display = "block";
        adsNotfi.style.opacity = "0.8";
        adsNotfi.textContent = "+100 ADS!";

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

      // تحديث التقدم اليومي
      dailyProgres--;
      if (progres) progres.textContent = dailyProgres;
      
      showToast('Great! You earned 100 ADS!', 'success');

      // التحقق من الوصول للحد اليومي
      if (dailyProgres <= 0) {
        startDailyLimit();
      }

    } catch (error) {
      console.error('Ad error:', error);
      showToast('Failed to load ads. Please try again.', 'error');
    } finally {
      isProcessingAd = false;
      
      // إعادة الزر للحالة الطبيعية
      if (dailyProgres > 0) {
        if (adsBtnn) adsBtnn.style.display = "none";
        adsBtn.style.display = "block";
      }
    }
  });
}

// دالة بدء العد التنازلي للحد اليومي
function startDailyLimit() {
  if (adsBtn) adsBtn.style.display = 'none';
  if (adsBtnn) {
    adsBtnn.style.display = "block";
    adsBtnn.textContent = formatTime(progresLimit);
    adsBtnn.style.background = 'red';
    adsBtnn.disabled = true;
  }
  
  dailyLimit = setInterval(function() {
    progresLimit -= 1000;
    if (adsBtnn) adsBtnn.textContent = formatTime(progresLimit);
    
    if (progresLimit <= 0) {
      clearInterval(dailyLimit);
      
      if (adsBtnn) adsBtnn.style.display = 'none';
      if (adsBtn) {
        adsBtn.style.display = 'block';
        adsBtn.disabled = false;
      }
      if (adsBtnn) adsBtnn.style.background = '';
      progresLimit = 60 * 60000;
      dailyProgres = 100;
      if (progres) progres.textContent = dailyProgres;
    }
  }, 1000);
}

// تنسيق الوقت
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/* =======================
   شاشة التحميل عند الدخول
======================= */
if (loadpage) {
  loadpage.style.display = "block";
  if (pagename) {
    pagename.style.display = "none";
  }

  setTimeout(function () {
    loadpage.style.display = "none";
    loadpage.style.background = "black";
    if (pagename) pagename.style.display = "block";
  }, 8000);
}

let menubtn = document.querySelector(".menub");
if (menubtn) {
  menubtn.style.display = 'none';
  setTimeout(function(){
    menubtn.style.display = 'block';
    menubtn.style.display = 'flex';
  }, 8100);
}

/* =======================
   نسخ رابط إحالة
======================= */
let copyrefal = document.getElementById("copy");
let link = document.getElementById("link");
let copyImge = document.getElementById("copyImg");
let copynotifi = document.querySelector(".copynotifi");

if (copyrefal && link) {
  let refaltext = link.textContent;
  
  copyrefal.addEventListener("click", function(){
    if (copyImge) copyImge.src = 'approve.png';
    if (copynotifi) {
      copynotifi.style.display = 'block';
      copynotifi.style.top = '-48%';
    }
    copyrefal.style.boxShadow = '0 0px 0 #EBEBF0';

    setTimeout(function(){
      if (copynotifi) {
        copynotifi.style.display = 'none';
        copynotifi.style.top = '';
      }
    }, 2000);
    
    navigator.clipboard.writeText(refaltext).then(function() {
      setTimeout(function(){
        if (copyImge) copyImge.src = 'copy.png';
        copyrefal.style.boxShadow = '0 5px 0 #7880D3';
      }, 800);
    });
  });
}

/* =======================
   إضافة مهمة تاسك
======================= */
let creatTask = document.getElementById("creatTask");

if (creatTask) {
  creatTask.addEventListener("click", function(){
    let nametask = document.getElementById("taskNameInput").value;
    let linktask = document.getElementById("taskLinkInput").value;
    let taskcontainer = document.querySelector(".task-container");
    
    if (!nametask || !linktask) {
      showToast('Please fill all fields!', 'warning');
      return;
    }
    
    let taskcard = document.createElement("div");
    taskcard.className = "task-card";
    
    taskcard.innerHTML = `
      <span class="task-name">${nametask}</span>
      <span class="task-prize">30 <img src="coins.png" width="25"></span>
      <a class="task-link" href="${linktask}" target="_blank">start</a>
    `;
    
    if (taskcontainer) taskcontainer.appendChild(taskcard);

    document.getElementById("taskNameInput").value = '';
    document.getElementById("taskLinkInput").value = '';
    
    showToast('Task added successfully!', 'success');
  });
}

/* =======================
   منع double-tap zoom (iOS)
======================= */
(function(){
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function (event) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
})();

// تهيئة AdsGram عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
  initAdsGram();
});
