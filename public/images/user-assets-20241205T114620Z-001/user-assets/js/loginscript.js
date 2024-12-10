const emailidlog=document.getElementById('typeMaily')
const passidlog=document.getElementById('typePasswordy')
const error1log=document.getElementById('error1log')
const error2log=document.getElementById('error2log')
const logform=document.getElementById('logForm')

function emailvalidate(e){
  // console.log("okokokoookoko");
  const emailval=emailidlog.value
  // console.log(emailval,"emialvalie");
  const emailpattern=/^([a-zA-Z0-9._-]+)@([a-zA-Z.-]+).([a-zA-z]{2,4})$/ 
if(!emailpattern.test(emailval)){
  error1log.style.display = "block"
  error1log.innerHTML = "Invalid Format!!"
}else{
  error1log.style.display = "none"
  error1log.innerHTML = ""

}
}

function passvalidate(e){
  // console.log("double ookokokookoko");
  const passval = passidlog.value
  const alpha = /[a-zA-Z]/
  const digit = /\d/
  if(passval.length < 8){
    error2log.style.display = "block"
  error2log.innerHTML = "enter 8 characters"
  }else if(!alpha.test(passval)||!digit.test(passval)){
    error2log.style.display = "block"
  error2log.innerHTML = "password should contain numbers and alphabets "
  }
  else if(passval.trim()===""){
    error2log.style.display = "block"
    error2log.innerHTML = "Please enter password"

  }else{
    error2log.style.display = "none"
    error2log.innerHTML = ""

  }
}

// emailidlog.addEventListener('blur',emailvalidate)
// passidlog.addEventListener('blur',passvalidate)

document.addEventListener('DOMContentLoaded', function() {

  logform.addEventListener('submit', function(e) {
    // e.preventDefault();
      emailvalidate();
      passvalidate();
      // console.log("caleddddddddddddd aishutte ");
      if (error2log.innerHTML || error1log.innerHTML) {
          e.preventDefault();
      }
  });
});
