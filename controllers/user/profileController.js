const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema")
const Order = require("../../models/orderSchema")
const Wallet = require("../../models/walletSchema")
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");
const { securePassword } = require("./userController");
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for profile image uploads...................................................
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'profile-images');

// Create upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
    return cb(new Error('Only image files are allowed!'), false);
  }
  cb(null, true);
};

const uploadMiddleware = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
}).single('profileImage');

function generateOtp() {
    const digits = "1234567890";
    let otp = "";
    for (let i = 0; i < 6; i++) {
        otp += digits[Math.floor(Math.random() * 10)]
    }
    return otp;
}

const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        });
        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for password reset",
            text: `Your OTP is ${otp}`,
            html: `<b><h4>Your OTP: ${otp}</h4><br></b>`
        };

        const info = await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending email", error);
        return false;
    }
};

const getForgotPassPage = async (req, res) => {
    try {
        res.render("forgot-password");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const forgotEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email: email });
        if (findUser) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("forgotPass-otp");
             
            } else {
                res.json({ success: false, message: "Failed to send OTP. Please try again" });
            }
        } else {
            res.render("forgot-password", {
                message: "User with this email does not exist"
            });
        }
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const verifyForgotPassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        if (enteredOtp === req.session.userOtp) {
            res.json({ success: true, redirectUrl: "/reset-password" });
        } else {
            res.json({ success: false, message: "OTP not matching" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occurred. Please try again" });
    }
};

const getResetPassPage = async (req, res) => {
    try {
        res.render('reset-password', { message: '' });
    } catch (error) {
        console.error("Error in getResetPassPage:", error);
        res.redirect("/pageNotFound");
    }
};

const resendOtp = async (req, res) => {
    try {
        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
    
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
          
            res.status(200).json({ success: true, message: "Resend OTP Successful" });
        } else {
            throw new Error("Failed to send email");
        }
    } catch (error) {
        console.error("Error in resend otp:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const postNewPassword = async (req, res) => {
    try {
        const { newPass1, newPass2 } = req.body;
        const email = req.session.email;
        if (!email) {
            return res.render("reset-password", { message: "Session expired. Please try again." });
        }
        if (newPass1 === newPass2) {
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                { email: email },
                { $set: { password: passwordHash } }
            );
            req.session.destroy((err) => {
                if (err) console.error("Session destruction error:", err);
                res.redirect("/login");
            });
        } else {
            res.render("reset-password", { message: "Passwords do not match" });
        }
    } catch (error) {
        console.error("Error in postNewPassword:", error);
        res.redirect("/pageNotFound");
    }
};

const userProfile = async (req, res) => {
    try {
        const user = req.session.user;

        if (!user) {
            return res.redirect("/login");
        }

        const page = parseInt(req.query.page) || 1;
        const walletPage = parseInt(req.query.walletPage) || 1;
        const activeTab = req.query.tab || 'v-pills-profile-tab'; // Default to profile tab
        const itemsPerPage = 10;

        // Calculate pagination for orders
        const totalOrders = await Order.countDocuments({ userId: user._id });
        const totalPages = Math.ceil(totalOrders / itemsPerPage);
        const orders = await Order.find({ userId: user._id })
            .sort({ createdOn: -1 })
            .skip((page - 1) * itemsPerPage)
            .limit(itemsPerPage);

        const address = await Address.findOne({ userId: user._id });
        const userWallet = await Wallet.findOne({ userId: user._id });

        // Calculate pagination for wallet transactions
        let walletTransactions = [];
        let totalWalletPages = 0;
        if (userWallet && userWallet.transactions) {
            const startIndex = (walletPage - 1) * itemsPerPage;
            walletTransactions = userWallet.transactions
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(startIndex, startIndex + itemsPerPage);
            totalWalletPages = Math.ceil(userWallet.transactions.length / itemsPerPage);
        }

        res.render("profile", {
            user: user,
            orders: orders,
            userAddress: address || {},
            wallet: {
                ...userWallet?._doc || { totalBalance: 0 },
                transactions: walletTransactions
            },
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                currentWalletPage: walletPage,
                totalWalletPages: totalWalletPages
            },
            activeTab: activeTab
        });
    } catch (error) {
        console.error("Error fetching user profile:", error.message);
        res.status(500).send("Internal Server Error");
    }
};

const updateProfileImage = async (req, res) => {
  uploadMiddleware(req, res, async function(err) {
    try {
      // Handle multer errors
      if (err instanceof multer.MulterError) {
        console.error('Multer error:', err);
        return res.status(400).json({ 
          success: false, 
          message: 'File upload error: ' + err.message 
        });
      } else if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({ 
          success: false, 
          message: err.message || 'Error uploading file' 
        });
      }

      // Check if file exists
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No file uploaded' 
        });
      }

      // Check authentication
      if (!req.session?.user?._id) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Find and update user
      const user = await User.findById(req.session.user._id);
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }

      // Delete old profile image if it exists and is not the default
      if (user.profileImage && !user.profileImage.includes('default')) {
        const oldImagePath = path.join(uploadDir, user.profileImage);
        try {
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (error) {
          console.error('Error deleting old image:', error);
        }
      }

      // Update user profile with new image
      user.profileImage = req.file.filename;
      await user.save();

   
      // Update the session user data
      req.session.user = user;

      res.json({ 
        success: true, 
        message: 'Profile image updated successfully',
        imageUrl: `/uploads/profile-images/${req.file.filename}`
      });

    } catch (error) {
      console.error('Server error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error',
        error: error.message 
      });
    }
  });
};

const deleteProfileImage = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if user has a profile image
    if (!user.profileImage || user.profileImage === 'default-profile.jpg') {
      return res.status(400).json({ 
        success: false, 
        message: 'No profile image to delete' 
      });
    }

    // Get the full path to the image
    const imagePath = path.join(__dirname, '../../public/uploads/profile-images', user.profileImage);

    // Check if file exists before attempting to delete
    if (fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
      } catch (error) {
        console.error('Error deleting file:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Error deleting image file' 
        });
      }
    }

    // Update user document with default image
    try {
      user.profileImage = 'default-profile.jpg';
      await user.save();

      // Update session
      req.session.user = user;

      return res.status(200).json({ 
        success: true, 
        message: 'Profile image deleted successfully',
        defaultImage: '/uploads/profile-images/default-profile.jpg'
      });
    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Error updating user profile' 
      });
    }
  } catch (error) {
    console.error('Error in deleteProfileImage:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
};

const changeEmail = async (req, res) => {
    try {
        res.render("change-email")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const changeEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const userExists = await User.findOne({ email });
        if (userExists) {
            const otp = generateOtp()
            const emailSent = await sendVerificationEmail(email, otp)
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.userData = req.body;
                req.session.email = email;
                res.render("change-email-otp");
                console.log("EmailSent", email);
                console.log("OTP", otp);

            } else {
                res.json("email-error")
            }
        } else {
            res.render("change-email", {
                message: "User with this emailnot exist"
            })
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const verifyEmailOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        if (enteredOtp === req.session.userOtp) {
            req.session.userData = req.body.userData;
            res.render("new-email", {
                userData: req.session.userData,
            })
        } else {
            res.render("change-email-otp", {
                messager: "OTP not matching",
                userData: req.session.userData
            })
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const updateEmail = async (req, res) => {
    try {
        const newEmail = req.body.newEmail;
        const userId = req.session.user;
        await User.findByIdAndUpdate(userId, { email: newEmail });
        res.redirect("/userProfile")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const renderChangePasswordPage = async (req, res) => {
    try {
        res.render("change-password", { message: '' });
    } catch (error) {
        console.error("Error rendering change password page:", error);
        res.redirect("/pageNotFound");
    }
};

const changePasswordValid = async (req, res) => {
    try { 
        const { email } = req.body;
        const userExists = await User.findOne({ email });
        if (userExists) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("change-password-otp", { email: email });
                console.log("OTP", otp);
            } else {
                res.render("change-password", {
                    message: "Failed to send OTP. Please try again."
                });
            }
        } else {
            res.render("change-password", {
                message: "User with this email does not exist"
            });
        }
    } catch (error) {
        console.error("Error in change password validation:", error);
        res.redirect("/pageNotFound");
    }
};

const verifyChangepassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        if (enteredOtp === req.session.userOtp) {
            res.json({ success: true, redirectUrl: "/reset-password" });
        } else {
            res.json({ success: false, message: "OTP not matching" });
        }
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ success: false, message: "An error occurred. Please try again later" });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { newPass1, newPass2 } = req.body;
        const email = req.session.email;
        if (!email) {
            return res.render("reset-password", { message: "Session expired. Please try again." });
        }
        if (newPass1 === newPass2) {
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                { email: email },
                { $set: { password: passwordHash } }
            );
            req.session.destroy((err) => {
                if (err) console.error("Session destruction error:", err);
                res.redirect("/login");
            });
        } else {
            res.render("reset-password", { message: "Passwords do not match" });
        }
    } catch (error) {
        console.error("Error resetting password:", error);
        res.redirect("/pageNotFound");
    }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { name, phone } = req.body;

    // Validate the input
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    // Update user profile
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user fields
    user.name = name.trim();
    if (phone) {
      user.phone = phone.trim();
    }

    await user.save();

    // Update session data
    req.session.user = user;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        name: user.name,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
};

const getAddressPage = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const addressData = await Address.findOne({ userId: userId });
        return res.render("displayaddress", { userAddress: addressData });
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const addAddress = async (req, res) => {
    try {
        const user = req.session.user._id;
        res.render("add-address", { user: user });

    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const postAddAddress = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;
        const userAddress = await Address.findOne({ userId: userId });
        if (!userAddress) {
            const newAddress = new Address({
                userId: userId,
                address: [{ addressType, name, city, landMark, state, pincode, phone, altPhone }]
            });
            await newAddress.save();
        } else {
            userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone });
            await userAddress.save();
        }
        return res.status(200).json({ success: true, message: "Address added successfully" });

    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error" });

    }
};

const editAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const user = req.session.user._id;
        const currAddress = await Address.findOne({ "address._id": addressId });
        if (!currAddress) {
            return res.redirect("/pageNotFound");
        }
        const addressData = currAddress.address.find((item) => item._id.toString() === addressId);
        if (!addressData) {
            return res.redirect("/pageNotFound");
        }
        res.render("editAddress", { address: addressData, user: user, id: addressId });
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const postEditAddress = async (req, res) => {
    try {
        const data = req.body;
        const addressId = req.params.id;
        const userId = req.session.user._id;

        const findAddress = await Address.findOne({ "address._id": addressId });
        if (!findAddress) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        await Address.updateOne(
            { "address._id": addressId },
            {
                $set: {
                    "address.$": {
                        _id: addressId,
                        addressType: data.addressType,
                        name: data.name,
                        city: data.city,
                        landMark: data.landMark,
                        state: data.state,
                        pincode: data.pincode,
                        phone: data.phone,
                        altPhone: data.altPhone,
                    },
                },
            }
        );

        res.status(200).json({ success: true, message: "Address updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const findAddress = await Address.findOne({ "address._id": addressId });
        if (!findAddress) {
            return res.status(404).send("Address not found");
        }

        await Address.updateOne(
            { "address._id": addressId },
            { $pull: { address: { _id: addressId } } }
        );
        return res.redirect("/userProfile");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const getOrders = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const orders = await Order.find({ userId: userId }).sort({ createdAt: -1 });
        res.render("orders", { orders: orders });
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        if (order.status === 'Delivered') {
            return res.status(400).json({ success: false, message: "Cannot cancel a delivered order" });
        }
        order.status = 'Cancelled';
        await order.save();
        res.status(200).json({ success: true, message: "Order cancelled successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const deleteOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const user = req.session.user;

        if (!user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const order = await Order.findOneAndDelete({ _id: orderId, userId: user._id });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        res.status(200).json({ success: true, message: "Order deleted successfully" });
    } catch (error) {
        console.error("Error deleting order:", error.message);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const getWalletBalance = async (req, res) => {
    try {
        let wallet = await Wallet.findOne({ user: req.user._id });
        if (!wallet) {
            wallet = new Wallet({ user: req.user._id });
            await wallet.save();
        }
        res.json({ balance: wallet.balance });
    } catch (error) {
        console.error('Error fetching wallet balance:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const addMoney = async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        let wallet = await Wallet.findOne({ user: req.user._id });
        if (!wallet) {
            wallet = new Wallet({ user: req.user._id });
        }

        wallet.balance += amount;
        wallet.history.push({
            status: 'credit',
            payment: amount,
            date: new Date()
        });

        await wallet.save();
        res.json({ message: 'Money added successfully', balance: wallet.balance });
    } catch (error) {
        console.error('Error adding money to wallet:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getWalletHistory = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ user: req.user._id });
        if (!wallet) {
            return res.json({ history: [] });
        }
        res.json({ history: wallet.history });
    } catch (error) {
        console.error('Error fetching wallet history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const refundToWallet = async (req, res) => {
    try {
        const { orderId, amount } = req.body;
        if (!orderId || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid order or amount' });
        }

        let wallet = await Wallet.findOne({ user: req.user._id });
        if (!wallet) {
            wallet = new Wallet({ user: req.user._id });
        }

        wallet.balance += amount;
        wallet.history.push({
            status: 'credit',
            payment: amount,
            date: new Date()
        });

        await wallet.save();
        res.json({ message: 'Refund processed successfully', balance: wallet.balance });
    } catch (error) {
        console.error('Error processing refund:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getWalletForUser = async (userId) => {
    try {
        const wallet = await WalletModel.findOne({ userId });
        return wallet || { balance: 0 };
    } catch (error) {
        console.error('Error fetching wallet:', error);
        throw new Error('Could not fetch wallet data');
    }
};

async function changePasswordModal(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user_id;

    const user = await User.findById(userId);
    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.json({ success: false, message: 'Current password is incorrect' });
    }

    // Hash the new password
    const hashedPassword = await securePassword(newPassword);
    user.password = hashedPassword;
    await user.save();

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error in changePasswordModal:', error);
    return res.json({ success: false, message: 'Internal server error' });
  }
}

async function changePasswordDirect(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user._id;

    // Input validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await securePassword(newPassword);
    
    // Update password
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Error in changePasswordDirect:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    changeEmail,
    changeEmailValid,
    verifyEmailOtp,
    updateEmail,
    renderChangePasswordPage,
    changePasswordValid,
    verifyChangepassOtp,
    resetPassword,
    updateProfile,
    updateProfileImage,
    deleteProfileImage,
    getAddressPage,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
    getOrders,
    cancelOrder,
    deleteOrder,
    getWalletBalance,
    addMoney,
    getWalletHistory,
    refundToWallet,
    changePasswordDirect,
    sendVerificationEmail
}