const mongoose =require("mongoose");
const {Schema}=mongoose;

const categorySchema =new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true
    },
    description:{
        type:String,
        required:true,
        
    },
    isListed: {
        type: Boolean,
        required: true,
        default: true, // Automatically set to true if not provided
    },
    categoryOffer:{
        type:Number,
        default:0
    },
    createdAt:{
        type:Date,
        default:Date.now
    }
})

const Category =mongoose.model("Category",categorySchema)

module.exports =Category;