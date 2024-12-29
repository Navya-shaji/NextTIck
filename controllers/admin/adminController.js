
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

//loadig login page............................................................................................

const loadLogin =(req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("adminLogin",{message:null})
}


//login..........................................................................................................

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
        return res.redirect("/pageerror")
        
    }
}

// const login= async (req,res)=>{
//     try {
//         const {email,password} =req.body;
//         const admin = await User.findOne({email,isAdmin:true});
//         if(admin){
//             const passwordMatch = await bcrypt.compare(password,admin.password);
//             if(passwordMatch){
//                 req.session.admin=true;
//                 return res.redirect("/admin");
//             }else{
//                 return res.redirect("adminlogin?msg=Password not Match");
//             }
//         }else{
//             return res.redirect("/adminlogin?msg=Admin not found");
//         }
//     }catch (error) {
//         console.log("login error",error); 
//         return res.redirect("/pageerror");
//     }
// };


//loading dashboard................................................................................................

const loadDashboard = async (req,res)=>{
    if(req.session.admin){
        try {
            res.render("dashboard")
        } catch (error) {
            res.redirect("/pageerror")
        }
    }
}


//logout...........................................................................................................

const logout =async(req,res)=>{
    try {
        req.session.destroy(err=>{
            if(err){
                return res.redirect("/pageerror")
                
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        res.redirect("/pageerror")
    }
}


//for generating the Sales Report...................................................................................

const generateSalesReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.query;
        const salesData = await fetchSalesData(reportType, startDate, endDate);
        res.json({ success: true, ...salesData });
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).json({ success: false, message: 'Error generating sales report' });
    }
};


//Date filter.....................................................................................................


const getDateFilter = (period, startDate, endDate) => {
    const now = new Date();
    let dateFilter = {};

    switch (period) {
        case 'daily':
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            dateFilter = {
                createdOn: {
                    $gte: today,
                    $lte: new Date(now)
                }
            };
            break;
        case 'weekly':
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            dateFilter = { createdOn: { $gte: weekAgo } };
            break;
        case 'monthly':
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            dateFilter = { createdOn: { $gte: monthAgo } };
            break;
        case 'yearly':
            const yearAgo = new Date(now);
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            dateFilter = { createdOn: { $gte: yearAgo } };
            break;
        case 'custom':
            if (startDate && endDate) {
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999);
                dateFilter = {
                    createdOn: {
                        $gte: new Date(startDate),
                        $lte: endDateTime
                    }
                };
            }
            break;
    }
    return dateFilter;
};


//calculate total orders.........................................

const calculateTotals = (orders) => {
    return orders.reduce((acc, order) => ({
        orderAmount: acc.orderAmount + order.totalPrice,
        finalAmount: acc.finalAmount + order.finalAmount,
        discount: acc.discount + (order.discount || 0),
        couponDiscount: acc.couponDiscount + (order.couponApplied ? order.discount || 0 : 0),
        regularDiscount: acc.regularDiscount + (order.couponApplied ? 0 : order.discount || 0),
        count: acc.count + 1,
        cancelledCount: acc.cancelledCount + (order.status === 'Cancelled' ? 1 : 0),
        returnedCount: acc.returnedCount + (order.status === 'Returned' ? 1 : 0)
    }), {
        orderAmount: 0,
        finalAmount: 0,
        discount: 0,
        couponDiscount: 0,
        regularDiscount: 0,
        count: 0,
        cancelledCount: 0,
        returnedCount: 0
    });
};


// loading the salereport page.........................................................

const loadSalesReport = async (req, res) => {
    try {
        const { period = 'monthly', startDate, endDate } = req.query;
        const dateFilter = getDateFilter(period, startDate, endDate);

        const orders = await Order.find({
            ...dateFilter,
            status: { $nin: ['Pending', 'Processing'] } 
        })
        .populate('userId', 'name')
        .populate('orderItems.product', 'name')
        .sort({ createdOn: -1 });

        const totals = calculateTotals(orders);

        const ordersByStatus = orders.reduce((acc, order) => {
            acc[order.status] = (acc[order.status] || 0) + 1;
            return acc;
        }, {});

        res.render('salesReport', {
            orders,
            totals,
            period,
            startDate,
            endDate,
            ordersByStatus,
            title: 'Sales Report'
        });

    } catch (error) {
        console.error('Error in loadSalesReport:', error);
        res.status(500).render('error', { 
            message: 'Error generating sales report',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};


//downloading the sales report ...................................

const downloadSalesReport = async (req, res) => {
    try {
        const { format, period, startDate, endDate } = req.query;
        const dateFilter = getDateFilter(period, startDate, endDate);

        const orders = await Order.find({
            ...dateFilter,
            status: { $nin: ['Pending', 'Processing'] }
        })
        .populate('userId', 'name')
        .populate('orderItems.product', 'name')
        .sort({ createdOn: -1 });

        const totals = calculateTotals(orders);

        if (format === 'pdf') {
            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
            
            doc.pipe(res);
            
            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();
            
            doc.fontSize(14).text('Summary', { underline: true });
            doc.fontSize(12)
                .text(`Report Period: ${period.charAt(0).toUpperCase() + period.slice(1)}`)
                .text(`Total Orders: ${totals.count}`)
                .text(`Total Amount: ₹${totals.orderAmount.toFixed(2)}`)
                .text(`Regular Discounts: ₹${totals.regularDiscount.toFixed(2)}`)
                .text(`Coupon Discounts: ₹${totals.couponDiscount.toFixed(2)}`)
                .text(`Final Amount: ₹${totals.finalAmount.toFixed(2)}`)
                .text(`Cancelled Orders: ${totals.cancelledCount}`)
                .text(`Returned Orders: ${totals.returnedCount}`);
            
            doc.moveDown();

            doc.fontSize(14).text('Order Details', { underline: true });
            doc.moveDown();

            const startX = 50;
            const columnWidth = 85;
            doc.fontSize(10);
            
            ['Order ID', 'Date', 'Customer', 'Items', 'Amount', 'Discount', 'Final', 'Status'].forEach((header, i) => {
                doc.text(header, startX + (i * columnWidth), doc.y, { width: columnWidth, align: 'left' });
            });

            doc.moveDown();

            orders.forEach(order => {
                const y = doc.y;
                if (y > 700) { 
                    doc.addPage();
                    doc.fontSize(10);
                }

                const date = new Date(order.createdOn).toLocaleDateString();
                const itemsCount = order.orderItems.length;

                doc.text(order.orderId.substring(0, 8), startX, doc.y, { width: columnWidth })
                   .text(date, startX + columnWidth, doc.y - 12, { width: columnWidth })
                   .text(order.userId?.name || 'N/A', startX + (columnWidth * 2), doc.y - 12, { width: columnWidth })
                   .text(itemsCount.toString(), startX + (columnWidth * 3), doc.y - 12, { width: columnWidth })
                   .text(`₹${order.totalPrice.toFixed(2)}`, startX + (columnWidth * 4), doc.y - 12, { width: columnWidth })
                   .text(`₹${(order.discount || 0).toFixed(2)}`, startX + (columnWidth * 5), doc.y - 12, { width: columnWidth })
                   .text(`₹${order.finalAmount.toFixed(2)}`, startX + (columnWidth * 6), doc.y - 12, { width: columnWidth })
                   .text(order.status, startX + (columnWidth * 7), doc.y - 12, { width: columnWidth });

                doc.moveDown();
            });

            doc.end();

        } else if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            const headerStyle = {
                font: { bold: true },
                fill: {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE0E0E0' }
                }
            };

            worksheet.columns = [
                { header: 'Order ID', key: 'orderId', width: 20 },
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Customer', key: 'customer', width: 20 },
                { header: 'Items', key: 'items', width: 40 },
                { header: 'Amount', key: 'amount', width: 15 },
                { header: 'Discount', key: 'discount', width: 15 },
                { header: 'Final Amount', key: 'final', width: 15 },
                { header: 'Status', key: 'status', width: 15 }
            ];

            worksheet.getRow(1).eachCell(cell => {
                cell.style = headerStyle;
            });

            orders.forEach(order => {
                const itemsList = order.orderItems
                    .map(item => `${item.product.name} (${item.quantity})`)
                    .join(', ');

                worksheet.addRow({
                    orderId: order.orderId,
                    date: new Date(order.createdOn).toLocaleDateString(),
                    customer: order.userId?.name || 'N/A',
                    items: itemsList,
                    amount: order.totalPrice,
                    discount: order.discount || 0,
                    final: order.finalAmount,
                    status: order.status
                });
            });

            worksheet.addRow([]);
            worksheet.addRow(['Summary']);
            worksheet.addRow(['Total Orders', totals.count]);
            worksheet.addRow(['Total Amount', totals.orderAmount]);
            worksheet.addRow(['Regular Discounts', totals.regularDiscount]);
            worksheet.addRow(['Coupon Discounts', totals.couponDiscount]);
            worksheet.addRow(['Final Amount', totals.finalAmount]);
            worksheet.addRow(['Cancelled Orders', totals.cancelledCount]);
            worksheet.addRow(['Returned Orders', totals.returnedCount]);

            worksheet.getColumn('amount').numFmt = '₹#,##0.00';
            worksheet.getColumn('discount').numFmt = '₹#,##0.00';
            worksheet.getColumn('final').numFmt = '₹#,##0.00';

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

            await workbook.xlsx.write(res);
        }

    } catch (error) {
        console.error('Error in downloadReport:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};



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