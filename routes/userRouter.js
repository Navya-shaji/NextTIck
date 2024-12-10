const express=require("express");
const router=express.Router();
const userController = require("../controllers/user/userController");
const passport=require("../config/passport")
const productController = require("../controllers/user/productController")
const {userAuth} = require('../middlewares/auth');
const profileController =require("../controllers/user/profileController")
const cartController = require("../controllers/user/cartController");
const shopController =require("../controllers/user/shopController");
const checkoutController=require("../controllers/user/checkoutController");



//homepage.............................
router.get("/",userController.loadHomepage);
router.get("/login",userController.login)
router.get("/logout",userController.logout)

router.get("/pageNotFound",userController.pageNotFound)
router.get("/signup",userController.loadSignup)
router.post("/signup",userController.signup)
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)
router.get('/auth/google',passport.authenticate("google",{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/',)
})

// login page.........
router.get("/pageNotFound",userController.pageNotFound)
router.get("/login",userController.loadLogin)
router.post("/login",userController.login)

//Product Management....................
router.get("/productDetails",userAuth,productController.productDetail);


//profile Management.............................
router.get("/forgot-password",profileController.getForgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp)
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp);
router.post("/reset-password",profileController.postNewPassword);

router.get("/userProfile",userAuth,profileController.userProfile);
router.post("/updateProfile",userAuth,profileController.updateProfile);
router.get("/change-email",userAuth,profileController.changeEmail);
router.post("/change-email",userAuth,profileController.changeEmailValid);
router.post("/verify-email-otp",userAuth,profileController.verifyEmailOtp);
router.post("/update-email",userAuth,profileController.updateEmail)


router.get("/change-password", userAuth, profileController.renderChangePasswordPage);
router.post("/change-password", userAuth, profileController.changePasswordValid);
router.post("/verify-changepassword-otp", userAuth, profileController.verifyChangepassOtp);
router.post("/reset-password", userAuth, profileController.resetPassword);
//Address Management...............................

router.get("/add-address",userAuth,profileController.addAddress);
router.post("/addaddress",userAuth,profileController.postAddAddress);
router.get("/userAddress",userAuth,profileController.getAddressPage);
router.get("/edit-address/:id",userAuth,profileController.editAddress);
router.post("/postEditAddress/:id",userAuth,profileController.postEditAddress);
router.get("/delete-address/:id",userAuth,profileController.deleteAddress);

//shoping management........................
router.get("/shop",userAuth,shopController.loadshoppingPage)
router.get("/filter",userAuth,shopController.filterProduct)


//cart management................................................................................................................

router.post('/addToCart', userAuth,cartController.addToCart);
router.get('/cart', userAuth,cartController. getCartItems);
router.delete('/removeFromCart', userAuth,cartController. removeFromCart);

module.exports = router