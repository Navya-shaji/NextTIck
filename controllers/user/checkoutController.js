const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require('../../models/orderSchema');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { compareSync } = require("bcrypt");

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


const getcheckoutPage = async (req, res) => {
    console.log("Fetching cart details...");
    try {
        const user = req.session.user;
        const productId = req.query.id || null;
        const quantity = parseInt(req.query.quantity) || 1;

        if (!user) {
            return res.redirect("/login");
        }

        const address = await Address.findOne({ userId: user._id });
        
        const addressData = address || { address: [] };

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
                salePrice: product.salesPrice || 0,
                quantity: quantity 
            };

            const subtotal = productData.salePrice * quantity;
            console.log("reder", { 
                user, 
                product: productData, 
                subtotal, 
                quantity, 
                addressData 
            })
            return res.render("checkout", { 
                user, 
                product: productData, 
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
        const userId = req.session.user; 
        if (!userId) {
            return res.redirect("/login"); 
        }

        const { address, products, subtotal, total, paymentMethod } = req.body;

        console.log("Request Body:", req.body);
        console.log("Products Received:", products);

        if (!Array.isArray(JSON.parse(products)) || products.length === 0) {
            return res.status(400).json({ success: false, message: "No products provided" });
        }


            // Create Razorpay order only if payment method is online
            if (paymentMethod === 'online') {
                const options = {
                    amount: total * 100, // amount in smallest currency unit (paise)
                    currency: "INR",
                    receipt: `order_${Date.now()}`
                };
    
                const order = await razorpay.orders.create(options);
    
                return res.status(200).json({
                    success: true,
                    order_id: order.id,
                    key_id: process.env.RAZORPAY_KEY_ID,
                    amount: total * 100,
                    currency: "INR",
                    name: "Your Store Name",
                    description: "Purchase Description",
                    prefill: {
                        name: userId.name,
                        email: userId.email,
                        contact: userId.phone
                    }
                });
            }


        for (let product of JSON.parse(products)) {
            console.log("Processing product:", product);

            if (product.quantity > product.stock) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough stock for product: ${product.productName}`,
                });
            }

            product.stock -= product.quantity;
            console.log(`Stock updated for ${product.productName}: ${product.stock}`);
        }

        const orderedItems = JSON.parse(products).map(product => ({
            product: product._id,
            price: product.salesPrice,
            quantity: product.quantity,

        }))

        console.log(orderedItems)
        const newOrder = new Order({
            userId: userId,
            orderItems: orderedItems,
            address: address,
            shippingAddress: address,
            totalPrice: subtotal,
            finalAmount: total,
            status: "Pending",
            paymentMethod: paymentMethod,
        });

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


const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderDetails
        } = req.body;

        // Log the received data for debugging
        console.log('Verification Data:', {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        });

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing payment verification parameters" 
            });
        }

        // Create the signature verification string
        const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        const generated_signature = shasum
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        // Log both signatures for debugging
        console.log('Generated Signature:', generated_signature);
        console.log('Received Signature:', razorpay_signature);

        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid payment signature",
                debug: {
                    generated: generated_signature,
                    received: razorpay_signature
                }
            });
        }

        // Verify the payment with Razorpay API
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        
        if (payment.status !== 'captured') {
            return res.status(400).json({ 
                success: false, 
                message: "Payment not captured" 
            });
        }

        // Create order in your database
        const { address, products, subtotal, total } = orderDetails;
        const orderedItems = JSON.parse(products).map(product => ({
            product: product._id,
            price: product.salesPrice,
            quantity: product.quantity,
        }));

        const newOrder = new Order({
            userId: req.session.user,
            orderItems: orderedItems,
            address: address,
            shippingAddress: address,
            totalPrice: subtotal,
            finalAmount: total,
            status: "Pending",
            paymentMethod: "online",
            paymentId: razorpay_payment_id,
            paymentStatus: "Completed",
            createdOn: new Date()
        });

        // Clear the cart
        await Cart.findOneAndUpdate(
            { userId: req.session.user }, 
            { $set: { items: [] } }
        );

        const savedOrder = await newOrder.save();

        return res.status(200).json({ 
            success: true, 
            message: "Payment verified and order placed",
            orderId: savedOrder._id
        });
    } catch (error) {
        console.error("Error verifying payment:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error",
            error: error.message 
        });
    }
};


const  orderConfirm = async(req,res)=>{
    const orderId = req.query.id;
    try {
        if(!req.session.user){
            return res.redirect("/signup");
        }
      return  res.render("orderConfirmation");
        
    } catch (error) {
        console.log("error in loading confirmation page ",error.message);
        return res.redirect("/pageNotFound")
    }
}



module.exports = {
    getcheckoutPage,
    postCheckout,
    orderConfirm,
    verifyPayment
};