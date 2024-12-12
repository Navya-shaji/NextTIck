const express=require("express")
const router =express.Router()
const adminController=require("../controllers/admin/adminController")
const customerController=require("../controllers/admin/customerController")
const categoryController=require("../controllers/admin/categoryController")
const brandController=require("../controllers/admin/brandControllers")
const productController=require("../controllers/admin/productController")
const {userAuth,adminAuth}=require("../middlewares/auth")
// const orderController = require('../controllers/orderController');
const multer=require("multer");
const storage=require("../helpers/multer");
const uploads = multer({storage:storage})



//Error Management.......................
// router.get("/",adminAuth.adminAuth,adminController.loadDashboard);
router.get("/pageerror",adminController.pageerror)

//login Management...................
router.get("/login",adminController.loadLogin)
router.post("/login",adminController.login)
router.get("/",adminAuth,adminController.loadDashboard)
router.get("/logout",adminController.logout);

//Customer Management.......................
router.get("/dashboard", adminAuth, adminController.loadDashboard)
router.get("/users", adminAuth, customerController.customerInfo);
router.get("/block/:id", adminAuth, customerController.customerBlocked); // Use path params
router.get("/unblock/:id", adminAuth, customerController.customerunBlocked);

//Category Management.....................
router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
// router.post("/removeCategory",adminAuth,categoryController.removeCategory);
router.post("/addCategoryOffer",adminAuth,categoryController.addCategoryOffer)
router.post("/removeCategoryOffer",adminAuth,categoryController.removeCategoryOffer)
router.get("/listCategory", adminAuth, categoryController.getUnlistedCategory); // Correct route for 'List' action
router.get("/unlistCategory", adminAuth, categoryController.getListedCategory); // Correct route for 'Unlist' action
router.get("/editCategory",adminAuth,categoryController.getEditCategory)
router.post("/editCategory/:id", adminAuth, categoryController.editCategory);


//Brand Management.........................
router.get("/brands",adminAuth,brandController.getBrandPage);
router.post("/addBrand",adminAuth,uploads.single("image"),brandController.addBrand);
router.post('/blockBrand/:id', brandController.blockBrand);
router.post("/unblockBrand/:id", adminAuth, brandController.unblockBrand);
router.get("/deleteBrand",adminAuth,brandController.deleteBrand)
// router.post("/updateBrand",uploads.single("logo"),adminAuth.adminAuth,brandController.updateBrand);

//Product Management...........................
router.get("/addProducts",adminAuth,productController.getProductAddPage);
router.post("/addProducts",adminAuth,uploads.array("images",4),productController.addProducts);
//Product listing............
router.get("/products",adminAuth,productController.getAllProducts)
router.post("/addProductOffer",adminAuth,productController.addProductOffer)
router.post("/removeProductOffer",adminAuth,productController.removeProductOffer)
router.get("/blockProduct",adminAuth,productController.blockProduct);
router.get("/unblockProduct",adminAuth,productController.unblockProduct);
router.get("/editProduct",adminAuth,productController.getEditProduct);
router.post("/editProduct/:id",adminAuth,uploads.array("image",4),productController.editProduct);
router.post("/deleteImage",adminAuth,productController.deleteSingleImage);


module.exports=router