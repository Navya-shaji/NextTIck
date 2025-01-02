const Order = require('../../models/orderSchema');    
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const mongoose = require("mongoose");


const loadDashboard = async (req, res) => {
    try {
        const order=await Order.find({status:"completed"}).sort({createdAt:-1}).limit(5);
        const product=await Product.find({}).sort({createdAt:-1}).limit(5);
        const category=await Category.find({}).sort({createdAt:-1}).limit(5);
        const brand=await Brand.find({}).sort({createdAt:-1}).limit(5);
        res.render("dashboard",{order,product,category,brand});

    }
    catch (err) {
        console.log(err)
    }
}

module.eports={
    loadDashboard
}
