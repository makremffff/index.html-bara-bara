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
  mainPage.style.display    = "none";
  taskPage.style.display    = "none";
  walletPage.style.display  = "none";
  sharePage.style.display = 'none';
  addTaskpage.style.display = 'none';
  
  btnpage.style.display = "block";

  loadpage.style.display = "block";
  pagename.textContent = "Loading";
  barbtn.style.display = 'none';
  setTimeout(function(){
    barbtn.style.display = 'block';
  }, 2000);

  if (soundbtn) {
    soundbtn.currentTime = 0;
    soundbtn.play();
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
   نظام الإعلانات المحسّن
======================= */

// AdsGram Controller
let AdsGramController = null;
let adsGramReady = false;

function initAdsGram() {
  try {
    if (window.Adsgram && typeof window.Adsgram.init === 'function') {
      AdsGramController = window.Adsgram.init({ blockId: "int-20679" });
      adsGramReady = true;
      console.log('[AdsGram] Initialized successfully');
      return true;
    }
    console.warn('[AdsGram] SDK not available');
    return false;
  } catch (e) {
    console.warn('[AdsGram] init error:', e);
    return false;
  }
}

async function showAdsGramRewarded() {
  if (!adsGramReady || !AdsGramController) {
    console.log('[AdsGram] Not ready, trying to init...');
    initAdsGram();
  }
  
  if (!AdsGramController || typeof AdsGramController.show !== 'function') {
    return { ok: false, reason: 'not_ready' };
  }

  try {
    const result = await AdsGramController.show();
    console.log('[AdsGram] Result:', result);
    if (result && result.done === false) {
      return { ok: false, reason: 'not_done', result };
    }
    return { ok: true, result };
  } catch (error) {
    console.error('[AdsGram] Error:', error);
    return { ok: false, reason: 'error', error };
  }
}

// libtl.com SDK - معالجة أفضل للأخطاء
async function showLibtlAd(attempt = 1) {
  return new Promise((resolve, reject) => {
    const maxAttempts = 3;
    
    function tryShow() {
      if (typeof show_10245709 === 'function') {
        try {
          show_10245709();
          // ننتظر قليلاً للتأكد من أن الإعلان بدأ
          setTimeout(() => resolve(true), 1500);
        } catch (e) {
          console.error('[libtl] Attempt', attempt, 'failed:', e);
          if (attempt < maxAttempts) {
            setTimeout(() => tryShow(), 500);
          } else {
            reject('libtl SDK failed after ' + maxAttempts + ' attempts');
          }
        }
      } else {
        console.warn('[libtl] SDK not loaded, attempt', attempt);
        if (attempt < maxAttempts) {
          setTimeout(() => tryShow(), 1000);
        } else {
          reject('libtl SDK not available');
        }
      }
    }
    
    tryShow();
  });
}

// Toast notification
function showToast(message, type = 'info', duration = 3000) {
  const existing = document.querySelector('.custom-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'custom-toast';
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ff8c00' : '#17a2b8'};
    color: white;
    padding: 15px 25px;
    border-radius: 12px;
    font-weight: bold;
    z-index: 999999;
    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
    animation: toastIn 0.3s ease;
    font-family: inherit;
    max-width: 90%;
    text-align: center;
    line-height: 1.4;
  `;
  toast.textContent = message;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes toastIn {
      from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    @keyframes toastOut {
      from { transform: translateX(-50%) translateY(0); opacity: 1; }
      to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
    }
  `;
  if (!document.querySelector('#toastStyles')) {
    style.id = 'toastStyles';
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
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

// محاكاة الإعلانات للاختبار (يمكن إزالتها في الإنتاج)
function simulateAd() {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ ok: true, simulated: true }), 2000);
  });
}

/* =======================
   عند الضغط على زر الإعلان
======================= */
if (adsBtn) {
  adsBtn.addEventListener("click", async function () {
    if (isProcessingAd) {
      showToast('Please wait, ad is loading...', 'warning');
      return;
    }
    
    if (dailyProgres <= 0) {
      showToast('Daily limit reached! Please wait for reset.', 'warning', 4000);
      return;
    }

    isProcessingAd = true;
    
    // إظهار حالة التحميل
    adsBtn.style.display = "none";
    if (adsBtnn) {
      adsBtnn.style.display = "block";
      adsBtnn.textContent = "Loading ad 1/3...";
      adsBtnn.disabled = true;
      adsBtnn.style.background = "#666";
    }

    let adsWatched = 0;
    const totalAds = 3;

    try {
      // إعلان 1: libtl
      if (adsBtnn) adsBtnn.textContent = "Loading ad 1/3...";
      try {
        await showLibtlAd();
        adsWatched++;
        console.log('Ad 1/3 watched');
      } catch (e1) {
        console.warn('Ad 1 failed:', e1);
        // محاولة AdsGram كبديل
        const fallback1 = await showAdsGramRewarded();
        if (fallback1.ok) {
          adsWatched++;
          console.log('Ad 1/3 watched (fallback)');
        }
      }

      // إعلان 2: libtl
      if (adsWatched >= 1) {
        if (adsBtnn) adsBtnn.textContent = "Loading ad 2/3...";
        try {
          await showLibtlAd();
          adsWatched++;
          console.log('Ad 2/3 watched');
        } catch (e2) {
          console.warn('Ad 2 failed:', e2);
          const fallback2 = await showAdsGramRewarded();
          if (fallback2.ok) {
            adsWatched++;
            console.log('Ad 2/3 watched (fallback)');
          }
        }
      }

      // إعلان 3: AdsGram (الأهم)
      if (adsWatched >= 2) {
        if (adsBtnn) adsBtnn.textContent = "Loading ad 3/3...";
        const adsgramResult = await showAdsGramRewarded();
        
        if (adsgramResult.ok) {
          adsWatched++;
          console.log('Ad 3/3 watched');
        } else {
          // إذا فشل AdsGram، نحاول مرة أخرى
          if (adsBtnn) adsBtnn.textContent = "Retrying ad 3...";
          const retryResult = await showAdsGramRewarded();
          if (retryResult.ok) {
            adsWatched++;
          }
        }
      }

      // ✅ نجحت 3 إعلانات على الأقل
      if (adsWatched >= 3) {
        giveReward();
      } else if (adsWatched >= 2) {
        // نجحت إعلانين فقط - نعطي نصف المكافأة
        showToast('Only 2 ads loaded. Partial reward: 50 ADS', 'warning');
        ADS += 50;
        updateBalance();
      } else {
        // فشلت معظم الإعلانات
        showToast('Failed to load ads. Please check connection and try again.', 'error', 4000);
      }

    } catch (error) {
      console.error('Ad system error:', error);
      showToast('Ad system error. Please try again later.', 'error');
    } finally {
      isProcessingAd = false;
      resetButtonState();
    }
  });
}

function giveReward() {
  // زيادة الرصيد
  ADS += 100;
  updateBalance();

  // تشغيل صوت المكافأة
  if (soundads) {
    soundads.currentTime = 0;
    soundads.play();
  }

  // إظهار الإشعار الأصلي
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
  
  showToast('🎉 Great! You earned 100 ADS!', 'success', 4000);

  // التحقق من الوصول للحد اليومي
  if (dailyProgres <= 0) {
    startDailyLimit();
  }
}

function updateBalance() {
  if (adsBalance) adsBalance.textContent = ADS;
  if (walletbalance) {
    walletbalance.innerHTML = `
      <img src="coins.png" style="width:20px; vertical-align:middle;">
      ${ADS}
    `;
  }
}

function resetButtonState() {
  if (dailyProgres > 0) {
    if (adsBtnn) adsBtnn.style.display = "none";
    adsBtn.style.display = "block";
    adsBtn.disabled = false;
  }
}

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

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
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
  // تأخير بسيط للتأكد من تحميل SDK
  setTimeout(() => {
    initAdsGram();
    console.log('Ads system initialized');
  }, 1000);
});
