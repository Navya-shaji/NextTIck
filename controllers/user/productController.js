const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Coupon = require("../../models/couponSchema");

//productDetails............................................

const productDetail = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        
        const productId = req.query.id;

        // Fetch product with category
        const product = await Product.findById(productId).populate('category');
        if (!product) {
            return res.redirect("/pageNotFound");
        }

        const findCategory = product.category;

        // Fetch related products from same category
        const relatedProducts = await Product.find({ 
            category: findCategory, 
            _id: { $ne: productId },
            quantity: { $gt: 0 },
            isDeleted: { $ne: true }
        }).limit(4);

        // Calculate offers
        const categoryOffer = findCategory?.categoryOffer || 0;
        const productOffer = product.productOffer || 0;
        const totalOffer = Math.max(categoryOffer, productOffer);

        // Fetch available coupons
        const availableCoupons = await Coupon.find({
            expireOn: { $gt: new Date() },
            isActive: true,
            $or: [
                { applicableProducts: productId },
                { applicableCategories: findCategory._id }
            ]
        });

        res.render("productDetails", {
            user: userData,
            product: product,
            quantity: product.quantity,
            totalOffer: totalOffer,
            category: findCategory,
            relatedProducts,
            availableCoupons
        });

    } catch (error) {
        console.error("Error fetching product details:", error);
        res.redirect("/pageNotFound");
    }
};

module.exports = {
    productDetail
};
