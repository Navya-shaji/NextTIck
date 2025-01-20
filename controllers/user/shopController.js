const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");
const Wishlist = require("../../models/wishlistSchema");

//for loading the shopping page.........................................................................................................

const loadshoppingPage = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findById(user);
    const categories = await Category.find({ isListed: true });
    const categoryIds = categories.map((category) => category._id);
    const page = parseInt(req.query.page) || 1;
    const limit = 6; 
    const skip = (page - 1) * limit;

    let query = {
      isBlocked: false,
      category: { $in: categoryIds },
    };

    let sort = { createdOn: -1 }; 

    const sortOption = req.query.sort;
    if (sortOption) {
      switch (sortOption) {
        case 'popularity':
          sort = { quantity: -1 }; 
          break;
        case 'price_asc':
          sort = { regularPrice: 1 }; 
          break;
        case 'price_desc':
          sort = { regularPrice: -1 }; 
          break;
        case 'rating':
          sort = { averageRating: -1 };
          break;
        case 'newest':
        default:
          sort = { createdOn: -1 };
      }
    }

    if (req.query.category) {
      query.category = req.query.category;
    }
    if (req.query.brand) {
      query.brand = req.query.brand;
    }
    if (req.query.minPrice) {
      query.regularPrice = query.regularPrice || {};
      query.regularPrice.$gte = parseFloat(req.query.minPrice);
    }
    if (req.query.maxPrice) {
      query.regularPrice = query.regularPrice || {};
      query.regularPrice.$lte = parseFloat(req.query.maxPrice);
    }
    if (req.query.inStock === 'true') {
      query.quantity = { $gt: 0 };
    }

    if (req.query.query) {
      query.$or = [
        { productName: { $regex: req.query.query, $options: "i" } },
        { 'category.name': { $regex: req.query.query, $options: "i" } }
      ];
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(query)
      .collation({ locale: "en", strength: 2 })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('category')
      .populate('brand');

    let wishlistItems = [];
    if (user) {
      const wishlist = await Wishlist.findOne({ userId: user });
      if (wishlist) {
        wishlistItems = wishlist.products.map(item => item.productId.toString());
      }
    }

    const brands = await Brand.find({ isBlocked: false });
    
    res.render("shop", {
      user: userData,
      products,
      categories,
      brands,
      totalProducts,
      currentPage: page,
      totalPages,
      query: req.query,
      wishlistItems
    });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
};

//for serching the products .........................................................................................................

const searchProducts = async (req, res) => {
  try {
    const searchTerm = req.query.query || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { productName: { $regex: searchTerm, $options: "i" } }
        
      ],
      isBlocked: false,
      quantity: { $gt: 0 },
    };

    const products = await Product.find(query)
      .collation({ locale: "en", strength: 2 }) 
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });

    res.render("shop", {
      products,
      categories,
      brands,
      totalProducts,
      currentPage: page,
      totalPages,
      searchTerm,
      query: req.query,
    });
  } catch (error) {
    console.error("Error searching products:", error);
    res.status(500).render("error", { message: "An error occurred while searching for products." });
  }
};



module.exports = {
  loadshoppingPage,
  searchProducts,
};