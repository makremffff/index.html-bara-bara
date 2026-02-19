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
  if (mainPage) mainPage.style.display    = "none";
  if (taskPage) taskPage.style.display    = "none";
  if (walletPage) walletPage.style.display  = "none";
  if (sharePage) sharePage.style.display = 'none'
 
  if (addTaskpage) addTaskpage.style.display = 'none'
  // إظهار الصفحة المطلوبة
  if (btnpage) btnpage.style.display = "block";

  // ��ظهار شاشة التحميل
  if (loadpage) loadpage.style.display = "block";
  if (pagename) pagename.textContent = "Loading";
  if (barbtn) barbtn.style.display = 'none'
  setTimeout(function(){
    if (barbtn) barbtn.style.display = 'block'
  }, 2000)
  

  // تشغيل صوت التنقّل
  try { if (soundbtn) { soundbtn.currentTime = 0; soundbtn.play(); } } catch(e){}

  // إخفاء شاشة التحميل بعد 2 ثواني
  setTimeout(function () {
    if (loadpage) loadpage.style.display = "none";
  }, 2000);
  
}


/* =======================
   ربط الأزرار بالصفحات
======================= */
if (btnMain) btnMain.addEventListener("click", function () {
  showPage(mainPage);
});

if (btnTask) btnTask.addEventListener("click", function () {
  showPage(taskPage);
});

if (btnWallet) btnWallet.addEventListener("click", function () {
  showPage(walletPage);
  
    
    if (walletbalance) walletbalance.innerHTML = `
      <img src="coins.png" style="width:20px; vertical-align:middle;">
      ${ADS}
    `;
    
});

if (btnshare) btnshare.addEventListener("click",function(){showPage(sharePage)
  
});

if (bntaddTask) bntaddTask.addEventListener('click',function(){showPage(addTaskpage)})

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
   نظام إعلانات ثلاثي + كولداون
   - يشغّل ثلاثة إعلانات متتالية قبل منح الرصيد
   - يفعّل adsBtnn مع timeLeft فور الضغط (كولداون)
   - يمنع ظهور تحذيرات/رسائل أثناء تشغيل السلسلة ثم يعرض رسالة نهائية بعد انتهائها
   - يستخدم libtl (show_10245709) إن كانت متوفرة و AdsGram مع نفس blockId "int-20679"
======================= */

let AdsGramController = null;
let adSequenceRunning = false;
let suppressAdAlerts = false; // لمنع عرض التنبيهات أثناء السلسلة
const ADS_COOLDOWN_SECONDS = 60; // مدة الكولداون بالثواني (يمكن تعديلها)
let adsCooldownInterval = null;
let adsCooldownRemaining = 0;

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

async function playLibtlAdSafe() {
  // wrapper لنداء show_10245709 إن كانت متاحة
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

function startAdsCooldown(seconds) {
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
        adsBtnn.style.background = "";
      }
      if (adsBtn) {
        adsBtn.style.display = 'block';
        adsBtn.disabled = false;
      }
    }
  }, 1000);
}

// override عرض التنبيهات العالمية أثناء السلسلة (إن وجدت)
if (typeof window.showCustomAlert === 'function') {
  const _origAlert = window.showCustomAlert;
  window.showCustomAlert = function(title, msg, type) {
    if (suppressAdAlerts) {
      // تجاهل مؤقت للرسائل أثناء إتمام سلسلة الإعلانات
      console.log('Alert suppressed during ad sequence:', title);
      return;
    }
    return _origAlert(title, msg, type);
  };
}

if (adsBtn) {
  adsBtn.addEventListener("click", async function () {
    if (adSequenceRunning) return;

    adSequenceRunning = true;
    suppressAdAlerts = true;

    // ابدأ الكولداون فوراً
    startAdsCooldown(ADS_COOLDOWN_SECONDS);

    // تأكد من تهيئة AdsGram
    if (!AdsGramController) initAdsGram();

    const adResults = []; // نجمع نتائج كل إعلان { idx, ok, info?, error? }

    try {
      // Ad 1
      if (adsBtnn) adsBtnn.textContent = "Ad 1 / 3";
      try {
        const r1 = await playLibtlAdSafe();
        adResults.push({ idx: 1, ok: !!r1.ok, info: r1 });
      } catch (e) {
        adResults.push({ idx: 1, ok: false, error: e });
      }

      // Ad 2
      if (adsBtnn) adsBtnn.textContent = "Ad 2 / 3";
      try {
        const r2 = await playLibtlAdSafe();
        adResults.push({ idx: 2, ok: !!r2.ok, info: r2 });
      } catch (e) {
        adResults.push({ idx: 2, ok: false, error: e });
      }

      // Ad 3 (prefer AdsGram ثم fallback إلى libtl)
      if (adsBtnn) adsBtnn.textContent = "Ad 3 / 3";
      try {
        let r3 = await showAdsGramRewarded();
        if (!r3.ok && typeof show_10245709 === 'function') {
          const fallback = await playLibtlAdSafe();
          r3 = fallback;
        }
        adResults.push({ idx: 3, ok: !!r3.ok, info: r3 });
      } catch (e) {
        adResults.push({ idx: 3, ok: false, error: e });
      }

      // قرّر النتيجة النهائية بعد انتهاء الثلاثة إعلانات
      const allCompleted = adResults.every(ar => ar.ok === true);

      suppressAdAlerts = false; // الآن نعرض الرسالة النهائية

      if (allCompleted) {
        // منح الرصيد
        ADS += 100;
        if (adsBalance) adsBalance.textContent = ADS;

        // تشغيل صوت المكافأة
        try { if (soundads) { soundads.currentTime = 0; soundads.play(); } } catch(e){}

        // إظهار إشعار بصري (حافظت على نفس الحركة)
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

        // تحديث dailyProgres كما في المنطق القديم
        dailyProgres--;
        if (progres) progres.textContent = dailyProgres;
        if (dailyProgres <= 0) {
          if (adsBtn) adsBtn.style.display = 'none';
          if (adsBtnn) {
            adsBtnn.style.display = "block";
            adsBtnn.textContent = progresLimit;
            adsBtnn.style.background = 'red';
          }
          dailyLimit = setInterval(function(){
            progresLimit--;
            if (adsBtnn) adsBtnn.textContent = progresLimit;
            if (progresLimit <= 0) {
              clearInterval(dailyLimit);

              if (adsBtnn) adsBtnn.style.display = 'none';
              if (adsBtn) adsBtn.style.display = 'block';
              if (adsBtnn) adsBtnn.style.background = ''
              progresLimit = 60* 60000;
              dailyProgres = 100;
              if (progres) progres.textContent = dailyProgres;
            }
          }, 1000)
        }

        // رسالة نجاح موحدة
        try {
          if (typeof showCustomAlert === 'function') showCustomAlert('Reward Granted!', 'You received 100 SHIB for watching the ads.', 'success');
          else alert('You received 100 SHIB for watching the ads.');
        } catch (e) { /* ignore */ }

      } else {
        // فشل أو إلغاء: عرض رسالة موحدة
        let wasCancelled = adResults.some(r => {
          const reason = (r.info && r.info.reason) ? String(r.info.reason).toLowerCase() : '';
          const err = String(r.error || '');
          return reason.includes('not_done') || err.toLowerCase().includes('cancel') || err.toLowerCase().includes('not_done');
        });

        try {
          if (typeof showCustomAlert === 'function') {
            if (wasCancelled) {
              showCustomAlert('Ad Cancelled', 'You must watch each ad fully to receive the reward. Try again after the cooldown.', 'warning');
            } else {
              showCustomAlert('Ad Error', 'One or more ads failed to complete. Try again after the cooldown.', 'error');
            }
          } else {
            alert(wasCancelled ? 'Ad Cancelled: watch full ads to get reward.' : 'Ad Error: some ads failed.');
          }
        } catch (e) {}
      }

    } catch (outerErr) {
      suppressAdAlerts = false;
      console.error('Unexpected ad-sequence error', outerErr);
      try { if (typeof showCustomAlert === 'function') showCustomAlert('Ad Error', 'Unexpected error occurred. Please try again after the cooldown.', 'error'); } catch(e){}
    } finally {
      adSequenceRunning = false;
      suppressAdAlerts = false;
      // تأكد من تحديث عرض الرصيد
      if (adsBalance) adsBalance.textContent = ADS;
      // ملاحظة: الكولداون يبقى مفعلًا حتى ينتهي الوقت
    }
  });
}

/* =======================
   شاشة التحميل عند الدخول
======================= */
if (loadpage) loadpage.style.display = "block";
if (pagename) pagename.style.display = "none";

setTimeout(function () {
  if (loadpage) loadpage.style.display = "none";
  if (loadpage) loadpage.style.background = "black";
  if (pagename) pagename.style.display = "block";
}, 8000);

let menubtn = document.querySelector(".menub")
if (menubtn) {
  menubtn.style.display = 'none'
  setTimeout(function(){
   menubtn.style.display = 'block'
   menubtn.style.display = 'flex'
  }, 8100)
}


//نسخ رابط احاله//
let copyrefal = document.getElementById("copy");
let link = document.getElementById("link");
let refaltext = link ? link.textContent : '';
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