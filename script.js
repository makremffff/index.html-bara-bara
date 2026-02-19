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
   AdsGram integration (مأخوذ من ads.html)
   مهيأ للعمل عند الضغط على الزر الأصلي بدون تغيير في شكله
======================= */
let AdsGramController = null;

function initAdsGram(){
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
   دالة جائزة موحّدة لإعادة الاستخدام
======================= */
function grantLocalAdReward(amount = 100){
  ADS += amount;
  adsBalance.textContent = ADS;

  try {
    soundads.currentTime = 0;
    soundads.play();
  } catch (e) {}

  // إظهار الإشعار بنفس تأثير الزر القديم
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

  // تحديث التقدّم اليومي (مثل المنطق القديم)
  dailyProgres --;
  progres.textContent = dailyProgres;
}

/* =======================
   المنطق القديم كدالة قابلة لإعادة الاستدعاء
======================= */
function startLocalAdSequence(){
  // يحاكي السلوك القديم (العد التنازلي ثم منح الجائزة)
  adsBtn.style.display  = "none";
  adsBtnn.style.display = "block";
  let timeLeft = 2;
  adsBtnn.textContent = timeLeft + "s";

  timer = setInterval(function () {

    timeLeft--;
    adsBtnn.textContent = timeLeft + "s";

    if (timeLeft <= 0) {

      clearInterval(timer);
      // منح الجائزة
      grantLocalAdReward(100);

      // إعادة الزر
      adsBtnn.style.display = "none";
      adsBtn.style.display  = "block";

      // نفس منطق الحد اليومي
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
          progres.textContent = dailyProgres;
            
          }
          
        }, 1000)
        
      }

    }

  }, 1000);
}

/* =======================
   حدث الضغط على الزر الأصلي adsBtn
   الآن يحاول عرض AdsGram أولاً، وإذا لم يكن جاهزًا أو فشل يستدعي السلوك القديم
   دون تغيير شكل الزر أو إضافة أزرار جديدة
======================= */
adsBtn.addEventListener("click", async function () {
  // حاول تهيئة SDK إن لم تكن مهيأة
  if (!AdsGramController) {
    initAdsGram();
  }

  // إذا SDK غير جاهز استعمل السلوك القديم
  if (!AdsGramController || typeof AdsGramController.show !== 'function') {
    startLocalAdSequence();
    return;
  }

  // تعطيل الزر مؤقتًا لمنع النقر المتكرر أثناء عرض الإعلان
  adsBtn.disabled = true;
  try {
    const res = await showAdsGramRewarded();
    if (!res.ok) {
      // إذا المستخدم لم يكمل الإعلان أو SDK غير جاهز، نرجع للسلوك القديم
      if (res.reason === 'not_ready' || res.reason === 'error') {
        startLocalAdSequence();
      } else if (res.reason === 'not_done') {
        // لم يشاهد للمحتوى كاملاً -> لا جائزة، عرض إشعار بسيط (بدون تغيير شكل الزر)
        try { alert('Ad not finished — no reward.'); } catch(e){}
      } else {
        startLocalAdSequence();
      }
      return;
    }

    // إعلان AdsGram اكتمل — منح الجائزة مباشرة وإظهار الإشعار
    grantLocalAdReward(100);

    // تعطيل مؤقت أو منطق الحد اليومي إن لزم
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
        progres.textContent = dailyProgres;
          
        }
        
      }, 1000)
      
    }

  } catch (e) {
    console.error('AdsGram invocation failed:', e);
    // فشل غير متوقع -> عد للسلوك القديم
    startLocalAdSequence();
  } finally {
    adsBtn.disabled = false;
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