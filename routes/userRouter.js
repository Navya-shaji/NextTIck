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
    const orderController=require("../controllers/user/orderController")
    const wishlistController=require("../controllers/user/wishlistController");
    const walletController=require("../controllers/user/walletController");



    //homepage........................................................................................................
    router.get("/",userController.loadHomepage);
    router.get("/logout",userController.logout)

    router.get("/pageNotFound",userController.pageNotFound)
    router.get("/signup",userController.loadSignup)
    router.post("/signup",userController.signup)
    router.post("/verify-otp",userController.verifyOtp)
    router.post("/resend-otp",userController.resendOtp)
    router.get('/auth/google',passport.authenticate("google",{scope:['profile','email']}));
    router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
        req.session.user = req.session.passport.user 
        res.redirect('/',)
    })

    // login page........................................................................................................
    router.get("/pageNotFound",userController.pageNotFound)
    router.get("/login",userController.loadLogin)
    router.post("/login",userController.login)

    //Product Management...............................................................................................
    router.get("/productDetails",productController.productDetail);


    //profile Management...............................................................................................
    router.get("/forgot-password",profileController.getForgotPassPage);
    router.post("/forgot-email-valid",profileController.forgotEmailValid);
    router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp)
    router.get("/reset-password",profileController.getResetPassPage);
    router.post("/resend-forgot-otp",profileController.resendOtp);
    router.post("/reset-password",profileController.postNewPassword);
    router.post('/update-profile', profileController.updateProfile);


    router.get("/userProfile",userAuth,profileController.userProfile);
    router.post("/updateProfile",userAuth,profileController.updateProfile);
    router.get("/change-email",userAuth,profileController.changeEmail);
    router.post("/change-email",userAuth,profileController.changeEmailValid);
    router.post("/verify-email-otp",userAuth,profileController.verifyEmailOtp);
    router.post("/update-email",userAuth,profileController.updateEmail)
    router.get("/profile", profileController.userProfile);
    router.delete("/orders/:orderId", profileController.deleteOrder);


    router.get("/change-password", userAuth, profileController.renderChangePasswordPage);
    router.post("/change-password", userAuth, profileController.changePasswordValid);
    router.post("/verify-changepassword-otp", userAuth, profileController.verifyChangepassOtp);
    router.post("/reset-password", userAuth, profileController.resetPassword);
    //Address Management...............................................................................................

    router.get("/add-address",userAuth,profileController.addAddress);
    router.post("/addaddress",userAuth,profileController.postAddAddress);
    router.get("/userAddress",userAuth,profileController.getAddressPage);
    router.get("/edit-address/:id",userAuth,profileController.editAddress);
    router.post("/postEditAddress/:id",userAuth,profileController.postEditAddress);
    router.get("/delete-address/:id",userAuth,profileController.deleteAddress);


    //wishlist Management...............................................................................................

    router.get("/wishlist",userAuth,wishlistController.loadWishlist);
    router.post("/addToWishlist",userAuth,wishlistController.addToWishlist)
    router.delete('/wishlist/remove/:id', wishlistController.removeFromWishlist);

    //shoping management...............................................................................................

    router.get('/shop', shopController.loadshoppingPage);
    router.get('/search', shopController.searchProducts);
    router.get('/filter', shopController.loadshoppingPage);
    router.get('/sort', shopController.loadshoppingPage);

    //cart management...............................................................................................

    router.post('/addToCart',userAuth,cartController.addToCart);
    router.get('/cart', cartController.getCart);
    router.post('/cart/update-quantity', userAuth, cartController.updateQuantity);
    router.post('/cart/remove', userAuth, cartController.removeFromCart);

    //checkoutpage...................................................................................................
    router.get("/checkout",userAuth,checkoutController.getcheckoutPage);
    router.post("/checkout",userAuth,checkoutController.postCheckout);
    router.get("/orderConfirmation",checkoutController.orderConfirm);
    router.post("/verify-payment",userAuth,checkoutController.verifyPayment);
    router.post("/orders/retry-payment",userAuth,checkoutController.retryPayment);

    
    //order management...............................................................................................

    router.get('/history', userAuth, orderController.getOrderHistory);
    router.post('/orders/cancel', userAuth, orderController.cancelOrder);
    router.get('/status/:orderId', userAuth, orderController.getOrderStatus);
    router.get('/orders/:orderId', userAuth, orderController.getOrderDetails);
    router.put('/:orderId/status',userAuth, orderController.changeOrderStatus); 
    router.get('/orders/view/:id',userAuth, orderController.viewOrderDetails); 
    router.post('/orders/update-status',userAuth, orderController.updateOrderStatus);
    router.get('/return-reason', userAuth, orderController.showReturnReasonPage);
    router.post('/process-return',userAuth, orderController. submitReturnReason);
    router.post('/update-status', userAuth, orderController.updateOrderStatus);
    router.get('/return-reason/:orderId',userAuth,orderController. showReturnReasonPage);
    router.post('/update-wallet-after-payment',walletController. updateWalletAfterPayment);
    router.post('/process-return/:orderId',walletController. processReturn);
   


    // wallet.........................................................................................................................

    router.post('/add-money', walletController.createRazorpayOrder);
    router.post('/update-balance', walletController.updateWalletBalance);
    router.post('/wallet/refund', walletController.refundToWallet);
    // coupon.........................................................................................................................
    router.post("/apply-coupon",checkoutController.applyCoupon);

    module.exports = router