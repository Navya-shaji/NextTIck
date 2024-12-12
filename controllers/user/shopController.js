const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");
const loadshoppingPage = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findById(user);
    const categories = await Category.find({ isListed: true });
    const categoryIds = categories.map((category) => category._id);

    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    // Base query
    let query = {
      isBlocked: false,
      category: { $in: categoryIds },
    };

    // Default sort
    let sort = { createdOn: -1 };

    // Advanced sorting
    const sortOption = req.query.sort;
    if (sortOption) {
      switch (sortOption) {
        case 'popularity':
          sort = { salesCount: -1 }; // Assuming you have a salesCount field
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
          sort = { createdOn: -1 };
          break;
        case 'name_asc':
          sort = { productName: 1 };
          break;
        case 'name_desc':
          sort = { productName: -1 };
          break;
        default:
          sort = { createdOn: -1 };
      }
    }

    // Advanced filtering
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

    // Search functionality
    if (req.query.query) {
      query.$or = [
        { productName: { $regex: req.query.query, $options: "i" } },
        { description: { $regex: req.query.query, $options: "i" } }
      ];
    }

    // Fetch products with aggregation for proper price sorting
    const products = await Product.find(query)
      .collation({ locale: "en", strength: 2 })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('category')
      .populate('brand');

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    // Fetch brands
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
    });
  } catch (error) {
    console.error("Error loading shopping page:", error);
    res.status(500).render("error", { message: "An error occurred while loading the shopping page." });
  }
};

const searchProducts = async (req, res) => {
  try {
    const searchTerm = req.query.query || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { productName: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
      ],
      isBlocked: false,
      quantity: { $gt: 0 },
    };

    const products = await Product.find(query)
      .collation({ locale: "en", strength: 2 }) // Ensures case-insensitive sorting
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
