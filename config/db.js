const mongoose =require("mongoose");
const env =require("dotenv").config();

const connectDB =async ()=>{
    try {
        await mongoose.connect(process.env.MONGODB_URI);
       console.log("DB Connected");
       
    } catch (error) {
        console.log("DB Connection error",error.message);
        process.exit(1)
    }
   }


 module.exports=connectDB;
