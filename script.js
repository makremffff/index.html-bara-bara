
//ازرار صفحات 
let mainbtn = document.getElementById("mainbtn")
let taskbtn = document.getElementById("taskbtn")
let walletbtn = document.getElementById("walletbtn")
let gamebtn = document.getElementById("gamebtn") 
let refalbtn = document.getElementById("refalbtn") 
//صفحات
let mainpage = document.getElementById("main")
let taskpage = document.getElementById("task")
let walletpage = document.getElementById("wallet")

let gamepage = document.getElementById("game")

let refalpage = document.getElementById("refal")
//فنكشن صفحات
function showpage(page){
 mainpage.style.display = 'none'
 taskpage.style.display = 'none'
 gamepage.style.display = 'none'
refalpage.style.display = 'none' 
 walletpage.style.display = 'none'
  page.style.display = 'block'
}


let boximg = document.querySelector(".box-ads");

  setInterval(function(){
    boximg.innerHTML = `
     <img src="asesst/125.png" width="250">
   `
  }, 10000)
  let images = [
"asesst/113.png",
"asesst/125.png",
"asesst/104.png",
"asesst/130.png",
"asesst/711.png",
"asesst/719.png",

];

let i = 0;

boximg.innerHTML = `
<img src="${images[i]}" width="250">
`;

setInterval(function(){

i++;

if(i >= images.length){
i = 0;
}

boximg.innerHTML = `
<img src="${images[i]}" width="250">
`;

},10000);


let topup = document.querySelector(".top-up");
let taskadd = document.getElementById("taskadd");

taskadd.addEventListener("change", function () {
  if (taskadd.checked) {
    topup.style.color = "blue";
  } else {
    topup.style.color = "";
  }
});

//انشاء مهمه تاسك

let creatTaskbtn = document.getElementById("createtask");
let taskcard = document.querySelector("task-card");
creatTaskbtn.addEventListener("click",function(){
  let taskname = document.getElementById("taskname").value;
  let tasklink = document.getElementById("tasklink").value;
let taskcard =  document.createElement("div");
taskcard.classList = 'task-card'
  
  taskcard.innerHTML = `
  	<img class="task-img" src="asesst/telegram.png" width="25"> 
  	
  <span class="task-name">${taskname}</span>
  	
  <span class="task-prize">500 <img src="asesst/pepe.png" width="25" height="28"></span>
  
  <a class="task-link" href="${tasklink}">Join</a>
`
let taskContainer = document.getElementById("task");
taskContainer.appendChild(taskcard);
document.getElementById("taskname").value = '';

  document.getElementById("tasklink").value = '';

});


  const audio = document.getElementById("audio");
  

  document.addEventListener("click", () => {
    audio.play();
   
  });

  let btnsound = document.getElementById("clicksound");


let btns = document.querySelector(".btn-bar");
btns.addEventListener("click",function(){
  btnsound.play();
 
})
let joinbtn = document.querySelector(".task-link");
joinbtn.addEventListener("click",function(){
  joinbtn.textContent = 'Check'

joinbtn.addEventListener("click",function(){
  joinbtn.innerHTML = `
  <img src='asesst/check.gif' width='23'>`
})
  
  
})




