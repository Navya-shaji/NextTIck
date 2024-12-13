const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require('../../models/orderSchema');



const listOrders = async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate('userId', 'name email')
            .populate('orderItems.product')
            .populate('address')
            .sort({ createdOn: -1 })
            .lean();

        // Check if userId is populated for each order
        const processedOrders = orders.map(order => ({
            ...order,
            userName: order.userId ? order.userId.name : 'Unknown User'
        }));

        res.render('orders', { 
            orders: processedOrders,
            title: 'Order Management'
        });
        console.log("orders", processedOrders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).render('admin/error', { message: 'Failed to fetch orders' });
    }
};


const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        console.log(orderId,status)
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        // Validate status transition
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
        
        // Find the order and populate the address field
        const order = await Order.findById(orderId)
            .populate('userId', 'name email') // Populate user details
            .populate('orderItems.product')  // Populate product details in order items             // Populate address field
            .lean(); // Convert to plain JavaScript object for easier handling

        // Check if order exists
        if (!order) {
            return res.status(404).render('admin/error', { message: 'Order not found' });
        }

        // Render the order details page with populated address
        res.render('orderData', {
            order,  // Pass the populated address to the view
            title: 'Order Details',
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render('admin/error', { message: 'Failed to fetch order details' });
    }
};



module.exports = {
    getAdminOrderDetails,
    getCancelledOrders,
    updateOrderStatus,
    listOrders
};