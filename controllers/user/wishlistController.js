const Wishlist = require("../../models/wishlistSchema"); 
const Product = require("../../models/productSchema");  
const User = require("../../models/userSchema");        



const loadWishlist = async (req, res) => {
  try {
      const userId = req.user._id; 
      const wishlist = await Wishlist.findOne({ userId })
          .populate({
              path: 'products.productId',
              model: 'Product', 
              populate: {
                  path: 'category', 
                  model: 'Category' 
              }
          })
          .lean(); 

      res.render('wishlist', { wishlist: wishlist ? wishlist.products : [] });
  } catch (error) {
      console.error('Error loading wishlist:', error);
      res.status(500).send('Internal Server Error');
  }
};


const addToWishlist = async (req, res) => {
    try {
      const productId = req.body.productId;
      const userId = req.session.user._id;
  
      if (!userId) {
        return res.status(401).json({ status: false, message: "User not logged in" });
      }
  
      let wishlist = await Wishlist.findOne({ userId });
  
      if (!wishlist) {
        wishlist = new Wishlist({ userId, products: [] });
      }
  
      const isProductInWishlist = wishlist.products.some(item => item.productId.toString() === productId);
  
      if (isProductInWishlist) {
        return res.status(200).json({ status: false, message: "Product already in wishlist" });
      }
  
      wishlist.products.push({ productId });
      await wishlist.save();
  
      return res.status(200).json({ status: true, message: "Product added to wishlist" });
    } catch (error) {
      console.error('Error in addToWishlist:', error);
      return res.status(500).json({ status: false, message: "Server error" });
    }
  };


 const removeFromWishlist = async (req, res) => {
  try {
    const productId = req.params.id; // Extract productId from route params
    const userId = req.session.user._id; // Extract userId from session
    console.log('Product ID:', productId, 'User ID:', userId);

    // Validate that productId is provided
    if (!productId) {
      return res.status(400).json({ status: false, message: 'Product ID is required' });
    }

    // Update the wishlist by removing the product
    const result = await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId } } }
    );

    // Check if any product was removed
    if (result.modifiedCount > 0) {
      return res.status(200).json({ status: true, message: 'Product removed from wishlist' });
    } else {
      return res.status(404).json({ status: false, message: 'Product not found in wishlist' });
    }
  } catch (error) {
    console.error('Error in removeFromWishlist:', error);
    res.status(500).json({ status: false, message: 'Internal server error' });
  }
};

  
  
module.exports = {
    loadWishlist,
    addToWishlist,
    removeFromWishlist

};
