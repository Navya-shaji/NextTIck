const emailid=document.getElementById('typeEmailX')
const nameid=document.getElementById('typeNameX')
const mobileid=document.getElementById('typeMobileX')
const passid=document.getElementById('typePasswordX')
const error1 = document.getElementById('error1')
const error2 = document.getElementById('error2')
const error3 = document.getElementById('error3')
const error4 = document.getElementById('error4')
const signform = document.getElementById('signForm')


function emailvalidateChecking(e){
  console.log("email validateChecking");
  const emailval=emailid.value
  const emailpattern = /^([a-zA-Z0-9._-]+)@([a-zA-Z.-]+)\.([a-zA-Z]{2,4})$/;
  if(!emailpattern.test(emailval)){
    console.log("no format");
    error2.style.display="block"
    error2.innerHTML="Invalid Format"
  }else{
    error2.style.display="none"
    error2.innerHTML=""
  }
}

function passvalidateChecking(e){
  // console.log("pass word validateChecking");
  const passval=passid.value
  const alpha = /[a-zA-Z]/
  const digit = /\d/
  if(passval.length<8){
    // console.log("no lemngth");
    error4.style.display="block"
    error4.innerHTML="Should contain atleast 8 characters"

  }else if(!alpha.test(passval)||!digit.test(passval)){
    // console.log("passss");
    error4.style.display="block"
    error4.innerHTML="Should contain numbers and alphabets"
  }else if(passval.trim()===""){
    error4.style.display = "block"
    error4.innerHTML = "Please enter password"

  }
  else{
    error4.style.display="none"
    error4.innerHTML=""


  }

}
function namevalidateChecking(){
  const nameval=nameid.value
  const namePattern = /^[A-Za-z\s]+$/;
if(nameval.trim()===""){
  error1.style.display="block"
  error1.innerHTML="Please enter valid name"
}else if(!namePattern.test(nameval)){
  error1.style.display = "block";
  error1.innerHTML = "Name can only contain alphabets and spaces";
}else{
  error1.style.display="none"
    error1.innerHTML=""
}
}

function mobvalidateChecking(){
  console.log("mobile ahdjashda");
  const mobval=mobileid.value
  if(mobval.trim()===""){
    error3.style.display="block"
    error3.innerHTML="enter valid no"
  }else if(mobval.length<10||mobval.length>10){
    error3.style.display="block"
    error3.innerHTML="enter 10 digits"
  }else{
    error3.style.display="none"
    error3.innerHTML=""
  }
}

document.addEventListener('DOMContentLoaded', function() {
  console.log("loadeddddddd");
  signform.addEventListener('submit', function(e) {
    console.log("submissssssss");
    emailvalidateChecking();
    namevalidateChecking();
    mobvalidateChecking();
    passvalidateChecking();

   
  console.log(emailid, nameid, mobileid, passid, error1, error2, error3, error4, signform);

  // lines to check for null elements
  if (!emailid || !nameid || !mobileid || !passid || !error1 || !error2 || !error3 || !error4 || !signform) {
    console.error("One or more elements not found!");
  }
  
  if (error1.innerHTML || error2.innerHTML || error3.innerHTML || error4.innerHTML) {
    e.preventDefault();
  }
});
});

