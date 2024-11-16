const mongoose =require("mongoose");
const {Schema}=mongoose;

const brandSchema =new mongoose.Schema({
    brandName:{
        type:String,
        required:true
    },
    brandImage:{
        type:[String],
        required:true
    },
    isBlocked:{
        type:Boolean,
       default:false
    },
    createdAt:{
        type:Date,
        default:Date.now
    }
})

const Brand =mongoose.model("Brand",brandSchema)

module.exports=Brand;