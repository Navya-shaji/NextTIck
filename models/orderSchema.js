
const mongoose =require("mongoose")
const {Schema}=mongoose;
const {v4:uuidv4} = require("uuid");

const orderSchema =new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        // required: true
    },
    orderId:{
        type:String,
        default:()=>uuidv4(),
        unique:true
    },
    orderItems:[{
        product:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required:true
        },
        quantity:{
            type:Number,
            required:true
        },
        price:{
            type:Number,
            default:0
        }
    }],
    totalPrice:{
      type:Number,
      required:true
    },
    discount:{
        type:Number,
        default:0
    },
    finalAmount:{
        type:Number,
        required:true
    },
    address:{
        type:Schema.Types.ObjectId,
        ref:"Address",  
        required:true
    },
    invoiceDate:{
        type:Date
    },
    status:{
        type:String,
        required:true,
        enum:["Pending","Processing","Shipped","Delivered","Cancelled","Return Request","Returned"]

    },
    returnedByUser: { type: Boolean, default: false },  

    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    couponApplied:{
       type:Boolean,
       default:false,
    },
    paymentId: {
        type: String
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed']
    },
    returnReason: { 
        type: String,
        required: false
    },
    paymentId:{
        type:String,
        required:false
    },
    cancellationReason: {
        type: String,
        default: null
    },
   
    
})
const Order =mongoose.model("Order",orderSchema);
module.exports = Order;
