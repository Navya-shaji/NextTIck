const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");

// Get Cart...........................

const getCart = async (req, res) => {
  try {
    const userId = req.session.user;
   

    const user = await User.findById(userId);

    const cartItems = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      select: "productName productImage price quantity", 
      model: "Product",
    });
    if (!cartItems) {
      return res.render("cart", {
        cart: null,
        products: [],
        totalAmount: 0,
        user: user,
      });
    }

    const validItems = cartItems.items
      .filter((item) => item.productId != null)
      .map((item) => ({
        ...item.toObject(),
        isOutOfStock: item.productId.quantity < 1,
        availableStock: item.productId.quantity,
        maxAllowedQuantity: Math.min(5, item.productId.quantity),
      }));

    const totalAmount = validItems.reduce(
      (sum, item) => (item.status === "placed" ? sum + item.totalPrice : sum),
      0
    );

    res.render("cart", {
      cart: cartItems,
      products: validItems,
      totalAmount,
      user: user,
    });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).render("error", {
      message: "Failed to load cart",
    });
  }
};


// Add to Cart.....................................................

const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity = 1 } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to add to cart",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Product is out of stock",
      });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );

    if (existingItem) {
      const newQuantity = parseInt(existingItem.quantity) + parseInt(quantity);

      if (newQuantity > 5) {
        return res.status(400).json({
          success: false,
          message: "Maximum 5 items allowed per product",
        });
      }

      if (newQuantity > product.quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.quantity} items available in stock`,
        });
      }

      existingItem.quantity = newQuantity;
      existingItem.totalPrice = newQuantity * parseFloat(product.salesPrice);
    } else {
      if (quantity > product.quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.quantity} items available in stock`,
        });
      }

      cart.items.push({
        productId,
        quantity,
        price: product.salesPrice.toString(),
        totalPrice: quantity * parseFloat(product.salesPrice),
        status: "placed", 
      });
    }

    await cart.save();

    res.json({
      success: true,
      message: "Product added to cart successfully",
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add product to cart",
    });
  }
};


//quantity updation..........................................

const updateQuantity = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity } = req.body;

    if (quantity < 1 || quantity > 5) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be between 1 and 5",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (quantity > product.quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.quantity} items available in stock`,
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const cartItem = cart.items.find(
      (item) =>
        item.productId.toString() === productId  );

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    cartItem.quantity = quantity;
    cartItem.totalPrice = quantity * parseFloat(cartItem.price);

    await cart.save();

    const cartTotal = cart.items.reduce(
      (total, item) =>
        item.status === "placed" ? total + item.totalPrice : total,
      0
    );

    res.status(200).json({
      success: true,
      totalPrice: cartItem.totalPrice,
      cartTotal,
      message: "Cart updated successfully",
    });
  } catch (error) {
    console.error("Update quantity error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update quantity",
    });
  }
};


//products  removing from the cart........................................................


const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === productId && item.status === "placed"
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    res.json({
      success: true,
      message: "Item removed successfully",
    });
  } catch (error) {
    console.error("Remove from cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove item",
    });
  }
};



module.exports = {
  getCart,
  addToCart,
  updateQuantity,
  removeFromCart,
};
