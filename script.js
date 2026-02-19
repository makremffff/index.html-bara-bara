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
   We will require three ads in sequence before crediting reward:
      show_10245709()  -> show_10245709() -> AdsGram.rewarded
======================= */

let AdsGramController = null;

function initAdsGram(){
    try {
        if (window.Adsgram && typeof window.Adsgram.init === 'function') {
            AdsGramController = window.Adsgram.init({ blockId: "int-20679" });
            return true;
        }
        // SDK not loaded yet; will attempt later
        console.warn('[AdsGram] SDK not ready');
        return false;
    } catch (e) {
        console.warn('[AdsGram] init error:', e);
        return false;
    }
}

async function showAdsGramRewarded(){
    // returns { ok: boolean, reason?: string, result?: any, error?: any }
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
   عند الضغط على زر الإعلان
   الآن سيُشغّل 3 إعلانات متتالية قبل منح الرصيد
   نحافظ على أزرار adsBtnn وواجهة العدّ التنازلي والإشعار كما كانت
======================= */
adsBtn.addEventListener("click", async function () {

  // حماية من النقر المزدوج السريع
  if (adsBtn.disabled) return;

  // إخفاء زر المشاهدة وإظهار زر الحالة (ثانوي)
  adsBtn.style.display  = "none";
  adsBtnn.style.display = "block";
  adsBtnn.textContent = "Preparing...";

  // تحضير AdsGram إذا لم يكن موجوداً
  if (!AdsGramController) initAdsGram();

  try {
    // Attempt to run three ads in sequence.
    // 1) First libtl ad (show_10245709)
    adsBtnn.textContent = "Ad 1 / 3";
    if (typeof show_10245709 === 'function') {
        await show_10245709();
    } else {
        console.warn('show_10245709 not available; skipping ad 1');
        // allow to continue — server may still validate
    }

    // 2) Second libtl ad
    adsBtnn.textContent = "Ad 2 / 3";
    if (typeof show_10245709 === 'function') {
        await show_10245709();
    } else {
        console.warn('show_10245709 not available; skipping ad 2');
    }

    // 3) AdsGram rewarded ad
    adsBtnn.textContent = "Ad 3 / 3";
    const adsgram = await showAdsGramRewarded();

    if (!adsgram.ok) {
        // If AdsGram not ready / canceled, we treat it as a failure and restore UI
        if (adsgram.reason === 'not_ready') {
            // AdsGram not available — try a fallback third libtl if possible
            if (typeof show_10245709 === 'function') {
                adsBtnn.textContent = "Fallback Ad 3 / 3";
                try { await show_10245709(); }
                catch(e){ console.warn('Fallback ad failed', e); throw e; }
            } else {
                throw new Error('AdsGram_not_ready_and_no_fallback');
            }
        } else if (adsgram.reason === 'not_done') {
            // user skipped/cancelled the rewarded ad
            throw new Error('ad_not_completed');
        } else {
            throw new Error('adsgram_error');
        }
    }

    // إذا وصلت هنا، جميع الإعلانات اكتملت بنجاح — منح الرصيد
    ADS += 100;
    if (adsBalance) adsBalance.textContent = ADS;

    // تشغيل صوت المكافأة (إن وجد)
    try { soundads.currentTime = 0; soundads.play(); } catch(e){}

    // إظهار الإشعار بنفس حركات الإشعار القديمة
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

    // تحديث عداد التقدّم اليومي كما في الشيفرة القديمة
    dailyProgres --;
    if (progres) progres.textContent = dailyProgres;
    if (dailyProgres <= 0) {
      adsBtn.style.display = 'none'
      adsBtnn.style.display = "block"
      adsBtnn.textContent = progresLimit;
      adsBtnn.style.background = 'red'
      dailyLimit = setInterval(function(){

        progresLimit --;
        adsBtnn.textContent = progresLimit;

        if (progresLimit <= 0) {
          clearInterval(dailyLimit);

          adsBtnn.style.display = 'none'
          adsBtn.style.display = 'block'
          adsBtnn.style.background = ''
          progresLimit = 60* 60000;
          dailyProgres = 100;
          if (progres) progres.textContent = dailyProgres;

        }

      }, 1000)
    }

  } catch (err) {
    // تعامل مع الأخطاء: إعادة زر المشاهدة وإظهار رسالة مبسطة (يمكن تعديلها لتستخدم showCustomAlert إن رغبت)
    console.error('Ad sequence error:', err);
    // حاول إظهار ملاحظة بسيطة للمستخدم (إن كانت الدالة متوفرة في السياق)
    try {
      if (typeof showCustomAlert === 'function') {
        if (String(err.message || err).includes('ad_not_completed')) {
          showCustomAlert('Ad Cancelled', 'You must watch the full ad to receive the reward.', 'warning');
        } else {
          showCustomAlert('Ad Error', 'An ad failed to load or complete. Please try again.', 'error');
        }
      } else {
        alert('Ad Error: ' + (err.message || err));
      }
    } catch(e){}

  } finally {
    // إعادة زرّ الحالة للزر الأساسي (إن لم نقطع بسبب daily limit)
    // إذا dailyProgres وصلت للصفر، المنطق أعلاه سيترك الأزرار في حالة القفل المناسبة
    if (dailyProgres > 0) {
      adsBtnn.style.display = "none";
      adsBtn.style.display = "block";
      adsBtnn.textContent = "";
      adsBtnn.style.background = "";
    }
    // تأكد من تحديث عرض الرصيد في واجهة المستخدم إن وُجد
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
menubtn.style.display = 'none'
setTimeout(function(){
 menubtn.style.display = 'block'
 menubtn.style.display = 'flex'
}, 8100)


//نسخ رابط احاله//
let copyrefal = document.getElementById("copy");
let link = document.getElementById("link");
let refaltext = document.getElementById("link").textContent
let copyImge = document.getElementById("copyImg")
let copynotifi = document.querySelector(".copynotifi")

copyrefal.addEventListener("click",function(){
copyImge.src = 'approve.png'
copynotifi.style.display = 'block'
copynotifi.style.top = '-48%'
copyrefal.style.boxShadow = '0 0px 0 #EBEBF0'

setTimeout(function(){
  copynotifi.style.display = 'none'
copynotifi.style.top = ''
}, 2000)
navigator.clipboard.writeText(refaltext).then(function() {
    

  setTimeout(function(){
   copyImge.src = 'copy.png'
   copyrefal.style.boxShadow = '0 5px 0 #7880D3'

   
  }, 800);
  });

});

//اضافه مهمه تاسك//
let creatTask = document.getElementById("creatTask");


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
taskcontainer.appendChild(taskcard)


document.getElementById("taskNameInput").value = ''
 document.getElementById("taskLinkInput").value = ''

});