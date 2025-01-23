const User = require("../../models/userSchema");
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const Order = require("../../models/orderSchema");
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { Table } = require('pdfkit-table');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');


const pageerror = async (req, res) => {
    res.render("admin-error")
}

//loadig login page............................................................................................

const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect("/admin/dashboard")
    }
    res.render("adminLogin", { message: null })
}


//login..........................................................................................................

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true })
        if (admin) {
            const passwordMatch = bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = true
                return res.redirect("/admin")
            } else {
                return res.redirect("/login")
            }
        } else {
            return res.redirect("/login")
        }
    } catch (error) {
        return res.redirect("/pageerror")

    }
}


//loading dashboard................................................................................................

// finding the top 10 products, categories and brands using the aggregation..............................................................

const getTopSellingData = async () => {
    try {
        const topProducts = await Order.aggregate([
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.id",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $group: {
                    _id: "$orderedItems.id",
                    totalQuantity: { $sum: "$orderedItems.quantity" },
                    name: { $first: "$orderedItems.name" },
                    category: { $first: "$productDetails.category" }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 } 
        ]);

        const topCategories = await Order.aggregate([
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.id",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $lookup: {
                    from: "categories",
                    localField: "productDetails.category",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            { $unwind: "$categoryDetails" },
            {
                $group: {
                    _id: "$categoryDetails._id",
                    totalQuantity: { $sum: "$orderedItems.quantity" },
                    categoryName: { $first: "$categoryDetails.name" }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 } 
        ]);

        const topBrands = await Order.aggregate([
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.id",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $group: {
                    _id: "$productDetails.brand",
                    totalQuantity: { $sum: "$orderedItems.quantity" },
                    brandName: { $first: "$productDetails.brand" }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 } 
        ]);

        return { topProducts, topCategories, topBrands };
    } catch (error) {
        console.error("Error fetching top-selling data", error);
        return { topProducts: [], topCategories: [], topBrands: [] };
    }
};

// Formats a numeric value to 2 decimal places....................................

const formatCurrency = (amount) => {
    return parseFloat(amount).toFixed(2);
};



// Fetch sales data based on the report type and date range................................................

const getDateRanges = () => {
    const today = new Date();

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(today);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const startOfYear = new Date(today.getFullYear(), 0, 1);

    return {
        startOfWeek,
        endOfWeek,
        startOfMonth,
        startOfYear
    };
};


//loading Dashboard................................................................................................

const loadDashboard = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect("login");
        }

        // Get date ranges for filtering
        const dateRanges = getDateRanges();

        // Get orders and basic stats
        const orders = await Order.find({})
            .populate("userId", "username")
            .sort({ orderDate: -1 })
            .select('orderId userId orderDate totalPrice status paymentMethod')
            .limit(10);

        const stats = await Order.aggregate([
            {
                $group: {
                    _id: null,
                    totalSalesCount: { $sum: 1 },
                    totalOrderAmount: { $sum: { $toDouble: { $ifNull: ["$finalAmount", 0] } } },
                    totalDiscount: { $sum: { $toDouble: { $ifNull: ["$discount", 0] } } }
                }
            }
        ]);

        const { totalSalesCount = 0, totalOrderAmount = 0, totalDiscount = 0 } = stats[0] || {};

        // Daily Sales Data (Last 7 days)
        const dailySales = await Order.aggregate([
            {
                $match: {
                    createdOn: {
                        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    },
                    status: { $ne: "Cancelled" }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } },
                    sales: { $sum: { $toDouble: "$finalAmount" } },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // Weekly Sales Data
        const weeklySales = await Order.aggregate([
            {
                $match: {
                    createdOn: {
                        $gte: dateRanges.startOfWeek,
                        $lte: dateRanges.endOfWeek
                    },
                    status: { $ne: "Cancelled" }
                }
            },
            {
                $group: {
                    _id: { $dayOfWeek: "$createdOn" },
                    sales: { $sum: { $toDouble: "$finalAmount" } },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // Monthly Sales Data
        const monthlySales = await Order.aggregate([
            {
                $match: {
                    createdOn: { $gte: dateRanges.startOfYear },
                    status: { $ne: "Cancelled" }
                }
            },
            {
                $group: {
                    _id: { month: { $month: "$createdOn" } },
                    sales: { $sum: { $toDouble: "$finalAmount" } },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { "_id.month": 1 } }
        ]);

        // Yearly Sales Data
        const yearlySales = await Order.aggregate([
            {
                $match: { status: { $ne: "Cancelled" } }
            },
            {
                $group: {
                    _id: { $year: "$createdOn" },
                    sales: { $sum: { $toDouble: "$finalAmount" } },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { "_id": -1 } },
            { $limit: 5 }
        ]);

        // Get top selling products with revenue
        const topProducts = await Order.aggregate([
            { 
                $match: { 
                    status: { $ne: "Cancelled" }
                }
            },
            { $unwind: "$orderItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderItems.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $group: {
                    _id: "$orderItems.productId",
                    name: { $first: "$productDetails.name" },
                    image: { $first: { $arrayElemAt: ["$productDetails.images", 0] } },
                    category: { $first: "$productDetails.category" },
                    brand: { $first: "$productDetails.brand" },
                    totalSalesCount: { $sum: "$orderItems.quantity" },
                    totalRevenue: { 
                        $sum: { 
                            $multiply: ["$orderItems.quantity", "$orderItems.price"]
                        } 
                    }
                }
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "category",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            {
                $lookup: {
                    from: "brands",
                    localField: "brand",
                    foreignField: "_id",
                    as: "brandDetails"
                }
            },
            {
                $addFields: {
                    categoryName: { $arrayElemAt: ["$categoryDetails.name", 0] },
                    brandName: { $arrayElemAt: ["$brandDetails.name", 0] }
                }
            },
            { $sort: { totalSalesCount: -1 } },
            { $limit: 10 }
        ]);

        // Get best selling brands with proper aggregation
        const bestSellingBrands = await Order.aggregate([
            { $unwind: "$orderItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderItems.productId",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
            {
                $lookup: {
                    from: "brands",
                    localField: "product.brand",
                    foreignField: "_id",
                    as: "brandInfo"
                }
            },
            { $unwind: "$brandInfo" },
            {
                $group: {
                    _id: "$brandInfo._id",
                    name: { $first: "$brandInfo.name" },
                    totalSalesCount: { $sum: "$orderItems.quantity" },
                    totalRevenue: { 
                        $sum: { 
                            $multiply: ["$orderItems.quantity", "$orderItems.price"] 
                        } 
                    },
                    productCount: { $addToSet: "$product._id" }
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    totalSalesCount: 1,
                    totalRevenue: 1,
                    productCount: { $size: "$productCount" }
                }
            },
            { $sort: { totalSalesCount: -1 } },
            { $limit: 10 }
        ]);

        // Get top selling categories
        const topCategories = await Order.aggregate([
            { 
                $match: { 
                    status: { $ne: "Cancelled" }
                }
            },
            { $unwind: "$orderItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderItems.productId",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
            {
                $lookup: {
                    from: "categories",
                    localField: "product.category",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            { $unwind: "$categoryDetails" },
            {
                $group: {
                    _id: "$product.category",
                    name: { $first: "$categoryDetails.name" },
                    totalSalesCount: { $sum: "$orderItems.quantity" },
                    totalRevenue: {
                        $sum: {
                            $multiply: ["$orderItems.quantity", "$orderItems.price"]
                        }
                    },
                    products: {
                        $addToSet: "$product._id"
                    }
                }
            },
            {
                $addFields: {
                    productCount: { $size: "$products" }
                }
            },
            { $sort: { totalSalesCount: -1 } },
            { $limit: 10 }
        ]);

        // Log the results for debugging
        console.log('Top Products:', JSON.stringify(topProducts, null, 2));
        console.log('Top Categories:', JSON.stringify(topCategories, null, 2));
        console.log('Top Brands:', JSON.stringify(bestSellingBrands, null, 2));

        // Prepare chart data
        const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        // Get last 7 days
        const last7Days = Array.from({length: 7}, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        const daily = {
            labels: last7Days.map(date => new Date(date).toLocaleDateString('en-US', { weekday: 'short' })),
            data: last7Days.map(date => {
                const dayData = dailySales.find(item => item._id === date);
                return formatCurrency(dayData ? dayData.sales : 0);
            })
        };

        const weekly = {
            labels: daysOfWeek,
            data: Array(7).fill(0).map((_, index) => {
                const dayData = weeklySales.find(item => item._id === index + 1);
                return formatCurrency(dayData ? dayData.sales : 0);
            })
        };

        const monthly = {
            labels: monthNames,
            data: Array(12).fill(0).map((_, index) => {
                const monthData = monthlySales.find(item => item._id.month === index + 1);
                return formatCurrency(monthData ? monthData.sales : 0);
            })
        };

        const yearly = {
            labels: yearlySales.map(item => item._id.toString()),
            data: yearlySales.map(item => formatCurrency(item.sales))
        };

        // Get order status stats
        const orderStatusStats = await Order.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);

        const totalOrders = orderStatusStats.reduce((acc, curr) => acc + curr.count, 0);
        const successfulOrders = orderStatusStats.find(stat => stat._id === "Delivered")?.count || 0;
        const orderSuccessRate = totalOrders ? ((successfulOrders / totalOrders) * 100).toFixed(2) : 0;

        return res.render("dashboard", {
            orders,
            totalSalesCount,
            totalOrderAmount,
            totalDiscount,
            orderSuccessRate,
            bestSellingProducts: topProducts,
            bestSellingCategories: topCategories,
            bestSellingBrands: bestSellingBrands,
            daily,
            weekly,
            monthly,
            yearly,
            paymentStats: orderStatusStats
        });

    } catch (error) {
        console.error("Dashboard error:", error);
        return res.redirect("/admin/admin-error");
    }
};



//logout...........................................................................................................

const logout = async (req, res) => {
    try {
        req.session.destroy(err => {
            if (err) {
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

const calculateTotals = async (orders) => {
    try {
        const totals = {
            count: 0,
            totalAmount: 0,
            finalAmount: 0,
            discount: 0,
            uniqueUsers: new Set(),
            cancelledCount: 0,
            returnedCount: 0,
            deliveredCount: 0,
            pendingCount: 0,
            averageOrderValue: 0
        };

        orders.forEach(order => {
            totals.count++;
            totals.totalAmount += Number(order.totalPrice || 0);
            totals.finalAmount += Number(order.finalAmount || 0);
            totals.discount += Number(order.discount || 0);
            
            if (order.userId) {
                totals.uniqueUsers.add(order.userId.toString());
            }

            // Count orders by status
            switch (order.status) {
                case 'Cancelled':
                    totals.cancelledCount++;
                    break;
                case 'Returned':
                    totals.returnedCount++;
                    break;
                case 'Delivered':
                    totals.deliveredCount++;
                    break;
                case 'Pending':
                    totals.pendingCount++;
                    break;
            }
        });

        // Calculate averages
        totals.averageOrderValue = totals.count ? totals.finalAmount / totals.count : 0;
        
        // Convert Set to count
        totals.uniqueCustomers = totals.uniqueUsers.size;
        delete totals.uniqueUsers;

        // Format numbers
        totals.totalAmount = Number(totals.totalAmount.toFixed(2));
        totals.finalAmount = Number(totals.finalAmount.toFixed(2));
        totals.discount = Number(totals.discount.toFixed(2));
        totals.averageOrderValue = Number(totals.averageOrderValue.toFixed(2));

        return totals;
    } catch (error) {
        console.error('Error in calculateTotals:', error);
        return {
            count: 0,
            totalAmount: 0,
            finalAmount: 0,
            discount: 0,
            uniqueCustomers: 0,
            cancelledCount: 0,
            returnedCount: 0,
            deliveredCount: 0,
            pendingCount: 0,
            averageOrderValue: 0
        };
    }
};


// loading the salereport page.........................................................
// Backend modifications (in the loadSalesReport function)


const loadSalesReport = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        let dateFilter = {};
        const period = req.query.period || 'all';
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;

        dateFilter = getDateFilter(period, startDate, endDate);

        // Get order statistics
        const [
            totalOrdersCount,
            activeRevenueResult,
            totalRevenueResult,
            pendingOrdersCount,
            completedOrdersCount
        ] = await Promise.all([
            Order.countDocuments(dateFilter),
            Order.aggregate([
                {
                    $match: { 
                        ...dateFilter,
                        status: { $nin: ['Cancelled', 'Returned'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$finalAmount' }
                    }
                }
            ]),
            Order.aggregate([
                {
                    $match: dateFilter
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$finalAmount' }
                    }
                }
            ]),
            Order.countDocuments({ ...dateFilter, status: 'Pending' }),
            Order.countDocuments({ ...dateFilter, status: 'Delivered' })
        ]);

        const activeRevenue = activeRevenueResult[0]?.total || 0;
        const totalRevenue = totalRevenueResult[0]?.total || 0;

        const orders = await Order.find(dateFilter)
            .populate('userId', 'name email')
            .populate('orderItems.product')
            .populate('address')
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const processedOrders = orders.map(order => ({
            ...order,
            userName: order.userId ? order.userId.name : 'Unknown User',
            couponDetails: order.couponApplied ? `Coupon: ${order.couponCode} applied.` : 'No coupon applied.',
            offerDetails: order.offerApplied ? order.offerDetails : 'No offer applied.'
        }));

        const totalOrders = await Order.countDocuments(dateFilter);
        const totalPages = Math.ceil(totalOrders / limit);

        // Get additional statistics
        const [
            totalUsers,
            productsSoldResult,
            cancelledOrdersCount,
            returnedOrdersCount
        ] = await Promise.all([
            User.countDocuments({}),
            Order.aggregate([
                {
                    $match: dateFilter
                },
                {
                    $unwind: '$orderItems'
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$orderItems.quantity' }
                    }
                }
            ]),
            Order.countDocuments({ ...dateFilter, status: 'Cancelled' }),
            Order.countDocuments({ ...dateFilter, status: 'Returned' })
        ]);

        const productsSold = productsSoldResult[0]?.total || 0;

        res.render('salesReport', {
            orders: processedOrders,
            currentPage: page,
            totalPages,
            period,
            startDate,
            endDate,
            limit,
            totalOrders: totalOrdersCount,
            activeRevenue,
            totalRevenue,
            pendingOrders: pendingOrdersCount,
            completedOrders: completedOrdersCount,
            totalUsers,
            productsSold,
            cancelledOrders: cancelledOrdersCount,
            returnedOrders: returnedOrdersCount,
            title: 'Sales Report'
        });

    } catch (error) {
        console.error('Error in loadSalesReport:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Add this helper function to handle pagination URLs
const generatePaginationUrl = (currentUrl, newPage) => {
    const url = new URL(currentUrl);
    url.searchParams.set('page', newPage);
    return url.search;
};

//downloading the sales report ...................................

//downloading the sales report ...................................
const downloadSalesReport = async (req, res) => {
    try {
        const { format, period, startDate, endDate } = req.query;
        function convertToIST(inputTime) {
            const date = new Date(inputTime);
            
            const istOffset = 330; // 5 hours and 30 minutes in minutes
            const istTime = new Date(date.getTime() + (istOffset * 60000));
            
            return istTime;
          }
        const dateFilter = getDateFilter(period, convertToIST(startDate), convertToIST(endDate));
        console.log("filter ", dateFilter)
        const orders = await Order.find({
            ...dateFilter,
            status: { $nin: ['Pending', 'Processing'] }
        })
            .populate('userId', 'name')
            .sort({ createdOn: -1 });
        console.log("order", orders)
        const totals =await calculateTotals(orders);
        console.log("totals", totals)
        if (format === 'pdf') {
            const doc = new PDFDocument({ margin: 50 });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');

            doc.pipe(res);

            // Header
            doc.font('Helvetica-Bold')
               .fontSize(24)
               .text('Sales Report', { align: 'center' });
            doc.moveDown(1);

            // Report Period
            doc.fontSize(12)
               .font('Helvetica')
               .text(`Report Period: ${period.charAt(0).toUpperCase() + period.slice(1)}`, { align: 'left' });
            doc.moveDown(1);

            // Summary Section
            doc.font('Helvetica-Bold')
               .fontSize(16)
               .text('Summary', { underline: true });
            doc.moveDown(0.5);

            // Summary Table
            const summaryData = [
                ['Total Orders:', totals.count],
                ['Total Amount:', `₹${totals.totalAmount.toFixed(2)}`],
                ['Final Amount:', `₹${totals.finalAmount.toFixed(2)}`],
                ['Cancelled Orders:', totals.cancelledCount],
                ['Returned Orders:', totals.returnedCount]
            ];

            summaryData.forEach(([label, value]) => {
                doc.font('Helvetica')
                   .fontSize(12)
                   .text(label, { continued: true, width: 150 })
                   .text(value.toString(), { align: 'left' });
            });

            doc.moveDown(2);

            // Order Details Section
            doc.font('Helvetica-Bold')
               .fontSize(16)
               .text('Order Details', { underline: true });
            doc.moveDown(1);

            // Table Headers
            const headers = ['Order ID', 'Date', 'Customer', 'Amount', 'Final', 'Status'];
            const colWidths = [80, 80, 120, 80, 80, 80];
            let startX = 50;
            let currentX = startX;

            // Draw table headers with background
            const headerY = doc.y;
            doc.rect(startX - 5, headerY - 5, 520, 20).fill('#f0f0f0');
            
            headers.forEach((header, i) => {
                doc.font('Helvetica-Bold')
                   .fontSize(10)
                   .fillColor('black')
                   .text(header, currentX, headerY, { width: colWidths[i] });
                currentX += colWidths[i];
            });

            doc.moveDown(0.5);

            // Table Rows
            orders.forEach((order, index) => {
                // Check if we need a new page
                if (doc.y > 700) {
                    doc.addPage();
                    doc.font('Helvetica-Bold')
                       .fontSize(16)
                       .text('Order Details (continued)', { underline: true });
                    doc.moveDown(1);
                    
                    // Repeat headers on new page
                    currentX = startX;
                    const headerY = doc.y;
                    doc.rect(startX - 5, headerY - 5, 520, 20).fill('#f0f0f0');
                    
                    headers.forEach((header, i) => {
                        doc.font('Helvetica-Bold')
                           .fontSize(10)
                           .fillColor('black')
                           .text(header, currentX, headerY, { width: colWidths[i] });
                        currentX += colWidths[i];
                    });
                    doc.moveDown(0.5);
                }

                // Add zebra striping
                if (index % 2 === 0) {
                    doc.rect(startX - 5, doc.y - 2, 520, 15).fill('#f9f9f9');
                }

                currentX = startX;
                const rowY = doc.y;
                
                // Order data
                const date = new Date(order.createdOn).toLocaleDateString();
                const rowData = [
                    order.orderId.substring(0, 8),
                    date,
                    order.userId?.name || 'N/A',
                    `₹${order.totalPrice.toFixed(2)}`,
                    `₹${order.finalAmount.toFixed(2)}`,
                    order.status
                ];

                rowData.forEach((text, i) => {
                    doc.font('Helvetica')
                       .fontSize(10)
                       .fillColor('black')
                       .text(text, currentX, rowY, { width: colWidths[i] });
                    currentX += colWidths[i];
                });

                doc.moveDown(0.5);
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
                { header: 'Amount', key: 'amount', width: 15 },
                { header: 'Final Amount', key: 'final', width: 15 },
                { header: 'Status', key: 'status', width: 15 }
            ];

            worksheet.getRow(1).eachCell(cell => {
                cell.style = headerStyle;
            });

            orders.forEach(order => {
                worksheet.addRow({
                    orderId: order.orderId,
                    date: new Date(order.createdOn).toLocaleDateString(),
                    customer: order.userId?.name || 'N/A',
                    amount: order.totalPrice,
                    final: order.finalAmount,
                    status: order.status
                });
            });

            worksheet.addRow([]);
            worksheet.addRow(['Summary']);
            worksheet.addRow(['Total Orders', totals.count]);
            worksheet.addRow(['Total Amount', totals.orderAmount]);
            worksheet.addRow(['Final Amount', totals.finalAmount]);
            worksheet.addRow(['Cancelled Orders', totals.cancelledCount]);
            worksheet.addRow(['Returned Orders', totals.returnedCount]);

            worksheet.getColumn('amount').numFmt = '₹#,##0.00';
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


module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
    loadSalesReport,
    generateSalesReport,
    downloadSalesReport
}