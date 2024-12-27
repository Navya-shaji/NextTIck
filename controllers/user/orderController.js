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
const getOrderCancel= async (req,res)=>{
    try {
        const userId=req.session.user;
        if(!userId){
            console.log('user not found');
            return res.redirect('/login')
        }

        const id=req.query.id;
        const reason=req.query.reason;
        const order = await Order.findById(id);
        if (!order) {
            console.log('Order not found');
            return res.redirect('/profile');
        }
        if (order.paymentMethod === 'Online' && order.paymentStatus === 'Completed') {
            const refundAmount = order.finalAmount;
            console.log(refundAmount);

            // Update the user's wallet
            const wallet = await Wallet.findOneAndUpdate(
                { userId },
                {
                    $inc: { balance: refundAmount }, // Increment wallet balance
                    $push: {
                        transactions: {
                            type: 'Refund',
                            amount: refundAmount,
                            orderId: id,
                            description: `Refund for cancelled order #${id}`,
                            status: 'Completed', // Assuming the refund is instant
                        },
                    },
                    lastUpdated: new Date(),
                },
                { new: true, upsert: true } // Create wallet if not present
            );

            console.log(`Refund of ₹${refundAmount} added to wallet for user ${userId}`);
        }else if(order.paymentMethod=='COD'){
            await Order.findByIdAndUpdate(id,{$set:{paymentStatus:'Failed'}})
        }


        await Order.findByIdAndUpdate(id,{$set:{status:'Cancelled',cancelleationReson:reason}})
        res.redirect('/profile')
    } catch (error) {
        console.error(error);
        res.redirect('/pageNotFound')

        
    }
}

//Refund adding...................................

const addRefundToWallet = async (userId, amount, orderId) => {
    try {
        let wallet = await Wallet.findOne({ userId });

        if (!wallet) {
         
            wallet = new Wallet({ userId, balance: 0, transactions: [] });
        }

        if (!Array.isArray(wallet.transactions)) {
            wallet.transactions = [];
        }

        wallet.balance += amount;
        wallet.transactions.push({
            type: 'Refund',
            amount: amount,
            orderId: orderId,
            status: 'Completed',
            description: `Refund for order ${orderId}`
        });

        await wallet.save();
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

const returnRequest = async (req, res) => {
    const { orderId, userId } = req.body;
  
    try {
      const order = await Order.findById(orderId);
  
      if (!order || order.status !== 'Delivered') {
        return res.status(400).json({ success: false, message: 'Invalid return request' });
      }
  
      order.status = 'Returned';
      await order.save();
  
    //   const refundAmount = order.finalAmount;
    //   const user = await User.findById(userId);
    //   user.walletBalance += refundAmount;
    //   await user.save();
  
      res.status(200).json({ success: true, message: 'Order returned successfully and wallet updated.' });
   
    } catch (error) {
      console.error('Error processing return:', error);
      res.status(500).json({ success: false, message: 'Failed to process return' });
    }
  };
  

//   const returnRequest=async (req,res)=>{
//     try {
//         const userId= req.session.user;
//         const {orderId,reason}= req.body;
//         const order=await Order.findById(orderId);
//         if(!order){
//             return res.status(400).json({message:'order not found'})
//         }
//         const exists=await Order.findOne({orderId});
//         if(exists){
//             return res.status(400).json({message:'order is already apply for return request'})
//         }
//         const refundAmount=order.finalAmount;
//         const newReturn=new Order({
//             userId,
//             orderId,
//             reason,
//             refundAmount,



//         })
//         await newReturn.save();
//         return res.status(200).json({message:'return request is successfully applied'})



//     } catch (error) {
//         console.log('error on return ');
//         console.error(error);
//         return res.status(400).json({message:'not found'})

        
//     }
// }
  
module.exports = {
    getOrderHistory,
    getOrderCancel,
    getOrderStatus,
    getOrderDetails,
    viewOrderDetails,
    changeOrderStatus,
    updateOrderStatus,
    showReturnReasonPage,
    submitReturnReason,
    // processReturn,
    addRefundToWallet   ,
    returnRequest

};