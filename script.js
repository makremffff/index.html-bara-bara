let btnMain=document.querySelector("button");
let btnTask=document.getElementById("btn2");
let btnWallet=document.getElementById("btn3");
let btnshare=document.getElementById("sharebtn");
let bntaddTask=document.getElementById("addtask");

let mainPage=document.getElementById("main");
let taskPage=document.getElementById("task");
let walletPage=document.getElementById("wallet");
let sharePage=document.getElementById("share");
let addTaskpage=document.getElementById("addTask");

let loadpage=document.getElementById("loading");
let pagename=document.getElementById("page-load");
let userbalancce=document.querySelector(".user-balance");
let walletbalance=document.getElementById("adsbalancce");
let barbtn=document.querySelector(".bar");

let soundbtn=document.getElementById("soundbtn");
let soundads=document.getElementById("soundads");

let tgUser=null;
if(typeof Telegram!=='undefined'&&Telegram.WebApp&&Telegram.WebApp.initDataUnsafe&&Telegram.WebApp.initDataUnsafe.user){
tgUser=Telegram.WebApp.initDataUnsafe.user;
}

const API_URL='/api';

function showPage(btnpage){
mainPage.style.display="none";
taskPage.style.display="none";
walletPage.style.display="none";
sharePage.style.display="none";
addTaskpage.style.display="none";
btnpage.style.display="block";
loadpage.style.display="block";
pagename.textContent="Loading";
barbtn.style.display="none";
setTimeout(function(){barbtn.style.display="block"},2000);
if(soundbtn){soundbtn.currentTime=0;soundbtn.play()}
setTimeout(function(){loadpage.style.display="none"},2000)
}

if(btnMain){btnMain.addEventListener("click",function(){showPage(mainPage)})}
if(btnTask){btnTask.addEventListener("click",function(){showPage(taskPage)})}
if(btnWallet){
btnWallet.addEventListener("click",function(){
showPage(walletPage);
if(walletbalance){
walletbalance.innerHTML=`<img src="coins.png" style="width:20px;vertical-align:middle;">${ADS}`
}})
}
if(btnshare){btnshare.addEventListener("click",function(){showPage(sharePage)})}
if(bntaddTask){bntaddTask.addEventListener("click",function(){showPage(addTaskpage)})}

let AdsGramController=null;

function waitForAdsgram(){
return new Promise(resolve=>{
let tries=0;
let interval=setInterval(()=>{
if(window.Adsgram&&typeof window.Adsgram.init==="function"){
clearInterval(interval);
resolve(true)
}
tries++;
if(tries>20){
clearInterval(interval);
resolve(false)
}
},300)
})
}

async function initAdsGram(){
let ready=await waitForAdsgram();
if(!ready)return false;
try{
AdsGramController=window.Adsgram.init({blockId:"int-20679"});
return true
}catch(e){
return false
}
}

async function showAdsGramRewarded(){
if(!AdsGramController){
let ok=await initAdsGram();
if(!ok)return{ok:false,reason:"not_ready"}
}
if(!AdsGramController||typeof AdsGramController.show!=="function"){
return{ok:false,reason:"not_ready"}
}
try{
const result=await AdsGramController.show();
if(result&&result.done===false){
return{ok:false,reason:"not_done"}
}
return{ok:true}
}catch(error){
return{ok:false,reason:"error"}
}
}

async function showLibtlAd(){
return new Promise((resolve)=>{
if(typeof show_10245709==="function"){
try{
show_10245709();
setTimeout(()=>resolve(true),2000)
}catch(e){
resolve(false)
}
}else{
resolve(false)
}
})
}

const adsBtn=document.getElementById("adsbtn");
const adsBtnn=document.getElementById("adsbtnn");
const adsBalance=document.getElementById("adsbalance");
const adsNotfi=document.getElementById("adsnotifi");
let progres=document.getElementById("progres");
let adstime=document.getElementById("adstime");

let ADS=0;
let timer=null;
let dailyLimit=null;
let dailyProgres=100;
let progresLimit=60*60000;
let isProcessingAd=false;

function showToast(message,type="info"){
const toast=document.createElement("div");
toast.style.position="fixed";
toast.style.top="20px";
toast.style.left="50%";
toast.style.transform="translateX(-50%)";
toast.style.background=type==="success"?"#28a745":type==="error"?"#dc3545":"#17a2b8";
toast.style.color="white";
toast.style.padding="15px 25px";
toast.style.borderRadius="10px";
toast.style.fontWeight="bold";
toast.style.zIndex="999999";
toast.style.boxShadow="0 4px 15px rgba(0,0,0,0.3)";
toast.textContent=message;
document.body.appendChild(toast);
setTimeout(()=>{toast.remove()},3000)
}

if(adsBtn){
adsBtn.addEventListener("click",async function(){
if(isProcessingAd)return;
if(dailyProgres<=0){
showToast("Daily limit reached","error");
return
}
isProcessingAd=true;
adsBtn.style.display="none";
if(adsBtnn){
adsBtnn.style.display="block";
adsBtnn.textContent="Loading...";
adsBtnn.disabled=true
}
try{
let lib1=await showLibtlAd();
let lib2=await showLibtlAd();
if(!lib1||!lib2){
throw new Error("libtl failed")
}
let adsgramResult=await showAdsGramRewarded();
if(!adsgramResult.ok){
throw new Error("adsgram failed")
}
ADS+=100;
if(adsBalance)adsBalance.textContent=ADS;
if(walletbalance){
walletbalance.innerHTML=`<img src="coins.png" style="width:20px;vertical-align:middle;">${ADS}`
}
if(soundads){soundads.currentTime=0;soundads.play()}
if(adsNotfi){
adsNotfi.style.display="block";
adsNotfi.textContent="+100 ADS!";
setTimeout(()=>{adsNotfi.style.display="none"},2500)
}
dailyProgres--;
if(progres)progres.textContent=dailyProgres;
showToast("You earned 100 ADS","success");
if(dailyProgres<=0)startDailyLimit()
}catch(error){
showToast("Ad failed, try again","error")
}finally{
isProcessingAd=false;
if(dailyProgres>0){
if(adsBtnn)adsBtnn.style.display="none";
adsBtn.style.display="block"
}
}
})
}

function startDailyLimit(){
if(adsBtn)adsBtn.style.display="none";
if(adsBtnn){
adsBtnn.style.display="block";
adsBtnn.textContent=formatTime(progresLimit);
adsBtnn.style.background="red";
adsBtnn.disabled=true
}
dailyLimit=setInterval(function(){
progresLimit-=1000;
if(adsBtnn)adsBtnn.textContent=formatTime(progresLimit);
if(progresLimit<=0){
clearInterval(dailyLimit);
if(adsBtnn)adsBtnn.style.display="none";
if(adsBtn){
adsBtn.style.display="block";
adsBtn.disabled=false
}
progresLimit=60*60000;
dailyProgres=100;
if(progres)progres.textContent=dailyProgres
}
},1000)
}

function formatTime(ms){
const totalSeconds=Math.floor(ms/1000);
const minutes=Math.floor(totalSeconds/60);
const seconds=totalSeconds%60;
return`${minutes}:${seconds.toString().padStart(2,"0")}`
}

document.addEventListener("DOMContentLoaded",function(){
initAdsGram()
})