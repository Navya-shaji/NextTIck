const Product = require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const User=require("../../models/userSchema")



// const productDetails = async(req,res)=>{
//     try {
//         const userId=req.session.user;
//         const userData= await User.findById(userId);
//         const productId = req.query.id;
//         console.log(productId);
//         const product = await Product.findById(productId).populate('category');
//         console.log(product)
//         // const findCategory=findCategory ?.categoryOffer || 0;
//         // const ProductOffer=product.productOffer ||0;
//         // const totalOffer=categoryOffer + productOffer;
//         res.render("product-details",{
//         user:userData,
//         product:product,
//         quantity:product.quantity,
//         // totalOffer:totalOffer,
//         // category:findCategory
//         });
//     } catch (error) {
//         console.error("Error for fetching product details",error);
//         res.redirect("/pageNotFound")
//     }
// }


//productDetails............................................

const productDetail = async(req,res)=>{
    try {
        const userId=req.session.user;
        const userData= await User.findById(userId);
        const productId = req.query.id;
        console.log(productId);
        const product = await Product.findById(productId).populate('category');
        console.log(product)
        // const findCategory=findCategory ?.categoryOffer || 0;
        // const ProductOffer=product.productOffer ||0;
        // const totalOffer=categoryOffer + productOffer;
        res.render("productDetails",{
        user:userData,
        product:product,
        quantity:product.quantity,
        // totalOffer:totalOffer,
        // category:findCategory
        });
    } catch (error) {
        console.error("Error for fetching product details",error);
        res.redirect("/pageNotFound")
    }
}

module.exports={
    // productDetails,
    productDetail
}