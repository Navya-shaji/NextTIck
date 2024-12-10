const Product=require("../../models/productSchema");
const Cart=require("../../models/cartSchema")

const addToCart = async (req, res) => {
    try {
        const { id } = req.query; // Product ID
        const { quantity } = req.body;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.quantity < quantity) {
            return res.status(400).json({ message: 'Insufficient stock available' });
        }

        let cart = await Cart.findOne({ userId: req.user._id });
        if (!cart) {
            cart = new Cart({ userId: req.user._id, items: [] });
        }

        const existingItem = cart.items.find(item => item.productId.equals(product._id));
        if (existingItem) {
            const totalQty = existingItem.quantity + quantity;

            if (totalQty > product.maxQtyPerPerson) {
                return res.status(400).json({ message: `Maximum ${product.maxQtyPerPerson} units allowed per person.` });
            }

            existingItem.quantity += quantity;
        } else {
            if (quantity > product.maxQtyPerPerson) {
                return res.status(400).json({ message: `Maximum ${product.maxQtyPerPerson} units allowed per person.` });
            }

            cart.items.push({ productId: product._id, quantity });
        }

        await cart.save();

        res.json({ message: 'Product added to cart successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const getCartItems = async (req, res) => {
  try {
      const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
      if (!cart) {
          return res.json({ items: [] });
      }

      const items = cart.items.map(item => ({
          productId: item.productId._id,
          name: item.productId.productName,
          brand: item.productId.brand,
          price: item.productId.regularPrice,
          quantity: item.quantity,
          stock: item.productId.quantity,
          maxQtyPerPerson: item.productId.maxQtyPerPerson,
      }));

      res.json(items);
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
};

const removeFromCart = async (req, res) => {
  try {
      const { id } = req.query; // Product ID

      const cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) {
          return res.status(404).json({ message: 'Cart not found' });
      }

      cart.items = cart.items.filter(item => !item.productId.equals(id));
      await cart.save();

      res.json({ message: 'Product removed from cart successfully' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = { addToCart, getCartItems, removeFromCart };
