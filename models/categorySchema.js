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
    isListed:{
        type:Boolean,
        required:true
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

const Category =mongoose.model("category",categorySchema)

module.exports =Category;