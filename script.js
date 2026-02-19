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
   AdsGram integration
   أخذت الكود من ads.html ووضعت دوال تهيئة واستدعاء هنا
======================= */
let AdsGramController = null;

/**
 * initAdsGram()
 * يحاول تهيئة SDK إذا كانت محمّلة
 * يعيد true إن تم التهيئة بنجاح، false خلاف ذلك
 */
function initAdsGram(){
    try {
        if (window.Adsgram && typeof window.Adsgram.init === 'function') {
            // blockId: استخدم blockId الموجود في ads.html (قابل للتغيير حسب حسابك)
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

/**
 * showAdsGramRewarded()
 * يحاول عرض الإعلان المكافئ عبر AdsGram ويتعامل مع الأخطاء
 * يعيد كائن { ok: boolean, reason?: string, result?: any, error?: any }
 */
async function showAdsGramRewarded(){
    if (!AdsGramController) initAdsGram();

    if (!AdsGramController || typeof AdsGramController.show !== 'function') {
        return { ok: false, reason: 'not_ready' };
    }

    try {
        const result = await AdsGramController.show();
        // تحقق من النتيجة إن احتجنا
        if (result && result.done === false) {
            return { ok: false, reason: 'not_done', result };
        }
        return { ok: true, result };
    } catch (error) {
        return { ok: false, reason: 'error', error };
    }
}

/* =======================
   عند الضغط على زر الإعلان (القديم)
   هذا الزر يبقى كما هو، لكنه مستقل عن AdsGram.
======================= */
adsBtn.addEventListener("click", function () {

  adsBtn.style.display  = "none";
  adsBtnn.style.display = "block";
  let timeLeft = 2;
  adsBtnn.textContent = timeLeft + "s";
  

  timer = setInterval(function () {

    timeLeft--;
    adsBtnn.textContent = timeLeft + "s";
    
    
    

    if (timeLeft <= 0) {

     
      // زيادة الرصيد
      ADS += 100;
      adsBalance.textContent = ADS;
     
   


      // تشغيل صوت المكافأة
      soundads.currentTime = 0;
      soundads.play();

      // إعادة الزر
      clearInterval(timer);
      adsBtnn.style.display = "none";
      adsBtn.style.display  = "block";

      // إظهار الإشعار
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

   
  dailyProgres --;
  progres.textContent = dailyProgres;
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
  
  
  

});

/* =======================
   زر AdsGram الجديد في الواجهة الرئيسية
   سيحاول عرض إعلان AdsGram مكافئ ثم يمنح الجائزة محلياً (مثال: +100)
======================= */
const adsGramBtn = document.getElementById('adsgramBtn');
if (adsGramBtn) {
    adsGramBtn.addEventListener('click', async function () {
        // تأكد من تهيئة الـ SDK أول مرة
        if (!AdsGramController) {
            const ok = initAdsGram();
            if (!ok) {
                // SDK لم يُحمّل بعد - شبّه رسالة بسيطة للمستخدم
                alert('AdsGram SDK not ready yet. Please try again in a moment.');
                return;
            }
        }

        // تعطيل الزر أثناء المعالجة
        adsGramBtn.disabled = true;
        adsGramBtn.textContent = 'Loading...';

        try {
            const res = await showAdsGramRewarded();

            if (!res.ok) {
                // تعامل مع الأسباب الشائعة
                if (res.reason === 'not_ready') {
                    alert('AdsGram not ready. Try again later.');
                } else if (res.reason === 'not_done') {
                    alert('You did not finish watching the ad. No reward.');
                } else {
                    console.warn('AdsGram show error:', res.error || res);
                    alert('Ad error. Try again later.');
                }
                return;
            }

            // إعلان تم مشاهدته بنجاح — امنح المستخدم الجائزة محلياً
            ADS += 100;
            adsBalance.textContent = ADS;

            // تشغيل صوت المكافأة
            try {
                soundads.currentTime = 0;
                soundads.play();
            } catch (e) {}

            // إظهار إشعار مرئي مشابه لزر الإعلانات القديم
            adsNotfi.style.display = "block";
            adsNotfi.style.opacity = "0.9";
            adsNotfi.style.transform = "translateY(135px)";

            setTimeout(function () {
                adsNotfi.style.transform = "translateY(-150%)";
                adsNotfi.style.opacity = "0";
            }, 2200);

            setTimeout(function () {
                adsNotfi.style.display = "none";
                adsNotfi.style.transform = "";
                adsNotfi.style.opacity = "";
            }, 2600);

            // قلل قيمة الـ progress اليومي بنفس منطقك (مثال)
            dailyProgres--;
            progres.textContent = dailyProgres;

            // لو وصلت للحد اليومي أوقف الزر الأصلي (مثال بسيط)
            if (dailyProgres <= 0) {
                adsGramBtn.disabled = true;
                adsGramBtn.textContent = 'Daily limit';
            }

        } catch (e) {
            console.error('AdsGram flow failed:', e);
            alert('An error occurred while showing the ad.');
        } finally {
            // أعد تفعيل الزر لو لم يتجاوز الحد
            if (dailyProgres > 0) {
                adsGramBtn.disabled = false;
                adsGramBtn.textContent = 'Watch AdsGram Ad';
            }
        }
    });
}

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