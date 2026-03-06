// Telegram WebApp
let tg = window.Telegram.WebApp;
tg.expand();

// جلب بيانات المستخدم
let user = tg.initDataUnsafe.user;

if (user) {

let userid = user.id;
let firstname = user.first_name || "";
let lastname = user.last_name || "";
let fullname = firstname + " " + lastname;
let photo = user.photo_url || "";

// صورة المستخدم
let userPhoto = document.querySelector(".user-fhoto");

if(photo){
userPhoto.innerHTML = `
<img src="${photo}" >
`;
}else{
userPhoto.innerHTML = `
<img src="asesst/user.png" >
`;
}

// الاسم + welcome كل واحد span
let usernameBox = document.querySelector(".user-name");

usernameBox.innerHTML = `
<span style="color:#ffeedd;font-size:20px;">♪WellCome♫</span>
<span> ${fullname}</span>
`;

// رابط الإحالة
let refLink = `https://t.me/Bot_ad_watchbot/earn?startapp=ref_${userid}`;

let refBox = document.querySelector(".refal-link span");

if(refBox){
refBox.innerHTML = refLink;
}

}


// ازرار الصفحات
let mainbtn = document.getElementById("mainbtn");
let taskbtn = document.getElementById("taskbtn");
let walletbtn = document.getElementById("walletbtn");
let gamebtn = document.getElementById("gamebtn");
let refalbtn = document.getElementById("refalbtn");

// الصفحات
let mainpage = document.getElementById("main");
let taskpage = document.getElementById("task");
let walletpage = document.getElementById("wallet");
let gamepage = document.getElementById("game");
let refalpage = document.getElementById("refal");

// اظهار الصفحات
function showpage(page){
mainpage.style.display = 'none';
taskpage.style.display = 'none';
gamepage.style.display = 'none';
refalpage.style.display = 'none';
walletpage.style.display = 'none';

page.style.display = 'block';
}


// صور الاعلانات
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

setInterval(function(){

i++;

if(i >= images.length){
i = 0;
}

boximg.innerHTML = `<img src="${images[i]}" width="250">`;

},10000);


// تغيير لون topup
let topup = document.querySelector(".top-up");
let taskadd = document.getElementById("taskadd");

taskadd.addEventListener("change", function () {

if (taskadd.checked) {
topup.style.color = "blue";
} else {
topup.style.color = "";
}

});


// انشاء مهمة
let creatTaskbtn = document.getElementById("createtask");

creatTaskbtn.addEventListener("click",function(){

let taskname = document.getElementById("taskname").value;
let tasklink = document.getElementById("tasklink").value;

let taskcard = document.createElement("div");
taskcard.classList = 'task-card';

taskcard.innerHTML = `
<img class="task-img" src="asesst/telegram.png" width="25">
<span class="task-name">${taskname}</span>
<span class="task-prize">500 <img src="asesst/pepe.png" width="25" height="28"></span>
<a class="task-link" href="${tasklink}" target="_blank">Join</a>
`;

let taskContainer = document.getElementById("task");

taskContainer.appendChild(taskcard);

document.getElementById("taskname").value = '';
document.getElementById("tasklink").value = '';

});


// الصوت
const audio = document.getElementById("audio");

document.addEventListener("click", () => {
audio.play();
});


let btnsound = document.getElementById("clicksound");

let btns = document.querySelector(".btn-bar");

btns.addEventListener("click",function(){
btnsound.play();
});


// زر join
document.addEventListener("click", function(e){

if(e.target.classList.contains("task-link")){

e.target.textContent = 'Check';

setTimeout(function(){

e.target.innerHTML = `<img src="asesst/check.gif" width="23">`;

},2000);

}

});


// نسخ رابط الاحالة
let copyBtn = document.getElementById("copy");

if(copyBtn){

copyBtn.addEventListener("click",function(){

let link = document.querySelector(".refal-link span").innerText;

navigator.clipboard.writeText(link);

copyBtn.innerHTML = `<img src="asesst/approve.png" width="26">`;

setTimeout(()=>{
copyBtn.innerHTML = `<img src="asesst/copy.png" width="26">`;
},2000);

});

}
let watchBtn = document.getElementById("watch");

let adsWatched = 0;
let userBalance = 0;

watchBtn.addEventListener("click", showAd);

function showAd(){

let adController = window.Adsgram.init({
  blockId: "int-20679",
  debug: true
});

adController.show().then(() => {

adsWatched++;

if(adsWatched < 3){

// تشغيل اعلان ثاني
showAd();

}else{

// اعطاء المكافأة
adsWatched = 0;
userBalance += 100;

document.querySelector(".user-balance span").innerHTML =
userBalance + `<img src="asesst/pepe.png" width="23" height="30">`;

document.querySelector(".user-ads h3").innerText++;

document.querySelector(".notifi").style.display = "block";

setTimeout(()=>{
document.querySelector(".notifi").style.display = "none";
},3000);

}

}).catch(() => {

console.log("Ad skipped");

});

}