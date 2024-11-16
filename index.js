const express=require("express");
const app=express(); // app server instance 
const path=require("path");
const env=require("dotenv").config(); // inputing .env
const db =require("./config/db")
const userRouter = require("./routes/userRouter")
db();

app.use(express.json()); //middleware
app.use(express.urlencoded({extended:true}));

app.set("view engine","ejs") //view engine setting

// Set multiple views directories
app.use(express.static(path.join(__dirname, "public")));

app.set("views", [
    path.join(__dirname, "views/user"),
    path.join(__dirname, "views/admin"),
]);

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

app.use("/",userRouter);

const PORT =1212 || process.env.PORT
app.listen(PORT,()=>{
    console.log("Server Running!...........");
    
})

module.exports = app;