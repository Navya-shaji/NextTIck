
const User=require("../../models/userSchema");
const mongoose=require("mongoose")
const bcrypt=require("bcrypt")
const Order = require("../../models/orderSchema");
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { Table } = require('pdfkit-table');


const pageerror=async(req,res)=>{
    res.render("admin-error")
}



const loadLogin =(req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("adminLogin",{message:null})
}



const login=async(req,res)=>{
    try {
        const {email,password} =req.body;
        const admin =await User.findOne({email,isAdmin:true})
        if(admin){
            const passwordMatch = bcrypt.compare(password,admin.password);
            if(passwordMatch){
                req.session.admin = true
                return res.redirect("/admin")
            }else{
                return res.redirect("/login")
            }
        }else{
            return res.redirect("/login")
        }
    } catch (error) {
        console.log("Login Error",error);
        return res.redirect("/pageerror")
        
    }
}



const loadDashboard = async (req,res)=>{
    if(req.session.admin){
        try {
            res.render("dashboard")
        } catch (error) {
            res.redirect("/pageerror")
        }
    }
}



const logout =async(req,res)=>{
    try {
        req.session.destroy(err=>{
            if(err){
                console.log("Error destroying session",err);
                return res.redirect("/pageerror")
                
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("unexpected error during logout",error);
        res.redirect("/pageerror")
    }
}


// ... (keep your existing functions)

const loadSalesReport = async (req, res) => {
    if (req.session.admin) {
        try {
            res.render("salesReport", { salesData: null });
        } catch (error) {
            console.log("Error loading sales report page:", error);
            res.redirect("/pageerror");
        }
    } else {
        res.redirect("/login");
    }
};

const generateSalesReport = async (req, res) => {
    if (req.session.admin) {
        try {
            const { startDate, endDate, reportType } = req.body;
            const salesData = await fetchSalesData(startDate, endDate, reportType);
            res.render("salesReport", { salesData });
        } catch (error) {
            console.log("Error generating sales report:", error);
            res.redirect("/pageerror");
        }
    } else {
        res.redirect("/login");
    }
};

const downloadSalesReport = async (req, res) => {
    if (req.session.admin) {
        try {
            const { startDate, endDate, reportType, format } = req.query;
            const salesData = await fetchSalesData(startDate, endDate, reportType);

            if (format === 'pdf') {
                const pdfBuffer = await generatePDFReport(salesData);
                res.contentType('application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');
                res.send(pdfBuffer);
            } else if (format === 'excel') {
                const excelBuffer = await generateExcelReport(salesData);
                res.contentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename=sales_report.xlsx');
                res.send(excelBuffer);
            } else {
                res.status(400).send('Invalid format specified');
            }
        } catch (error) {
            console.log("Error downloading sales report:", error);
            res.redirect("/pageerror");
        }
    } else {
        res.redirect("/login");
    }
};

async function fetchSalesData(startDate, endDate, reportType) {
    let dateFilter = {};

    if (reportType === 'custom' && startDate && endDate) {
        dateFilter = { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } };
    } else if (reportType === 'daily') {
        const today = new Date();
        dateFilter = { createdAt: { $gte: new Date(today.setHours(0, 0, 0, 0)) } };
    } else if (reportType === 'weekly') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        dateFilter = { createdAt: { $gte: oneWeekAgo } };
    } else if (reportType === 'monthly') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        dateFilter = { createdAt: { $gte: oneMonthAgo } };
    } else if (reportType === 'yearly') {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        dateFilter = { createdAt: { $gte: oneYearAgo } };
    }

    const orders = await Order.find(dateFilter).populate('orderItems.product');

    const salesData = {
        totalSales: orders.length,
        totalAmount: orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0),
        totalDiscount: orders.reduce((sum, order) => sum + (order.discount || 0), 0),
        orders: orders.map(order => ({
            orderId: order.orderId || 'Unknown',
            date: order.createdAt || null,
            amount: order.finalAmount || 0,
            discount: order.discount || 0,
            couponCode: order.couponCode || 'N/A'
        }))
    };
    

    return salesData;
}
async function generatePDFReport(salesData) {
    const doc = new PDFDocument();
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {});

    // Header
    doc.fontSize(18).text('Sales Report', { align: 'center' });
    doc.moveDown();

    // Summary
    doc.fontSize(12).text(`Total Sales: ${salesData.totalSales}`);
    doc.text(`Total Amount: $${salesData.totalAmount.toFixed(2)}`);
    doc.text(`Total Discount: $${salesData.totalDiscount.toFixed(2)}`);
    doc.moveDown();

    // Table headers
    const tableHeaders = ['Order ID', 'Date', 'Amount', 'Discount', 'Coupon'];
    const tableRows = salesData.orders.map(order => [
        order.orderId,
        order.date ? new Date(order.date).toLocaleDateString() : 'N/A',
        `$${order.amount.toFixed(2)}`,
        `$${order.discount.toFixed(2)}`,
        order.couponCode || 'N/A'
    ]);

    // Table Drawing
    const startX = 50;
    let startY = doc.y;

    // Draw headers
    doc.fontSize(10).font('Helvetica-Bold');
    tableHeaders.forEach((header, index) => {
        doc.text(header, startX + index * 120, startY);
    });
    startY += 20; // Move down after headers

    // Draw rows
    doc.fontSize(10).font('Helvetica');
    tableRows.forEach(row => {
        row.forEach((cell, index) => {
            doc.text(cell, startX + index * 120, startY);
        });
        startY += 20; // Move down after each row
    });

    // End document
    doc.end();
    return Buffer.concat(buffers);
}
async function generateExcelReport(salesData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 15 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Discount', key: 'discount', width: 15 },
        { header: 'Coupon', key: 'couponCode', width: 15 }
    ];

    worksheet.addRows(salesData.orders);

    worksheet.addRow({});
    worksheet.addRow({ orderId: 'Total Sales', date: salesData.totalSales });
    worksheet.addRow({ orderId: 'Total Amount', date: `$${salesData.totalAmount.toFixed(2)}` });
    worksheet.addRow({ orderId: 'Total Discount', date: `$${salesData.totalDiscount.toFixed(2)}` });

    return await workbook.xlsx.writeBuffer();
}



module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
    loadSalesReport,
    generateSalesReport,
    downloadSalesReport
}