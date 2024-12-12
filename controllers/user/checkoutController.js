const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require('../../models/orderSchema');
const { compareSync } = require("bcrypt");


// const getcheckoutPage = async (req, res) => {
//     console.log("Fetching cart details...");
//     try {
//         const user = req.session.user;
//         const productId = req.query.id || null;
//         const quantity = parseInt(req.query.quantity) || 1; 

//         if (!user) {
//             return res.redirect("/login");
//         }

//         const address = await Address.findOne({userId:user._id});
//         if (!productId) {
//             const cart = await Cart.findOne({ userId: user._id }).populate("items.productId");

//             if (!cart || !cart.items || cart.items.length === 0) {
//                 return res.redirect("/");
//             }

//             const products = cart.items.map(item => {
//                 const product = item.productId; 
//                 const productImage = product?.productImage || []; 
//                 return {
//                     _id: product._id,
//                     productName: product.productName,
//                     productImage: productImage.length > 0 ? productImage : ["default-image.jpg"], 
//                     salePrice: product.salePrice || 0, 
//                     quantity: item.quantity || 1 
//                 };
//             });

//             const subtotal = products.reduce((sum, item) => {
//                 return sum + item.salePrice * item.quantity;
//             }, 0);

//             return res.render("checkout", { user, product: products, subtotal ,quantity:null,address:address.address});
//         }

//         if (productId) {
//             const product = await Product.findById(productId);
//             if (!product) {
//                 return res.redirect("/pageNotFound");
//             }

//             console.log("Single product details:", product);

//             const productData = {
//                 _id: product._id,
//                 productName: product.productName,
//                 productImage: product.productImage?.length > 0 ? product.productImage : ["default-image.jpg"],
//                 salePrice: product.salePrice || 0,
//                 quantity: quantity // Use the quantity from the query
//             };

//             const subtotal = productData.salePrice * quantity;

//             // Render the checkout page with the specific product details
//             return res.render("checkout", { user, product: [productData], subtotal,quantity:quantity ,address:address.address});
//         }
//     } catch (error) {
//         console.error("Error fetching checkout page:", error.message);
//         return res.redirect("/pageNotFound");
//     }
// };



const getcheckoutPage = async (req, res) => {
    console.log("Fetching cart details...");
    try {
        const user = req.session.user;
        const productId = req.query.id || null;
        const quantity = parseInt(req.query.quantity) || 1;

        if (!user) {
            return res.redirect("/login");
        }

        // Fetch the user's address
        const address = await Address.findOne({ userId: user._id });
        
        // If no address found, set it to an empty object to avoid null issues
        const addressData = address || { address: [] };

        // If no specific product is queried, show cart items
        if (!productId) {
            const cart = await Cart.findOne({ userId: user._id }).populate("items.productId");

            if (!cart || !cart.items || cart.items.length === 0) {
                return res.redirect("/");
            }

            // Map cart items to extract product details
            const products = cart.items.map(item => {
                const product = item.productId;
                const productImage = product?.productImage || [];
                return {
                    _id: product._id,
                    productName: product.productName,
                    productImage: productImage.length > 0 ? productImage : ["default-image.jpg"],
                    salesPrice: product.salesPrice || 0,
                    quantity: item.quantity || 1,
                    // total: product.salesPrice * item.quantity
                };
            });

            const subtotal = products.reduce((sum, item) => {
                return sum + item.salesPrice * item.quantity;
            }, 0);
            console.log("rendering checkout")
            console.log({ 
                user, 
                product: products, 
                subtotal, 
                quantity: null, 
                addressData 
            })
            return res.render("checkout", { 
                user, 
                product: products, 
                subtotal, 
                quantity: null, 
                addressData 
            });
        }

        // If a specific product is queried
        if (productId) {
            const product = await Product.findById(productId);
            if (!product) {
                return res.redirect("/pageNotFound");
            }

            console.log("Single product details:", product);

            const productData = {
                _id: product._id,
                productName: product.productName,
                productImage: product.productImage?.length > 0 ? product.productImage : ["default-image.jpg"],
                salePrice: product.salePrice || 0,
                quantity: quantity // Use the quantity from the query
            };

            const subtotal = productData.salePrice * quantity;
            console.log("reder", { 
                user, 
                product: [productData], 
                subtotal, 
                quantity, 
                addressData 
            })
            return res.render("checkout", { 
                user, 
                product: [productData], 
                subtotal, 
                quantity, 
                addressData 
            });

        }
    } catch (error) {
        console.error("Error fetching checkout page:", error.message);
        return res.redirect("/pageNotFound");
    }
};





const postCheckout = async (req, res) => {
    try {
        const userId = req.session.user; // Get the user ID from the session

        if (!userId) {
            return res.redirect("/login"); // Redirect to login if user is not logged in
        }

        const { address, products, subtotal, total, paymentMethod } = req.body;

        console.log("Request Body:", req.body);

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ success: false, message: "No products provided" });
        }

        // Validate product stock and reduce quantity
        for (let product of products) {
            console.log("Processing product:", product);

            const dbProduct = await Product.findById(product._id); // Fetch the product from the database

            if (!dbProduct) {
                return res.status(404).json({ success: false, message: `Product not found: ${product._id}` });
            }

            if (dbProduct.quantity < product.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough stock for product: ${dbProduct.name}`,
                });
            }

            // Deduct product quantity
            dbProduct.quantity -= product.quantity;
            await dbProduct.save();
        }

        // Create a new order
        const newOrder = new Order({
            userId: userId,
            orderedItems: products.map(product => ({
                id: product._id,
                name: product.productName,
                productImage: product.productImage,
                price: product.salesPrice,
                quantity: product.quantity,
            })),
            address:address,
            shippingAddress: address,
            totalPrice: subtotal,
            finalAmount: total,
            status: "Pending",
            paymentMethod: paymentMethod,
        });

        // Clear the user's cart
        await Cart.findOneAndUpdate({ userId: userId }, { $set: { items: [] } });

        // Save the order
        const savedOrder = await newOrder.save();

        if (savedOrder) {
            const orderId = savedOrder._id; // Get the newly created order ID
            return res.status(200).json({ success: true, message: "Order placed", orderId: orderId });
        } else {
            return res.status(400).json({ success: false, message: "Error saving order" });
        }
    } catch (error) {
        console.error("Error placing order:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};





const  orderConfirm = async(req,res)=>{
    const orderId = req.query.id;
    try {
        if(!req.session.user){
            return res.redirect("/signup");
        }
       const order = await Order.findById({_id:orderId})
      return  res.render("orderConfirm",{totalPrice:order.totalPrice,date:order.createdOn.toLocaleDateString()});
        
    } catch (error) {
        console.log("error in onform page ",error.message);
        return res.redirect("/pageNotFound")
    }
}


module.exports = {
    getcheckoutPage,
    postCheckout,
    orderConfirm,
};