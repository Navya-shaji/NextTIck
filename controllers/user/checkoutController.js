const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require('../../models/orderSchema');
const { compareSync } = require("bcrypt");


const getcheckoutPage = async (req, res) => {
    console.log("Fetching cart details...");
    try {
        const user = req.session.user;
        const productId = req.query.id || null;
        const quantity = parseInt(req.query.quantity) || 1; 

        if (!user) {
            return res.redirect("/login");
        }

        const address = await Address.findOne({userId:user._id});
        if (!productId) {
            const cart = await Cart.findOne({ userId: user._id }).populate("items.productId");

            if (!cart || !cart.items || cart.items.length === 0) {
                return res.redirect("/");
            }

            const products = cart.items.map(item => {
                const product = item.productId; 
                const productImage = product?.productImage || []; 
                return {
                    _id: product._id,
                    productName: product.productName,
                    productImage: productImage.length > 0 ? productImage : ["default-image.jpg"], 
                    salePrice: product.salePrice || 0, 
                    quantity: item.quantity || 1 
                };
            });

            const subtotal = products.reduce((sum, item) => {
                return sum + item.salePrice * item.quantity;
            }, 0);

            return res.render("checkout", { user, product: products, subtotal ,quantity:null,address:address.address});
        }

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

            // Render the checkout page with the specific product details
            return res.render("checkout", { user, product: [productData], subtotal,quantity:quantity ,address:address.address});
        }
    } catch (error) {
        console.error("Error fetching checkout page:", error.message);
        return res.redirect("/pageNotFound");
    }
};




const postCheckout = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/login");
        }

        const { address, products, subtotal, total, paymentMethod } = req.body;
        console.log("products details in check out ",products)

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ success: false, message: "No products provided" });
        }

        const groupedProducts = products.reduce((acc, item) => {
            acc[item.id] = acc[item.id] || { ...item, quantity: 0 };
            acc[item.id].quantity += item.quantity;
            return acc;
        }, {});

        for (let productId in groupedProducts) {
            const item = groupedProducts[productId];
            console.log("product id",productId)
            const product = await Product.findById(productId); 

            if (!product) {
                return res.status(404).json({ success: false, message: `Product not found: ${productId}` });
            }

            if (product.quantity < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough stock for product: ${product.name}`,
                });
            }


            product.quantity -= item.quantity;
            await product.save();
        }


        const newOrder = new Order({
            userId: userId,
            orderedItems: Object.values(groupedProducts),
            shippingAddress: address,
            totalPrice: subtotal,
            finalAmount: total,
            status: "pending",
            paymentMethod: paymentMethod,
        });
        await Cart.findOneAndUpdate({userId:userId._id},{$set:{items:[]}});

        const orderSave = await newOrder.save();
        if (orderSave) {
            const orderId = newOrder._id
            return res.status(200).json({ success: true, message: "Order placed" ,orderId:orderId});
        } else {
            return res.status(400).json({ success: false, message: "Error saving order" });
        }
    } catch (error) {
        console.log("Error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};




const orderComform = async(req,res)=>{
    const orderId = req.query.id;
    try {
        if(!req.session.user){
            return res.redirect("/signup");
        }
       const order = await Order.findById({_id:orderId})
      return  res.render("orderComform",{totalPrice:order.totalPrice,date:order.createdOn.toLocaleDateString()});
        
    } catch (error) {
        console.log("error in onform page ",error.message);
        return res.redirect("/pageNotFound")
    }
}


module.exports = {
    getcheckoutPage,
    postCheckout,
    orderComform,
};