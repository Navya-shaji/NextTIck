const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require('../../models/orderSchema');
const Wallet = require('../../models/walletSchema');
const mongoose = require('mongoose');


const listOrders = async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate('userId', 'name email')
            .populate('orderItems.product')
            .populate('address')
            .sort({ createdOn: -1 })
            .lean();

        const processedOrders = orders.map(order => ({
            ...order,
            userName: order.userId ? order.userId.name : 'Unknown User'
        }));

        res.render('orders', { 
            orders: processedOrders,
            title: 'Order Management'
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).render('admin/error', { message: 'Failed to fetch orders' });
    }
};
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
const getAdminOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const order = await Order.findById(orderId)
            .populate('userId', 'name email') 
            .populate('orderItems.product') 
            .lean(); 

        if (!order) {
            return res.status(404).render('admin/error', { message: 'Order not found' });
        }

        res.render('orderData', {
            order, 
            title: 'Order Details',
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render('admin/error', { message: 'Failed to fetch order details' });
    }
};

const processReturn = async (req, res) => {
    const { orderId } = req.body;
    const userId = req.user._id; // Get logged in user's ID
    
    try {
        // Find the order and user
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

        // Validate order status
        if (order.status !== 'Delivered') {
            return res.status(400).json({ 
                success: false, 
                message: 'Only delivered orders can be returned' 
            });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Find or create wallet
            let wallet = await Wallet.findOne({ user: userId }).session(session);
            
            if (!wallet) {
                wallet = new Wallet({
                    user: userId,
                    balance: 0,
                    history: []
                });
                // Link wallet to user
                user.wallet = wallet._id;
                await user.save({ session });
            }

            const refundAmount = order.finalAmount;
            
            // Update wallet
            wallet.balance += refundAmount;
            wallet.history.push({
                status: 'refund',
                payment: refundAmount,
                date: new Date(),
                description: `Refund for order ${order.orderId}`,
                orderId: order._id
            });

            // Update order
            order.status = 'Returned';
            order.returnedByUser = true;
            order.userId = userId;

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
                newBalance: wallet.balance
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