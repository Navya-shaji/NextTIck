const mongoose = require("mongoose");
const { Schema } = mongoose; // Correct import of Schema

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
    required: false,
    unique: false,
    sparse: true,
    default: null,
  },
  googleId: {
    type: String,
    // unique: true,
    // sparse:true,
    
  },
  password: {
    type: String,
    required: false,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  cart: [
    {
      type: Schema.Types.ObjectId, // Fixed schema to Schema
      ref: "Cart",
    },
  ],
  wallet: [
    {
      type: Schema.Types.ObjectId, // Fixed typo (schema -> Schema)
      ref: "Wishlist",
    },
  ],
  orderHistory: [
    {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
  ],
  createdOn: {
    type: Date,
    default: Date.now,
  },
  referalCode: {
    type: String,
    // required: true,
  },
  redeemed: {
    type: Boolean,
    // default: false,
  },
  redeemedUsers: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
      // required: true,
    },
  ],
  searchHistory: [
    {
      category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
      brand: {
        type: String, // Fixed typo (type -> type)
      },
      searchOn: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

const User = mongoose.model("User", userSchema);
module.exports = User;

