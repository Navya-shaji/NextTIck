const multer = require("multer")
const path = require("path");

const storage = multer.diskStorage({
    destination:(req,file,cb)=>{
        cb(null,path.join(__dirname,"../public/uploads/re-image"))
    },
    filename:(req,file,cb)=>{
        cb(null,Date.now()+"-"+File.originalname+".jpg");
    }
})
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, "public/uploads/product-images/");
//     },
//     filename: function (req, file, cb) {
//         cb(null, file.originalname); // Use original file name or customize
//     },
// });

module.exports=storage;