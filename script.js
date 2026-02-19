/* =======================
   أزرار التنقّل
======================= */
let btnMain   = document.querySelector("button");
let btnTask   = document.getElementById("btn2");
let btnWallet = document.getElementById("btn3");
 let btnshare = document.getElementById("sharebtn")
let bntaddTask = document.getElementById("addtask")

/* =======================
   الصفحات
======================= */
let mainPage    = document.getElementById("main");
let taskPage    = document.getElementById("task");
let walletPage  = document.getElementById("wallet");
let sharePage = document.getElementById("share");

let addTaskpage = document.getElementById("addTask")

/* =======================
   شاشة التحميل + اسم الصفحة
======================= */
let loadpage = document.getElementById("loading");
let pagename = document.getElementById("page-load");

let userbalancce = document.querySelector('.user-balance')

let walletbalance = document.getElementById("adsbalancce")

let barbtn = document.querySelector(".bar")
/* =======================
   الأصوات
======================= */
let soundbtn  = document.getElementById("soundbtn");
let soundads  = document.getElementById("soundads");


/* =======================
   دالة إخفاء كل الصفحات
   وإظهار الصفحة المطلوبة
======================= */
function showPage(btnpage) {

  // إخفاء جميع الصفحات
  mainPage.style.display    = "none";
  taskPage.style.display    = "none";
  walletPage.style.display  = "none";
  sharePage.style.display = 'none'
 
addTaskpage.style.display = 'none'
  // إظهار الصفحة المطلوبة
  btnpage.style.display = "block";

  // إظهار شاشة التحميل
  loadpage.style.display = "block";
  pagename.textContent = "Loading";
  barbtn.style.display = 'none'
  setTimeout(function(){
    barbtn.style.display = 'block'
  }, 2000)
  

  // تشغيل صوت التنقّل
  soundbtn.currentTime = 0;
  soundbtn.play();

  // إخفاء شاشة التحميل بعد 4 ثواني
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
btnshare.addEventListener("click",function(){showPage(sharePage)
  
});

bntaddTask.addEventListener('click',function(){showPage(addTaskpage)})

/* =======================
   أزرار الإعلانات + الرصيد
======================= */
const adsBtn     = document.getElementById("adsbtn");
const adsBtnn    = document.getElementById("adsbtnn");
const adsBalance = document.getElementById("adsbalance");
const adsNotfi   = document.getElementById("adsnotifi");
let progres = document.getElementById("progres")
let adstime = document.getElementById("adstime")

let ADS   = 0;
let timer = null;
let dailyLimit = null;
let dailyProgres = 100;
let progresLimit = 60* 60000;

/* =======================
   Ads providers integration
   - AdsGram (rewarded) using blockId "int-20679"
   - libtl (show_10245709) assumed available in host page
   We will require three ads in sequence before crediting reward.
======================= */

let AdsGramController = null;

function initAdsGram(){
    try {
        if (window.Adsgram && typeof window.Adsgram.init === 'function') {
            AdsGramController = window.Adsgram.init({ blockId: "int-20679" });
            return true;
        }
        console.warn('[AdsGram] SDK not ready');
        return false;
    } catch (e) {
        console.warn('[AdsGram] init error:', e);
        return false;
    }
}

async function showAdsGramRewarded(){
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

/* =======================
   New flow per request:
   - When user clicks adsBtn:
     * Immediately switch to adsBtnn and start a cooldown timer (timeLeft).
     * Run three ads in sequence (best-effort).
     * If all ads complete -> credit reward (ADS += 100).
     * If any ad is cancelled/failed -> show appropriate toast/alert but cooldown still applies.
   - adsBtnn shows remaining seconds until next allowed watch.
======================= */

const ADS_COOLDOWN_SECONDS = 60; // time before user can watch again
let adsCooldownInterval = null;
let adsCooldownRemaining = 0;
let adSequenceRunning = false;

function startAdsCooldown(seconds) {
  // clear previous
  if (adsCooldownInterval) {
    clearInterval(adsCooldownInterval);
    adsCooldownInterval = null;
  }
  adsCooldownRemaining = seconds;
  if (adsBtnn) {
    adsBtnn.style.display = 'block';
    adsBtnn.textContent = adsCooldownRemaining + "s";
    adsBtnn.disabled = true;
  }
  if (adsBtn) {
    adsBtn.style.display = 'none';
    adsBtn.disabled = true;
  }
  adsCooldownInterval = setInterval(() => {
    adsCooldownRemaining--;
    if (adsBtnn) adsBtnn.textContent = adsCooldownRemaining + "s";
    if (adsCooldownRemaining <= 0) {
      clearInterval(adsCooldownInterval);
      adsCooldownInterval = null;
      if (adsBtnn) {
        adsBtnn.style.display = 'none';
        adsBtnn.textContent = "";
        adsBtnn.disabled = false;
      }
      if (adsBtn) {
        adsBtn.style.display = 'block';
        adsBtn.disabled = false;
      }
    }
  }, 1000);
}

async function playLibtlAdSafe() {
  // wrapper to call show_10245709 if available, returns true if finished, false if error/cancel
  if (typeof show_10245709 === 'function') {
    try {
      await show_10245709();
      return { ok: true };
    } catch (e) {
      console.warn('libtl ad error:', e);
      return { ok: false, error: e };
    }
  } else {
    console.warn('libtl show_10245709 not available');
    return { ok: false, error: 'not_available' };
  }
}

adsBtn.addEventListener("click", async function () {
  // prevent re-entry
  if (adSequenceRunning) return;

  adSequenceRunning = true;

  // start immediate cooldown UI
  startAdsCooldown(ADS_COOLDOWN_SECONDS);

  // ensure AdsGram initialized
  if (!AdsGramController) initAdsGram();

  let allAdsCompleted = true;
  let adErrors = [];

  try {
    // Ad 1 (libtl)
    try {
      if (typeof show_10245709 === 'function') {
        // show and await
        await show_10245709();
      } else {
        // fallback: try AdsGram if libtl missing
        const a = await showAdsGramRewarded();
        if (!a.ok) throw new Error('ad1_failed');
      }
    } catch (e) {
      allAdsCompleted = false;
      adErrors.push({ idx: 1, err: e });
      console.warn('Ad 1 failed or cancelled:', e);
    }

    // Ad 2 (libtl)
    try {
      if (typeof show_10245709 === 'function') {
        await show_10245709();
      } else {
        const a = await showAdsGramRewarded();
        if (!a.ok) throw new Error('ad2_failed');
      }
    } catch (e) {
      allAdsCompleted = false;
      adErrors.push({ idx: 2, err: e });
      console.warn('Ad 2 failed or cancelled:', e);
    }

    // Ad 3 (prefer AdsGram rewarded for final reward)
    try {
      // Prefer AdsGram for last ad; fallback to libtl
      let result = await showAdsGramRewarded();
      if (!result.ok) {
        // fallback to libtl if available
        if (typeof show_10245709 === 'function') {
          try {
            await show_10245709();
            result = { ok: true };
          } catch (ee) {
            result = { ok: false, error: ee };
          }
        }
      }

      if (!result.ok) {
        throw result.error || new Error('ad3_failed');
      }
    } catch (e) {
      allAdsCompleted = false;
      adErrors.push({ idx: 3, err: e });
      console.warn('Ad 3 failed or cancelled:', e);
    }

    // After attempts: if at least the ads sequence fully completed -> give reward
    if (allAdsCompleted) {
      ADS += 100;
      if (adsBalance) adsBalance.textContent = ADS;

      // play success sound
      try { soundads.currentTime = 0; soundads.play(); } catch(e){}

      // show notification (reuse existing UI if available)
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

      // decrement daily progress and check limits (preserve original logic)
      dailyProgres --;
      if (progres) progres.textContent = dailyProgres;
      if (dailyProgres <= 0) {
        // lock ads similarly to original logic
        if (adsBtn) adsBtn.style.display = 'none';
        if (adsBtnn) {
          adsBtnn.style.display = "block";
          adsBtnn.textContent = progresLimit;
          adsBtnn.style.background = 'red';
        }
        dailyLimit = setInterval(function(){
          progresLimit --;
          if (adsBtnn) adsBtnn.textContent = progresLimit;
          if (progresLimit <= 0) {
            clearInterval(dailyLimit);
            if (adsBtnn) adsBtnn.style.display = 'none';
            if (adsBtn) adsBtn.style.display = 'block';
            if (adsBtnn) adsBtnn.style.background = '';
            progresLimit = 60* 60000;
            dailyProgres = 100;
            if (progres) progres.textContent = dailyProgres;
          }
        }, 1000);
      }

    } else {
      // Some ad(s) failed or were skipped: inform user (still keep cooldown)
      try {
        if (typeof showCustomAlert === 'function') {
          // If one of errors was because user canceled (common), show friendly message
          const wasCancelled = adErrors.some(e => String(e.err).toLowerCase().includes('cancel') || String(e.err).toLowerCase().includes('not_done'));
          if (wasCancelled) {
            showCustomAlert('Ad Cancelled', 'You must watch each ad fully to receive the reward. Try again after the cooldown.', 'warning');
          } else {
            showCustomAlert('Ad Error', 'One or more ads failed to complete. Try again after the cooldown.', 'error');
          }
        } else {
          alert('Ad sequence incomplete. See console for details.');
        }
      } catch(e){}
    }

  } catch (outerErr) {
    console.error('Unexpected error in ad sequence:', outerErr);
    try { if (typeof showCustomAlert === 'function') showCustomAlert('Ad Error', 'Unexpected error. Please try again later.', 'error'); } catch(e){}
  } finally {
    adSequenceRunning = false;
    // do not cancel cooldown — per request cooldown remains enforced by adsBtnn/timeLeft
    // ensure UI shows updated balance
    if (adsBalance) adsBalance.textContent = ADS;
  }
});

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

let menubtn = document.querySelector(".menub")
if(menubtn){
  menubtn.style.display = 'none'
  setTimeout(function(){
   menubtn.style.display = 'block'
   menubtn.style.display = 'flex'
  }, 8100)
}


//نسخ رابط احاله//
let copyrefal = document.getElementById("copy");
let link = document.getElementById("link");
let refaltext = link ? document.getElementById("link").textContent : '';
let copyImge = document.getElementById("copyImg")
let copynotifi = document.querySelector(".copynotifi")

if (copyrefal) {
  copyrefal.addEventListener("click",function(){
    if (copyImge) copyImge.src = 'approve.png'
    if (copynotifi) {
      copynotifi.style.display = 'block'
      copynotifi.style.top = '-48%'
    }
    if (copyrefal) copyrefal.style.boxShadow = '0 0px 0 #EBEBF0'

    setTimeout(function(){
      if (copynotifi) { copynotifi.style.display = 'none'; copynotifi.style.top = '';}
    }, 2000)
    navigator.clipboard.writeText(refaltext).then(function() {
      setTimeout(function(){
       if (copyImge) copyImge.src = 'copy.png'
       if (copyrefal) copyrefal.style.boxShadow = '0 5px 0 #7880D3'
      }, 800);
    });
  });
}

//اضافه مهمه تاسك//
let creatTask = document.getElementById("creatTask");


if (creatTask) {
  creatTask.addEventListener("click",function(){
   let nametask = document.getElementById("taskNameInput").value;
   let linktask = document.getElementById("taskLinkInput").value;
   let taskcontainer = document.querySelector(".task-container")
   let taskcard = document.createElement("div")
   taskcard.className = "task-card"

    taskcard.innerHTML = `
    <span class="task-name">${nametask}</span>
    <span class="task-prize">30 <img src="coins.png" width="25" ></span>
    <a class="task-link" href="${linktask}">start</a>
    `;
  if (taskcontainer) taskcontainer.appendChild(taskcard)


  if (document.getElementById("taskNameInput")) document.getElementById("taskNameInput").value = ''
   if (document.getElementById("taskLinkInput")) document.getElementById("taskLinkInput").value = ''

  });
}

/* =======================
   باقي منطق الصفحة (لم يتغير)
   ... (لا تتغير بقية وظائف التطبيق في هذا الملف)
   — يمكنك إبقاء بقية الكود كما كان سابقًا (إظهار الصفحات، إدارة المهام، المسابقة، السحب ... الخ).
   — للتبسيط عرضت هنا التعديلات المهمة فقط المتعلّقة بزر الإعلانات والـ cooldown.
======================= */

/* ملاحظة:
   إذا أردت أن أدمج التعديل مباشرة داخل سكربت كامل موجود لديك (بما فيه كل الدوال والوظائف الأخرى من ملفات سابقة)
   أرسل لي الملف الكامل الحالي وسأدرج التعديلات بدقة في مواضعها.
*/