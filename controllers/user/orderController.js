const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require('../../models/orderSchema');

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

// Cancel an Order
const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.body;

        // Find the order and update its status
        const order = await Order.findOneAndUpdate(
            { _id: orderId, status: 'Pending' }, // Allow cancellation only for 'Pending' orders
            { status: 'Cancelled' },
            { new: true }
        );

        if (!order) {
            return res.status(400).json({ success: false, message: 'Order cannot be cancelled' });
        }

        res.status(200).json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel order' });
    }
};

// Fetch Order Status
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



const viewOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId)
      .populate('orderItems.product')
      .populate('address');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    res.render('order-details-full', { order });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).send('Server error');
  }
};

const changeOrderStatus = async (req, res) => {
    try {
      const { orderId } = req.params;
      const { newStatus } = req.body;
  
      const order = await Order.findById(orderId);
  
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
  
      // Add any necessary validation for status changes here
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
  const showReturnReasonPage = async (req, res) => {
    const { orderId } = req.params; // Extract the orderId from the route parameter
    try {
        const order = await Order.findOne({ orderId }); // Find the order by orderId
        // if (!order) {
        //     return res.status(404).send('Order not found');
        // }

        // Render the return reason page with the order details
        res.render('return-reason', { order });
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Submit the return reason
const submitReturnReason = async (req, res) => {
    const { orderId, reason } = req.body; // Extract orderId and reason from the request body
    try {
        const order = await Order.findById(orderId); // Find the order
        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Update the return reason and status
        order.returnReason = reason;
        order.status = 'Returned'; // Update status to 'Returned'

        await order.save(); // Save changes to the database

        // Respond with success so client can trigger SweetAlert
        res.json({ success: true, message: 'Return request successfully submitted!' });
    } catch (error) {
        console.error('Error submitting return reason:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};



const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;

        if (!orderId || !status) {
            return res.status(400).json({
                success: false,
                message: "Order ID and status are required."
            });
        }

        const order = await Order.findById(orderId); // Replace with your database query
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


module.exports = {
    getOrderHistory,
    cancelOrder,
    getOrderStatus,
    getOrderDetails,
    viewOrderDetails,
    changeOrderStatus,
    updateOrderStatus,
    showReturnReasonPage,
    submitReturnReason

};