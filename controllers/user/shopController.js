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

    const products = await Product.find({
      isBlocked: false,
      category: { $in: categoryIds },
      quantity: { $gt: 0 },
    })
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);

    const totalProducts = await Product.countDocuments({
      isBlocked: false,
      category: { $in: categoryIds },
      quantity: { $gt: 0 },
    });

    const totalPages = Math.ceil(totalProducts / limit);
    const brands = await Brand.find({ isBlocked: false });

    const categoriesWithIds = categories.map((category) => ({
      _id: category._id,
      name: category.name,
    }));

    res.render("shop", {
      user: userData,
      products,
      category: categoriesWithIds,
      brand: brands,
      totalProducts,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error("Error loading shopping page:", error);
    res.redirect("/pageNotFound");
  }
};

const filterProduct = async (req, res) => {
  try {
    const user = req.session.user;
    const category = req.query.category;
    const brand = req.query.brand;

    const findCategory = category ? await Category.findById(category) : null;
    const findBrand = brand ? await Brand.findById(brand) : null;

    const query = {
      isBlocked: false,
      quantity: { $gt: 0 },
    };

    if (findCategory) {
      query.category = findCategory._id;
    }

    if (findBrand) {
      query.brand = findBrand.brandName;
    }

    const findProducts = await Product.find(query).sort({ createdOn: -1 });
    const categories = await Category.find({ isListed: true });

    const itemsPerPage = 6;
    const currentPage = parseInt(req.query.page) || 1;
    const totalPages = Math.ceil(findProducts.length / itemsPerPage);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentProducts = findProducts.slice(startIndex, startIndex + itemsPerPage);

    let userData = null;
    if (user) {
      userData = await User.findById(user);
      if (userData) {
        const searchEntry = {
          category: findCategory ? findCategory._id : null,
          brand: findBrand ? findBrand.brandName : null,
          searchedOn: new Date(),
        };
        userData.searchHistory.push(searchEntry);
        await userData.save();
      }
    }

    const categoriesWithIds = categories.map((category) => ({
      _id: category._id,
      name: category.name,
    }));

    res.render("shop", {
      user: userData,
      products: currentProducts,
      category: categoriesWithIds,
      brand: await Brand.find({ isBlocked: false }),
      totalPages,
      currentPage,
      selectedCategory: category || null,
      selectedBrand: brand || null,
    });
  } catch (error) {
    console.error("Error filtering products:", error);
    res.redirect("/pageNotFound");
  }
};

module.exports = {
  loadshoppingPage,
  filterProduct,
};
