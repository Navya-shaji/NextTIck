const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const Brand = require('../../models/brandSchema');

const loadDashboard = async (req, res) => {
    try {
        // Get total users (excluding admin)
        const totalUsers = await User.countDocuments({ isAdmin: { $ne: true } });

        // Get total products (only active and available)
        const totalProducts = await Product.countDocuments({ 
            isBlocked: false,
            status: 'Available'
        });

        // Get total orders and revenue
        const orders = await Order.find({ 
            paymentStatus: 'Completed', 
            status: { $nin: ['Cancelled', 'Returned'] }
        });
        
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((acc, order) => acc + Number(order.finalAmount || 0), 0);

        // Get current year for initial chart data
        const currentYear = new Date().getFullYear();

        // Get initial top 10 data
        const [topProducts, topCategories, topBrands] = await Promise.all([
            getTopProducts(),
            getTopCategories(),
            getTopBrands()
        ]);

     

        // Get monthly data for initial chart
        const monthlyData = await Order.aggregate([
            {
                $match: {
                    paymentStatus: 'Completed',
                    status: { $nin: ['Cancelled', 'Returned'] },
                    createdOn: {
                        $gte: new Date(currentYear, 0, 1),
                        $lt: new Date(currentYear + 1, 0, 1)
                    }
                }
            },
            {
                $group: {
                    _id: { $month: '$createdOn' },
                    total: { $sum: { $toDouble: '$finalAmount' } }
                }
            },
            { $sort: { '_id': 1 } }
        ]);

        // Format monthly data
        const months = Array(12).fill(0);
        monthlyData.forEach(item => {
            months[item._id - 1] = item.total;
        });

        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        res.render('dashboard', {
            admin: req.session.admin,
            totalUsers,
            totalProducts,
            totalOrders,
            totalRevenue,
            topProducts,
            topCategories,
            topBrands,
            initialSalesData: {
                labels,
                data: months
            }
        });

    } catch (error) {
        console.error('Error in loadDashboard:', error);
        res.status(500).render('admin/error', { message: 'Error loading dashboard', admin: req.session.admin });
    }
};

// Helper function to get top products
async function getTopProducts() {
    try {
        const result = await Order.aggregate([
            { 
                $match: { 
                    paymentStatus: 'Completed',
                    status: { $nin: ['Cancelled', 'Returned'] }
                }
            },
            { $unwind: '$orderItems' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderItems.product',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            { $unwind: '$productInfo' },
            {
                $match: {
                    'productInfo.isBlocked': false,
                    'productInfo.status': 'Available'
                }
            },
            {
                $group: {
                    _id: '$orderItems.product',
                    name: { $first: '$productInfo.productName' },
                    count: { $sum: '$orderItems.quantity' },
                    revenue: { 
                        $sum: { 
                            $multiply: [
                                { $toDouble: '$orderItems.price' }, 
                                '$orderItems.quantity'
                            ] 
                        } 
                    }
                }
            },
            { $sort: { revenue: -1 } },
            { $limit: 10 }
        ]);
     
        return result;
    } catch (error) {
        
        return [];
    }
}

// Helper function to get top categories
async function getTopCategories() {
    try {
        const result = await Order.aggregate([
            { 
                $match: { 
                    paymentStatus: 'Completed',
                    status: { $nin: ['Cancelled', 'Returned'] }
                }
            },
            { $unwind: '$orderItems' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderItems.product',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            { $unwind: '$productInfo' },
            {
                $match: {
                    'productInfo.isBlocked': false,
                    'productInfo.status': 'Available'
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'productInfo.category',
                    foreignField: '_id',
                    as: 'categoryInfo'
                }
            },
            { $unwind: '$categoryInfo' },
            {
                $match: {
                    'categoryInfo.isListed': true
                }
            },
            {
                $group: {
                    _id: '$productInfo.category',
                    name: { $first: '$categoryInfo.name' },
                    count: { $sum: '$orderItems.quantity' },
                    revenue: { 
                        $sum: { 
                            $multiply: [
                                { $toDouble: '$orderItems.price' }, 
                                '$orderItems.quantity'
                            ] 
                        } 
                    },
                    uniqueProducts: { $addToSet: '$orderItems.product' }
                }
            },
            {
                $addFields: {
                    uniqueProductCount: { $size: '$uniqueProducts' }
                }
            },
            { $sort: { revenue: -1 } },
            { $limit: 10 }
        ]);
     
        return result;
    } catch (error) {
        console.error('Error in getTopCategories:', error);
        return [];
    }
}

// Helper function to get top brands
async function getTopBrands() {
    try {
        // First, get all brands that are not blocked
        const brands = await Brand.find({ isBlocked: false });

        // Get sales data for each brand
        const brandSalesPromises = brands.map(async (brand) => {
            // Get all products of this brand
            const products = await Product.find({ 
                brand: brand._id,
                isBlocked: false
            });
            console.log(`Products for brand ${brand.brandName}:`, products.length);

            // Get all orders containing these products
            const productIds = products.map(p => p._id);
            const orders = await Order.aggregate([
                {
                    $match: {
                        paymentStatus: 'Completed',
                        status: { $nin: ['Cancelled', 'Returned'] }
                    }
                },
                { $unwind: '$orderItems' },
                {
                    $match: {
                        'orderItems.product': { $in: productIds }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: {
                            $sum: {
                                $multiply: ['$orderItems.price', '$orderItems.quantity']
                            }
                        },
                        totalQuantity: { $sum: '$orderItems.quantity' },
                        uniqueOrders: { $addToSet: '$_id' }
                    }
                }
            ]);

            const salesData = orders[0] || {
                totalRevenue: 0,
                totalQuantity: 0,
                uniqueOrders: []
            };

            return {
                _id: brand._id,
                name: brand.brandName,
                count: salesData.totalQuantity || 0,
                revenue: salesData.totalRevenue || 0,
                uniqueProductCount: products.length,
                totalOrderCount: (salesData.uniqueOrders || []).length,
                averageOrderValue: salesData.uniqueOrders?.length ? 
                    (salesData.totalRevenue / salesData.uniqueOrders.length) : 0,
                averageRevenuePerProduct: products.length ? 
                    (salesData.totalRevenue / products.length) : 0
            };
        });

        const brandSales = await Promise.all(brandSalesPromises);
        
        // Sort by revenue and get top 10
        const topBrands = brandSales
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10)
            .map(brand => ({
                ...brand,
                revenue: Number(brand.revenue || 0),
                count: Number(brand.count || 0),
                uniqueProductCount: Number(brand.uniqueProductCount || 0),
                totalOrderCount: Number(brand.totalOrderCount || 0),
                averageOrderValue: Number(brand.averageOrderValue || 0).toFixed(2),
                averageRevenuePerProduct: Number(brand.averageRevenuePerProduct || 0).toFixed(2)
            }));

        console.log('Top Brands Result:', topBrands);
        return topBrands;
    } catch (error) {
        console.error('Error in getTopBrands:', error);
        return [];
    }
}

// Get sales data based on filter
const getSalesData = async (req, res) => {
    try {
        const { filter, year } = req.query;
        const startYear = parseInt(year);
        let labels = [];
        let data = [];
        
        switch(filter) {
            case 'yearly':
                // Get last 5 years data
                for (let i = 4; i >= 0; i--) {
                    const yearData = await Order.aggregate([
                        {
                            $match: {
                                createdOn: {
                                    $gte: new Date(startYear - i, 0, 1),
                                    $lt: new Date(startYear - i + 1, 0, 1)
                                },
                                paymentStatus: 'Completed',
                                status: { $nin: ['Cancelled', 'Returned'] }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                total: { $sum: '$finalAmount' }
                            }
                        }
                    ]);
                    labels.push(startYear - i);
                    data.push(yearData[0]?.total || 0);
                }
                break;

            case 'monthly':
                // Get monthly data for selected year
                const monthlyData = await Order.aggregate([
                    {
                        $match: {
                            createdOn: {
                                $gte: new Date(startYear, 0, 1),
                                $lt: new Date(startYear + 1, 0, 1)
                            },
                            paymentStatus: 'Completed',
                            status: { $nin: ['Cancelled', 'Returned'] }
                        }
                    },
                    {
                        $group: {
                            _id: { $month: '$createdOn' },
                            total: { $sum: '$finalAmount' }
                        }
                    },
                    { $sort: { '_id': 1 } }
                ]);

                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                labels = months;
                data = Array(12).fill(0);
                monthlyData.forEach(item => {
                    data[item._id - 1] = item.total;
                });
                break;

            case 'weekly':
                // Get weekly data for current month
                const weeksInMonth = getWeeksInMonth(startYear, new Date().getMonth());
                for (let week = 0; week < weeksInMonth; week++) {
                    labels.push(`Week ${week + 1}`);
                    const weekData = await Order.aggregate([
                        {
                            $match: {
                                createdOn: {
                                    $gte: new Date(startYear, new Date().getMonth(), week * 7 + 1),
                                    $lt: new Date(startYear, new Date().getMonth(), (week + 1) * 7 + 1)
                                },
                                paymentStatus: 'Completed',
                                status: { $nin: ['Cancelled', 'Returned'] }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                total: { $sum: '$finalAmount' }
                            }
                        }
                    ]);
                    data.push(weekData[0]?.total || 0);
                }
                break;

            case 'daily':
                // Get daily data for current month
                const daysInMonth = new Date(startYear, new Date().getMonth() + 1, 0).getDate();
                for (let day = 1; day <= daysInMonth; day++) {
                    labels.push(day.toString());
                    const dayData = await Order.aggregate([
                        {
                            $match: {
                                createdOn: {
                                    $gte: new Date(startYear, new Date().getMonth(), day),
                                    $lt: new Date(startYear, new Date().getMonth(), day + 1)
                                },
                                paymentStatus: 'Completed',
                                status: { $nin: ['Cancelled', 'Returned'] }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                total: { $sum: '$finalAmount' }
                            }
                        }
                    ]);
                    data.push(dayData[0]?.total || 0);
                }
                break;
        }

        res.json({ labels, data });
    } catch (error) {
        console.error('Error getting sales data:', error);
        res.status(500).json({ error: 'Error getting sales data' });
    }
};

// Helper function to get number of weeks in a month
function getWeeksInMonth(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return Math.ceil((lastDay.getDate() - firstDay.getDate() + 1) / 7);
}

module.exports = {
    loadDashboard,
    getSalesData,
    getTopProducts,
    getTopCategories,
    getTopBrands
};