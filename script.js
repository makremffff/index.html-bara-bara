// Telegram WebApp
let tg = window.Telegram.WebApp;
tg.expand();

let user = tg.initDataUnsafe.user;

let userBalance = 0;

// بيانات المستخدم
if (user) {

let userid = user.id;
let firstname = user.first_name || "";
let lastname = user.last_name || "";
let fullname = firstname + " " + lastname;
let photo = user.photo_url || "";

let userPhoto = document.querySelector(".user-fhoto");

if(photo){
userPhoto.innerHTML = `<img src="${photo}">`;
}else{
userPhoto.innerHTML = `<img src="asesst/user.png">`;
}

let usernameBox = document.querySelector(".user-name");

usernameBox.innerHTML = `
<span style="color:#ffeedd;font-size:20px;">♪WellCome♫</span>
<span>${fullname}</span>
`;

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

mainpage.style.display = "none";
taskpage.style.display = "none";
walletpage.style.display = "none";
gamepage.style.display = "none";
refalpage.style.display = "none";

page.style.display = "block";

}


// صور الإعلانات
let boximg = document.querySelector(".box-ads");

let images = [
"asesst/113.png",
"asesst/125.png",
"asesst/104.png",
"asesst/130.png",
"asesst/711.png",
"asesst/719.png"
];

let i = 0;

boximg.innerHTML = `<img src="${images[i]}" width="250">`;

setInterval(()=>{

i++;

if(i >= images.length){
i = 0;
}

boximg.innerHTML = `<img src="${images[i]}" width="250">`;

},10000);


// الإشعارات
function showNotification(text,img){

let notif = document.querySelector(".notifi");

notif.innerHTML = `
<h3>${text} <img src="${img}" width="50"></h3>
`;

notif.style.display = "block";

setTimeout(()=>{
notif.style.display = "none";
},3000);

}


// نظام المهام
document.addEventListener("click",function(e){

let taskLink = e.target.closest(".task-link a");

if(!taskLink) return;

e.preventDefault();

let taskCard = taskLink.closest(".task-card");
let taskName = taskCard.querySelector(".task-name").innerText;

let completedTasks = JSON.parse(localStorage.getItem("tasks_done")) || [];

if(completedTasks.includes(taskName)){
taskLink.innerHTML = `<img src="asesst/check.gif" width="23"> Done`;
return;
}


// Join
if(!taskLink.dataset.state){

taskLink.dataset.state = "check";

window.open(taskLink.href,"_blank");

taskLink.textContent = "Check";

}


// Check
else if(taskLink.dataset.state === "check"){

let count = 3;

taskLink.textContent = count;

let timer = setInterval(()=>{

count--;

if(count > 0){

taskLink.textContent = count;

}else{

clearInterval(timer);

userBalance += 500;

document.querySelector(".user-balance span").innerHTML =
userBalance + `<img src="asesst/pepe.png" width="23" height="30">`;

completedTasks.push(taskName);

localStorage.setItem("tasks_done",JSON.stringify(completedTasks));

showNotification("Task Complete","asesst/check.gif");

taskLink.innerHTML = `<img src="asesst/check.gif" width="23"> Done`;

taskLink.dataset.state = "done";

}

},1000);

}

});


// نسخ رابط الإحالة
let copyBtn = document.getElementById("copy");

if(copyBtn){

copyBtn.addEventListener("click",()=>{

let link = document.querySelector(".refal-link span").innerText;

navigator.clipboard.writeText(link);

copyBtn.innerHTML = `<img src="asesst/approve.png" width="26">`;

setTimeout(()=>{
copyBtn.innerHTML = `<img src="asesst/copy.png" width="26">`;
},2000);

});

}


// نظام AdsGram
let watchBtn = document.getElementById("watch");

let adsWatched = 0;

watchBtn.addEventListener("click",startAds);

function startAds(){

adsWatched = 0;

showAd();

}

function showAd(){

let adController = window.Adsgram.init({
blockId:"int-20679",
debug:true
});

adController.show().then(()=>{

adsWatched++;

if(adsWatched < 3){

setTimeout(()=>{
showAd();
},6000);

}else{

userBalance += 100;

document.querySelector(".user-balance span").innerHTML =
userBalance + `<img src="asesst/pepe.png" width="23" height="30">`;

document.querySelector(".user-ads h3").innerText++;

showNotification("Ads Watched","asesst/done.gif");

}

}).catch(()=>{

console.log("Ad skipped");

});

}