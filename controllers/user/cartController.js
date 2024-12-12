const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");

// Get Cart
const getCart = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId);

    // Fetch cart with populated product details
    const cartItems = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      select: "productName productImage price quantity", // Added quantity for stock checking
      model: "Product",
    });
    // console.log(cartItems)
    if (!cartItems) {
      return res.render("cart", {
        cart: null,
        products: [],
        totalAmount: 0,
        user: user,
      });
    }

    // Filter valid items and add stock information
    const validItems = cartItems.items
      .filter((item) => item.productId != null)
      .map((item) => ({
        ...item.toObject(),
        isOutOfStock: item.productId.quantity < 1,
        availableStock: item.productId.quantity,
        maxAllowedQuantity: Math.min(5, item.productId.quantity),
      }));

    // Calculate total amount
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
    // console.log(validItems)
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).render("error", {
      message: "Failed to load cart",
    });
  }
};

// Add to Cart
const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity = 1 } = req.body;
    // console.log("req.body", req.body);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to add to cart",
      });
    }
    console.log(1);
    // Find product and check stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }
    console.log(2);
    // Check stock availability
    if (product.quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Product is out of stock",
      });
    }
    console.log(3);
    // Find or create cart
    let cart = await Cart.findOne({ userId });
    console.log(4);
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }
    console.log(5);
    // Check existing item in cart
    const existingItem = cart.items.find(
      (item) =>
        item.productId.toString() === productId && item.status === "placed"
    );

    if (existingItem) {
      // Check quantity limits
      const newQuantity = existingItem.quantity + quantity;

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

      // Update existing item
      existingItem.quantity = newQuantity;
      existingItem.price = product.price.toString();
      existingItem.totalPrice = newQuantity * parseFloat(product.price);
    } else {
    // Add new item
    if (quantity > product.quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.quantity} items available in stock`,
      });
        }
    }
    console.log(6);
    cart.items.push({
      productId,
      quantity,
      price: product.salesPrice,
      totalPrice: quantity * parseFloat(product.salesPrice),
      status: "placed",
    });
    console.log(7);
    await cart.save();

    res.json({
      success: true,
      message: "Product added to cart successfully",
    });
    console.log(8);
    
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add product to cart",
    });
  }
};

// Update Cart Quantity
const updateQuantity = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity } = req.body;
    console.log(req.body);

    // Validate quantity
    if (quantity < 1 || quantity > 5) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be between 1 and 5",
      });
    }

    // Check product stock
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

    // Update cart
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const cartItem = cart.items.find(
      (item) =>
        item.productId.toString() === productId && item.status === "placed"
    );

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    cartItem.quantity = quantity;
    cartItem.totalPrice = quantity * parseFloat(cartItem.price);

    await cart.save();

    // Calculate new totals
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

// Remove from Cart
const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;
    console.log(req.body);

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Find item index
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

    // Remove item
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
