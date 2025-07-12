const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require('../../models/orderSchema');
const Coupon = require("../../models/couponSchema")
const Wallet = require("../../models/walletSchema");
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { compareSync } = require("bcrypt");
const mongoose = require('mongoose');


// Initialize Razorpay............................

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


//for orders using Razorpay.......................................................

const createRazorpayOrder = async (amount) => {
    try {
        const options = {
            amount: amount * 100,
            currency: "INR",
            receipt: `order_${Date.now()}`
        };
        const order = await razorpay.orders.create(options);
        return order;
    } catch (error) {
        throw new Error('Error creating Razorpay order: ' + error.message);
    }
};


//getting checkout page..........................................................

const getcheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user._id;
        if (!userId) {
            return res.redirect("/login");
        }

        // Fetch complete user data including wallet
        const user = await User.findById(userId);
        if (!user) {
            return res.redirect("/login");
        }

        // Fetch wallet data
        const wallet = await Wallet.findOne({ userId: user._id }) || { totalBalance: 0 };
        user.wallet = wallet.totalBalance || 0;

        const productId = req.query.id || null;
        const quantity = parseInt(req.query.quantity) || 1;

        const address = await Address.findOne({ userId: user._id });
        const addressData = address || { address: [] };

        const availableCoupons = await Coupon.find({
            isActive: true,
            expireOn: { $gt: new Date() },
        });
        if (!productId) {
            // Handle cart checkout
            const cart = await Cart.findOne({ userId: user._id }).populate("items.productId");
            
            if (!cart || !cart.items || cart.items.length === 0) {
                return res.redirect("/");
            }

            // Filter out invalid products and map valid ones
            const products = cart.items
                .filter(item => item.productId && item.productId._id) 
                .map(item => {
                    const product = item.productId;
                    return {
                        _id: product._id,
                        productName: product.productName || 'Unknown Product',
                        productImage: Array.isArray(product.productImage) && product.productImage.length > 0 
                            ? product.productImage 
                            : ["default-image.jpg"],
                        salesPrice: parseFloat(product.salesPrice || 0),
                        price : parseFloat(item.price || 0),
                        quantity: parseInt(item.quantity || 1),
                    };
                });

            if (products.length === 0) {
                return res.redirect("/");
            }

            const subtotal = products.reduce((sum, item) => {
                return sum + (item.price * item.quantity);
            }, 0);

            return res.render("checkout", {
                user,
                product: products,
                subtotal,
                quantity: null,
                addressData,
                availableCoupons,
                wallet,
                
            });
        }

        // Handle single product checkout
        const product = await Product.findById(productId);
        if (!product) {
            return res.redirect("/pageNotFound");
        }

        const productData = {
            _id: product._id,
            productName: product.productName || 'Unknown Product',
            productImage: Array.isArray(product.productImage) && product.productImage.length > 0 
                ? product.productImage 
                : ["default-image.jpg"],
            salesPrice: parseFloat(product.salesPrice || 0),
            quantity: parseInt(quantity)
        };

        const subtotal = productData.salesPrice * productData.quantity;
        
        return res.render("checkout", {
            user,
            product: [productData], // Wrap in array to maintain consistency
            subtotal,
            quantity,
            addressData,
            availableCoupons,
            wallet
        });

    } catch (error) {
        console.error("Error fetching checkout page:", error);
        console.error(error.stack);
        return res.redirect("/pageNotFound");
    }
};
const calculateDeliveryCharge = (address) => {
    const baseCharge = 0;
    const distanceCharge = 0; 
    return baseCharge + distanceCharge;
};

const postCheckout = async (req, res) => {
    try {
        const userId = req.session.user._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to continue" });
        }

        const { address, products, subtotal, total, paymentMethod } = req.body;
        if (!address || !products || !subtotal || !total || !paymentMethod) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const parsedProducts = JSON.parse(products);
        if (!Array.isArray(parsedProducts) || parsedProducts.length === 0) {
            return res.status(400).json({ success: false, message: "No products provided" });
        }

        // Check if COD is allowed for orders above Rs 1000
        if (paymentMethod === 'COD' && total > 1000) {
            return res.status(400).json({ success: false, message: "COD not available for orders above Rs 1000" });
        }

        // Update product quantities
        for (const pro of parsedProducts) {
            const product = await Product.findById(pro._id);
            if (!product) {
                return res.status(404).json({ success: false, message: `Product not found: ${pro._id}` });
            }
            
            if (product.quantity < pro.quantity) {
                return res.status(400).json({ success: false, message: `Insufficient stock for ${product.productName}` });
            }

            const newQuantity = product.quantity - pro.quantity;
            const updatedTotalSales = product.totalSalesCount + pro.quantity;

            await Product.findByIdAndUpdate(pro._id, {
                quantity: newQuantity,
                totalSalesCount: updatedTotalSales,
            });
        }

        const deliveryCharge = calculateDeliveryCharge(address);
        const finalTotal = parseFloat(total) + deliveryCharge;
        let orderId = null;

        // Check wallet balance if using wallet payment
        if (paymentMethod === 'Wallet') {
            const userWallet = await Wallet.findOne({ userId });
            if (!userWallet) {
                return res.status(404).json({ success: false, message: "Wallet not found" });
            }

            if (userWallet.totalBalance < finalTotal) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Insufficient wallet balance",
                    required: finalTotal,
                    available: userWallet.totalBalance
                });
            }
        }

        const orderedItems = parsedProducts.map(product => ({
            product: product._id,
            price: product.salesPrice,
            quantity: product.quantity,
        }));

        const newOrder = new Order({
            userId: userId,
            orderItems: orderedItems,
            address: address,
            shippingAddress: address,
            totalPrice: subtotal,
            finalAmount: finalTotal,
            deliveryCharge: deliveryCharge,
            status: "Pending",
            paymentMethod: paymentMethod,
            paymentStatus: paymentMethod === 'Wallet' ? "Completed" : "Pending",
            paymentId: orderId,
        });

        const savedOrder = await newOrder.save();
        if (!savedOrder) {
            return res.status(500).json({ success: false, message: "Failed to create order" });
        }

        if (paymentMethod === 'Wallet') {
            // Deduct amount from wallet
            const userWallet = await Wallet.findOne({ userId });
            if (!userWallet) {
                return res.status(404).json({ success: false, message: "Wallet not found" });
            }

            userWallet.totalBalance -= finalTotal;
            userWallet.transactions.push({
                type: 'Purchase',
                amount: -finalTotal,
                orderId: savedOrder._id.toString(),
                status: 'Completed',
                description: `Payment for Order #${savedOrder._id}`
            });
            await userWallet.save();

            // Clear cart
            await Cart.findOneAndUpdate({ userId: userId }, { $set: { items: [] } });
            
            return res.status(200).json({ 
                success: true, 
                message: "Order placed successfully using wallet", 
                orderId: savedOrder._id 
            });
        } else if (paymentMethod === 'online') {
            const order = await createRazorpayOrder(finalTotal);
            orderId = order.id;
            return res.status(200).json({
                success: true,
                order_id: order.id,
                key_id: process.env.RAZORPAY_KEY_ID,
                amount: finalTotal * 100,
                currency: "INR",
                name: "Your Store Name",
                description: "Purchase Description",
                prefill: {
                    name: req.session.user.name,
                    email: req.session.user.email,
                    contact: req.session.user.phone
                },
                orderId: savedOrder._id
            });
        }

        // For COD
        await Cart.findOneAndUpdate({ userId: userId }, { $set: { items: [] } });
        return res.status(200).json({ 
            success: true, 
            message: "Order placed successfully", 
            orderId: savedOrder._id 
        });

    } catch (error) {
        console.error("Error placing order:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error", 
            error: error.message 
        });
    }
};

//Payment verification..............................................................

const verifyPayment = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated"
            });
        }

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderDetails, retryPayment } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderDetails) {
            return res.status(400).json({
                success: false,
                message: "Missing required payment parameters"
            });
        }

        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        const data = `${razorpay_order_id}|${razorpay_payment_id}`;
        const generated_signature = hmac.update(data).digest('hex');

        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment signature"
            });
        }

        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        if (payment.status !== 'captured') {
            const failedOrder = await Order.findOneAndUpdate(
                { paymentId: razorpay_payment_id },
                {
                    paymentStatus: 'Pending',
                    status: 'Payment Failed'
                },
                { new: true }
            );

            return res.status(400).json({
                success: false,
                message: "Payment failed",
                orderId: failedOrder._id
            });
        }
        if(retryPayment){
            const order =await Order.findOneAndUpdate({_id:req.body.orderId},{paymentStatus:"Completed",status:"Pending"})
            
            return res.status(200).json({
                success: true,
                message: "Payment verified and order placed successfully",

        });}
     
        const order =await Order.findOneAndUpdate({_id:orderDetails.orderId},{paymentStatus:"Completed",status:"Pending"})

        return res.status(200).json({
            success: true,
            message: "Payment verified and order placed successfully",
            orderId: orderDetails.orderId
        });

    } catch (error) {
        console.error("Error in payment verification:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

//retrying the payment in razorpay.....................................................................................

const retryPayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: "Order ID not provided"
            });
        }

        const order = await Order.findById(orderId).populate('userId');
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Create new Razorpay order
        const razorpayOrder = await createRazorpayOrder(order.finalAmount);

        const orderDetails = {
            order_id: razorpayOrder.id,
            key_id: process.env.RAZORPAY_KEY_ID,
            amount: order.finalAmount * 100,
            currency: "INR",
            name: "NextTick",
            description: `Order Payment - ${orderId}`,
            prefill: {
                name: order.userId.name || '',
                email: order.userId.email || '',
                contact: order.userId.phone || ''
            }
        };

        res.status(200).json({
            success: true,
            message: "Retry payment initiated",
            data: orderDetails
        });

    } catch (error) {
        console.error("Error retrying payment:", error.message);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}


//order confirming...............................................................


const orderConfirm = async (req, res) => {
    const orderId = req.query.id;
    try {
        if (!req.session.user) {
            return res.redirect("/signup");
        }
        return res.render("orderConfirmation");
    } catch (error) {
        return res.redirect("/pageNotFound");
    }
};

//applying couponCode........................................................
const applyCoupon = async (req, res) => {
    try {
        const { couponCode, totalAmount } = req.body;
        const userId = req.session?.user?._id;

        if (!userId) {
            return res.redirect("/login");
        }
        if (!couponCode || !totalAmount) {
            return res.status(400).json({ success: false, message: "Value not found" });
        }

        const findCoupon = await Coupon.findOne({ name: couponCode });
        if (!findCoupon) {
            return res.status(400).json({ success: false, message: "Invalid coupon code" });
        }

        const today = new Date();
        if (findCoupon.expireOn < today) {
            return res.status(400).json({ success: false, message: "Coupon expired" });
        }

        let findUser = await User.findOne({ _id: userId });

        if (!findUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!findUser.coupons) {
            findUser.coupons = [];
        }

        const isCouponUsed = findUser.coupons.some(
            (coupon) => coupon.couponName === couponCode
        );
        if (isCouponUsed) {
            return res.status(400).json({ success: false, message: "Coupon already used" });
        }

        findUser.coupons.push({ couponName: couponCode });
        await findUser.save();

        const discountAmount = (findCoupon.offerPrice / 100) * parseFloat(totalAmount);
        const finalPrice = parseFloat(totalAmount) - discountAmount;

        return res.status(200).json({
            success: true,
            message: "Coupon applied successfully",
            totalAmount: finalPrice.toFixed(2),
            discount: discountAmount.toFixed(2),
        });
    } catch (error) {
        console.error("Error applying coupon:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


module.exports = {
    getcheckoutPage,
    postCheckout,
    orderConfirm,
    verifyPayment,
    applyCoupon,
    retryPayment
};