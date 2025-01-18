
const User= require("../../models/userSchema");
const nodemailer =require("nodemailer");
const env=require("dotenv").config()
const bcrypt =require("bcrypt")
const Category=require("../../models/categorySchema")
const Product =require("../../models/productSchema")
const brand=require("../../models/brandSchema");
const PDFDocument = require('pdfkit');
const Order = require('../../models/orderSchema');



// signupPage loadSignup........................................

const loadSignup =async(req,res)=>{
    try {
        const error = req.session.errorMessage;
        req.session.errorMessage=''
        return res.render("signup",{message:error})

        } catch (error) {
        res.status(500).send("Server Error")
        
    }

}


//Signup Page............................................................


const signup =async(req,res)=>{
    try {
        const {name,phone,email,password,cpassword}=req.body
        if(password!==cpassword){
            res.session.errorMessage = "Password do not matched "
            res.redirect("/signup")
            return res.render("signup",{message:"Passwords do not match "})
        }

        const findUser=await User.findOne({email});
        if(findUser){
            return res.render("signup",{message:"User with this email Already exists"})
        }

        const otp=generateOtp();
        
        const emailSent =await sendVerificationEmail(email,otp)
        if(!emailSent){
            return res.json("email-error")
        }

        req.session.userOtp=otp;
        req.session.userData={name,phone,email,password}
        

        res.render("verify-otp");
        console.log("OTP Sent",otp)



    } catch (error) {
        console.error("signup error",error);
        res.redirect("/pageNotFound")
        
    }
}


  
//GenerateOtp function()....................................................


function generateOtp(){
    return Math.floor(100000+Math.random()*900000).toString();

}

async function sendVerificationEmail(email,otp){
    try {
        const transporter =nodemailer.createTransport({
            service:"gmail",
            Port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })

          const info =await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Verify your account",
            text:`Your OTP is ${otp}`,
            html:`<br> Your OTP:${otp}</br>`,

          })

          return info.accepted.length>0

    } catch (error) {
        console.error("Error sending email",error)
        return false;
    }
}



 //pageNotFound..................................................

const pageNotFound = async (req, res) => {
    try {
        res.render("page-404");
    } catch (error) {
        console.error("Error rendering 404 page:", error);
        res.status(500).send("An error occurred");
    }
};



//HomePage Loading.........................................................


const loadHomepage = async (req, res) => {
    try {
     
      const products = await Product.find({}).populate('category'); 

      const userData = req.session.user ?? req.session.passport?.user
      res.render('home', { products, user:userData });
    } catch (error) {
      console.error('Error loading homepage:', error);
      res.status(500).send('Internal Server Error');
    }
  };
  
 
//Password Securing.........................................

const securePassword = async (password) => {
    try {
        return await bcrypt.hash(password, 10);
    } catch (error) {
        console.error("Error securing password:", error);
        throw error; // Propagate the error
    }
};



//To verify the OTP....................................................


const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log(otp);
        if (otp === String(req.session.userOtp)) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);
            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash,
            });
            await saveUserData.save();
            req.session.user = saveUserData;

         
            delete req.session.userOtp;
            delete req.session.userData;

            res.json({ success: true, redirectUrl: "/" });
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP, Please try again" });
        }
    } catch (error) {
        console.error("Error Verifying OTP", error);
        res.status(500).json({ success: false, message: "An error occurred" });
    }
};



//For Resending the OTP............................................


const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session." });
        }

        const otp = generateOtp(); 
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email, otp); 
        if (emailSent) {
            console.log("Resend OTP:", otp); 
            return res.status(200).json({ success: true, message: "OTP Resent Successfully" });
        } else {
            return res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again." });
        }
    } catch (error) {
        console.error("Error resending OTP:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error. Please try again." });
    }
};



//LoginPage Loading.........................................


const loadLogin = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.render("login");
        }
        
        return res.redirect("/");
    } catch (error) {
        console.error("Error in loadLogin:", error.message);
        res.status(500).render("error", { message: "Something went wrong. Please try again later." });
    }
};


//login.................................


const login = async (req, res) => {
    try {

        const { email, password } = req.body;
        const findUser = await User.findOne({ isAdmin: 0, email: email });

        if (!findUser) {
            return res.render("login", { message: "User not found" });
        }
        if (findUser.isBlocked) {
            return res.render("login", { message: "User is blocked by admin" });
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);
        if (!passwordMatch) {
            return res.render("login", { message: "Incorrect Password" });
        }

        req.session.user = findUser;
        res.redirect("/");
    } catch (error) {
        console.error("login error", error);
        res.render("login", { message: "Login failed. Please try again later." });
    }
};


//Logout..........................................................
 
const logout =async(req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err)
{
    return res.redirect("/pageNotFound")
    
}      
return res.redirect("/login")
  })
    } catch (error) {
      res.redirect("/pageNotFound")
    }
}




module.exports={
    loadHomepage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    securePassword,
    resendOtp,
    loadLogin,
    login,
    logout,

}