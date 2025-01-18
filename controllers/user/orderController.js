const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require('../../models/orderSchema');
const Wallet = require("../../models/walletSchema")
const mongoose = require('mongoose');

//for getting the order history page..........................................

const getOrderHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const orders = await Order.find({ userId }).sort({ createdOn: -1 }).lean();

        res.render('profile', {
            orders: orders,
            activeTab: 'orders'
        });
    } catch (error) {
        console.error('Error fetching order history:', error);
        res.status(500).render('error', { message: 'Internal Server Error' });
    }
};


// for geting the order details page...................................................

const getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        const order = await Order.findOne({ _id: orderId, userId })
            .populate('orderItems.product')
            .populate('address');

        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }

        res.render('orderDetails', { order });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render('error', { message: 'Internal Server Error' });
    }
};


//for cancelling orders.......................................
const cancelOrder = async (req, res) => {
    try {
        const { orderId, cancellationReason } = req.body;
        
        if (!orderId || !cancellationReason) {
            return res.status(400).json({ 
                success: false, 
                message: 'Order ID and cancellation reason are required' 
            });
        }

        // Find the order
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        if (order.status !== 'Pending') {
            return res.status(400).json({ 
                success: false, 
                message: 'Only pending orders can be cancelled' 
            });
        }

        // Update order status and reason
        order.status = 'Cancelled';
        order.cancellationReason = cancellationReason;
        
        // Save the order
        await order.save();

        // Restore product stock for each item in the order
        if (order.orderItems && Array.isArray(order.orderItems)) {
            for (const item of order.orderItems) {
                try {
                    const product = await Product.findById(item.product);
                    if (product) {
                        product.quantity += item.quantity;
                        await product.save();
                    }
                } catch (stockError) {
                    console.error('Error updating product stock:', stockError);
                }
            }
        }

        // Handle refund if payment was completed
        if (order.paymentStatus === 'Completed') {
            try {
                await addRefundToWallet(order.userId, order.finalAmount, orderId);
                return res.status(200).json({ 
                    success: true, 
                    message: 'Order cancelled successfully and amount refunded to wallet' 
                });
            } catch (refundError) {
                console.error('Error processing refund:', refundError);
                return res.status(200).json({ 
                    success: true, 
                    message: 'Order cancelled successfully but refund failed. Our team will process it manually.' 
                });
            }
        }

        return res.status(200).json({ 
            success: true, 
            message: 'Order cancelled successfully' 
        });

    } catch (error) {
        console.error('Error cancelling order:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to cancel order. Please try again.' 
        });
    }
};//Refund adding...................................
const addRefundToWallet = async (userId, amount, orderId) => {
    try {
        let wallet = await Wallet.findOne({ userId });

        if (!wallet) {
            // Initialize new wallet with the refund amount as the initial balance
            wallet = new Wallet({
                userId,
                totalBalance: amount,
                transactions: []
            });
        } else {
            // If wallet exists, ensure transactions array exists
            if (!Array.isArray(wallet.transactions)) {
                wallet.transactions = [];
            }
            // Add refund amount to existing balance
            wallet.totalBalance += amount;
        }

        // Add the transaction record
        wallet.transactions.push({
            type: 'Refund',
            amount: amount,
            orderId: orderId,
            status: 'Completed',
            description: `Refund for order ${orderId}`
        });

        await wallet.save();
        return wallet;
    } catch (error) {
        console.error('Error processing refund:', error);
        throw error;
    }
};


//order status...............................................

const getOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.status(200).json({ success: true, status: order.status });
    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch order status' });
    }
};



//viewing the orderDetails..................................................

const viewOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId)
            .populate('orderItems.product')

        const addresses = await Address.find({ userId: order.userId });
        const address = addresses.flatMap(addr => addr.address).find(add => {
            return add._id.toString() == order.address.toString()// Use equals for ObjectId comparison
        });

        if (!order) {
            return res.status(404).send('Order not found');
        }
        res.render('order-details-full', { order, address });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).send('Server error');
    }
};


//changing order status............................

const changeOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { newStatus } = req.body;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }


        const allowedStatusChanges = {
            'Pending': ['Processing', 'Cancelled'],
            'Processing': ['Shipped', 'Cancelled'],
            'Shipped': ['Delivered', 'Returned'],
            'Delivered': ['Returned'],

        };

        if (!allowedStatusChanges[order.status] || !allowedStatusChanges[order.status].includes(newStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid status change' });
        }

        order.status = newStatus;
        await order.save();

        res.json({ success: true, message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Error changing order status:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


//showing the return reason page...............................................

const showReturnReasonPage = async (req, res) => {
    const orderId = req.params.orderId
    try {
        const order = await Order.findOne({ orderId });

        res.render('return-reason', { orderId });
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).send('Internal Server Error');
    }
};


// Submit the return reason..............................
const submitReturnReason = async (req, res) => {
    const { orderId, reason } = req.body;

    if (!orderId || !reason) {
        return res.status(400).json({
            success: false,
            message: 'Order ID and return reason are required'
        });
    }

    try {

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID format'
            });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const allowedStatuses = ['Delivered'];
        if (!allowedStatuses.includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: 'This order is not eligible for return'
            });
        }

        order.returnReason = reason;
        order.status = 'Return Request';

        await order.save();

        res.json({
            success: true,
            message: 'Return request successfully submitted!'
        });

    } catch (error) {
        console.error('Error submitting return reason:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process return request'
        });
    }
};


//updating order status..................................................


const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;

        if (!orderId || !status) {
            return res.status(400).json({
                success: false,
                message: "Order ID and status are required."
            });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        order.status = status;
        await order.save();

        res.json({
            success: true,
            message: "Order status updated successfully."
        });
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


//returning...................................
const processReturn = async (req, res) => {
    const { orderId, userId } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const order = await Order.findById(orderId).session(session);

        if (!order || order.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Invalid return request' });
        }

        if (order.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized return request' });
        }

        const returnDeadline = new Date(order.deliveryDate);
        returnDeadline.setDate(returnDeadline.getDate() + 30); // 30-day return policy
        if (new Date() > returnDeadline) {
            return res.status(400).json({ success: false, message: 'Return period has expired' });
        }

        if (order.status === 'Returned') {
            return res.status(400).json({ success: false, message: 'Order has already been returned' });
        }

        order.status = 'Returned';
        await order.save({ session });

        const refundAmount = order.finalAmount;
        const user = await User.findById(userId).session(session);
        user.walletBalance += refundAmount;
        await user.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ 
            success: true, 
            message: 'Order returned successfully and wallet updated.', 
            data: { walletBalance: user.walletBalance } 
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error processing return:', { orderId, userId, error });
        res.status(500).json({ success: false, message: 'Failed to process return' });
    }
};

// New controller methods for handling product-specific order actions

const getOrderProducts = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('products.product');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Format products for frontend
        const products = order.products.map(item => ({
            _id: item.product._id,
            name: item.product.name,
            price: item.price,
            quantity: item.quantity,
            image: item.product.images[0] // Assuming first image is main image
        }));

        res.json({
            success: true,
            products
        });
    } catch (error) {
        console.error('Error fetching order products:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order products'
        });
    }
};

const cancelOrderProducts = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { products } = req.body;

        if (!products || products.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No products selected for cancellation'
            });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Update order status for selected products
        products.forEach(({ productId, reason }) => {
            const orderProduct = order.products.find(p => p.product.toString() === productId);
            if (orderProduct) {
                orderProduct.status = 'Cancelled';
                orderProduct.cancellationReason = reason;
            }
        });

        // Check if all products are cancelled
        const allCancelled = order.products.every(p => p.status === 'Cancelled');
        if (allCancelled) {
            order.status = 'Cancelled';
        }

        await order.save();

        // If payment was made, initiate refund process
        if (order.paymentStatus === 'Paid') {
            // Add refund logic here
            // You might want to create a wallet transaction or initiate payment gateway refund
        }

        res.json({
            success: true,
            message: 'Products cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling products:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel products'
        });
    }
};

const returnOrderProducts = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { products } = req.body;

        if (!products || products.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No products selected for return'
            });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Update order status for selected products
        products.forEach(({ productId, reason }) => {
            const orderProduct = order.products.find(p => p.product.toString() === productId);
            if (orderProduct) {
                orderProduct.status = 'Return Requested';
                orderProduct.returnReason = reason;
            }
        });

        // Check if all products are returned
        const allReturned = order.products.every(p => p.status === 'Return Requested');
        if (allReturned) {
            order.status = 'Return Requested';
        }

        await order.save();

        res.json({
            success: true,
            message: 'Return request submitted successfully'
        });
    } catch (error) {
        console.error('Error processing return:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process return request'
        });
    }
};

module.exports = {
    getOrderHistory,
    cancelOrder,
    getOrderStatus,
    getOrderDetails,
    viewOrderDetails,
    changeOrderStatus,
    updateOrderStatus,
    showReturnReasonPage,
    submitReturnReason,
    processReturn,
    getOrderProducts,
    cancelOrderProducts,
    returnOrderProducts
};