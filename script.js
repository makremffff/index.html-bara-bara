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
   عند الضغط على زر الإعلان
======================= */

adsBtn.addEventListener("click", async function () {

  try {

    const AdController = window.Adsgram.init({ blockId: "int-20679" });

    adsBtn.style.display  = "none";
    adsBtnn.style.display = "block";
    adsBtnn.textContent = "Loading...";

    await AdController.show();

    ADS += 100;
    adsBalance.textContent = ADS;

    soundads.currentTime = 0;
    soundads.play();

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

    adsBtnn.style.display = "none";
    adsBtn.style.display  = "block";

  } catch (error) {

    adsBtn.style.display  = "block";
    adsBtnn.style.display = "none";
    console.error(error);

  }

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
