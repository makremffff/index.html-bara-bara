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
userPhoto.innerHTML = `<img src="${photo}" >`;
}else{
userPhoto.innerHTML = `<img src="asesst/user.png" >`;
}

// الاسم
let usernameBox = document.querySelector(".user-name");

usernameBox.innerHTML = `
<span style="color:#ffeedd;font-size:20px;">♪WellCome♫</span>
<span>${fullname}</span>
`;

// رابط الإحالة
let refLink = `https://t.me/Bot_ad_watchbot/earn?startapp=ref_${userid}`;

let refBox = document.querySelector(".refal-link span");

if(refBox){
refBox.innerHTML = refLink;
}

}

// الصفحات
let mainpage = document.getElementById("main");
let taskpage = document.getElementById("task");
let walletpage = document.getElementById("wallet");
let gamepage = document.getElementById("game");
let refalpage = document.getElementById("refal");

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
<div class="task-link">
<a href="${tasklink}" target="_blank">Join</a>
</div>
`;

let taskContainer = document.getElementById("task");

taskContainer.appendChild(taskcard);

document.getElementById("taskname").value = '';
document.getElementById("tasklink").value = '';

setupTasks();

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


// نظام المهام
let userBalance = 0;

function setupTasks(){

document.querySelectorAll(".task-card").forEach((task,index)=>{

let btn = task.querySelector(".task-link a");

if(!btn) return;

let taskId = "task_"+index;

// لو مكتملة
if(localStorage.getItem(taskId)){
btn.innerHTML = `<img src="asesst/check.gif" width="23">`;
btn.removeAttribute("href");
}

// الضغط
btn.onclick = function(e){

if(localStorage.getItem(taskId)){
e.preventDefault();
return;
}

// Join
if(btn.innerText === "Join"){

btn.innerText = "Check";

}

// Check
else if(btn.innerText === "Check"){

e.preventDefault();

// مكافأة
userBalance += 500;

document.querySelector(".user-balance span").innerHTML =
userBalance + `<img src="asesst/pepe.png" width="23" height="30">`;

// اشعار
document.querySelector(".notifi").style.display = "block";

setTimeout(()=>{
document.querySelector(".notifi").style.display = "none";
},3000);

// حفظ
localStorage.setItem(taskId,true);

// صورة صح
btn.innerHTML = `<img src="asesst/check.gif" width="23">`;

}

}

});

}

setupTasks();


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


// نظام مشاهدة الاعلانات
let watchBtn = document.getElementById("watch");

let adsWatched = 0;

watchBtn.addEventListener("click", startAds);

function startAds(){
adsWatched = 0;
showAd();
}

function showAd(){

let adController = window.Adsgram.init({
blockId: "int-20679",
debug: true
});

adController.show().then(() => {

adsWatched++;

if(adsWatched < 4){

setTimeout(() => {
showAd();
}, 6000);

}else{

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