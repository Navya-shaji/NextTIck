const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require('../../models/orderSchema');
const Wallet = require('../../models/walletSchema');
const mongoose = require('mongoose');


//listing orders......................................................................................................
const listOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1; 
        const limit = 20; 
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments(); 
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find({})
            .populate('userId', 'name email')
            .populate('orderItems.product')
            .populate('address')
            .sort({ createdOn: -1 })
            .skip(skip) 
            .limit(limit) 
            .lean();

        const processedOrders = orders.map(order => ({
            ...order,
            userName: order.userId ? order.userId.name : 'Unknown User',
            couponDetails: order.couponApplied ? `Coupon: ${order.couponCode} applied.` : 'No coupon applied.',
            
            offerDetails: order.offerApplied ? order.offerDetails : 'No offer applied.'
        }));
        console.log(processedOrders);
        

        if (req.headers.accept === 'application/json') {
            return res.json({
                orders: processedOrders,
                currentPage: page,
                totalPages,
            });
        }

        res.render('orders', { 
            orders: processedOrders,
            currentPage: page,
            totalPages,
            title: 'Order Management',
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).render('admin/error', { message: 'Failed to fetch orders' });
    }
};

//updating the order status................................................................................................................

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (order.status === 'Delivered' && order.returnedByUser) {
            return res.status(400).json({
                success: false,
                message: 'Cannot change status for an order that is delivered and cancelled by the user'
            });
        }

        const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Return Request", "Returned"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        order.status = status;
        await order.save();

        res.json({
            success: true,
            message: 'Order status updated successfully'
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order status'
        });
    }
};


//for getting cancelled orders...............................................................

const getCancelledOrders = async (req, res) => {
    try {
        const cancelledOrders = await Order.find({ status: 'Cancelled' })
            .populate('userId', 'name email')
            .populate('orderItems.product')
            .populate('address')
            .sort({ createdOn: -1 })
            .lean();

        res.render('cancelled-orders', {
            orders: cancelledOrders,
            title: 'Cancelled Orders'
        });
    } catch (error) {
        console.error('Error fetching cancelled orders:', error);
        res.status(500).render('admin/error', { message: 'Failed to fetch cancelled orders' });
    }
};

//getting order details...........................................................................................................
const getAdminOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId)
            .populate('userId', 'name email')
            .populate('orderItems.product', 'name price productImage') // Add productImage to population
            .populate('address', 'street city postalCode')
            .lean();

        if (!order) {
            return res.status(404).render('admin/error', { message: 'Order not found' });
        }

        // Process order items to ensure productImage exists
        order.orderItems = order.orderItems.map(item => ({
            ...item,
            product: {
                ...item.product,
                productImage: item.product?.productImage || ['default-product-image.jpg'] // Provide a default image
            }
        }));

        res.render('orderData', {
            order,
            title: 'Order Details',
            offerApplied: order.offerApplied || 'No Offer',
            couponDetails: order.couponApplied
                ? `${order.couponApplied.code} (Discount: ₹${order.couponApplied.discount})`
                : 'No Coupon',
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render('admin/error', { message: 'Failed to fetch order details' });
    }
};


const processReturn = async (req, res) => {
    const { orderId, returnReason } = req.body;  
    const userId = req.user._id; 

    try {
        const order = await Order.findById(orderId);
        const user = await User.findById(userId);

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({ 
                success: false, 
                message: 'Only delivered orders can be returned' 
            });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            let wallet = await Wallet.findOne({ user: userId }).session(session);

            if (!wallet) {
                wallet = new Wallet({
                    user: userId,
                    balance: 0,
                    history: []
                });
                user.wallet = wallet._id;
                await user.save({ session });
            }

            const refundAmount = order.finalAmount;

            wallet.balance += refundAmount;
            wallet.history.push({
                status: 'refund',
                payment: refundAmount,
                date: new Date(),
                description: `Refund for order ${order.orderId}`,
                orderId: order._id
            });

            // Update order with return reason and status
            order.status = 'Returned';
            order.returnedByUser = true;
            order.userId = userId;
            order.returnReason = returnReason;  // Store the return reason in the order

            // Save all changes
            await Promise.all([
                wallet.save({ session }),
                order.save({ session }),
                user.save({ session })
            ]);

            await session.commitTransaction();

            res.status(200).json({ 
                success: true, 
                message: 'Order returned successfully and refund added to wallet.',
                refundAmount: refundAmount,
                newBalance: wallet.balance,
                returnReason: order.returnReason  // Send the return reason in the response
            });

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }

    } catch (error) {
        console.error('Error processing return:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to process return: ' + error.message 
        });
    }
};

module.exports = {
    getAdminOrderDetails,
    getCancelledOrders,
    updateOrderStatus,
    listOrders,
    processReturn
};