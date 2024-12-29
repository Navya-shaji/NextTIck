const Product = require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const User=require("../../models/userSchema")

//productDetails............................................
// const productDetail = async (req, res) => {
//     try {
//         const userId = req.session.user;
//         const userData = await User.findById(userId);
//         const productId = req.query.id;
//         const product = await Product.findById(productId).populate('category');

//         if (!product) {
//             return res.redirect("/pageNotFound");
//         }

//         const findCategory = product.category;

//         const recommendedProduct = await Product.find({ category: findCategory, _id: { $ne: productId } });

//         // Calculate the highest offer
//         const productOffer = parseFloat(product.productOffer) || 0;
//         const categoryOffer = parseFloat(findCategory.categoryOffer) || 0;
//         const highestOffer = Math.max(productOffer, categoryOffer);

//         res.render("productDetails", {
//             user: userData,
//             product: product,
//             quantity: product.quantity,
//             totalOffer: highestOffer,  // Pass the highest offer to the view
//             category: findCategory,
//             recommendedProduct
//         });
//     } catch (error) {
//         console.error("Error fetching product details", error);
//         res.redirect("/pageNotFound");
//     }
// };
const productDetail = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        
        const productId = req.query.id;

        // Fetch the product first
        const product = await Product.findById(productId).populate('category');

        // Now you can safely access product.category
        const findCategory = product.category;

        // Fetch recommended products using the correct category
        const recommendedProduct = await Product.find({ category: findCategory, _id: { $ne: productId } });

        // Calculate offers
        const categoryOffer = findCategory?.categoryOffer || 0;
        const productOffer = product.productOffer || 0;
        const totalOffer = categoryOffer + productOffer;

        // Render the response
        res.render("productDetails", {
            user: userData,
            product: product,
            quantity: product.quantity,
            totalOffer: totalOffer,
            category: findCategory,
            recommendedProduct
        });

    } catch (error) {
        console.error("Error for fetching product details", error);
        res.redirect("/pageNotFound");
    }
};

module.exports = {
    productDetail
};
