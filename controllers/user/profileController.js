const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema")
const Order = require("../../models/orderSchema")
const Wallet = require("../../models/walletSchema")
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");
const { securePassword } = require("./userController");


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
        })
        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Uour OTP for password reset",
            text: "Your OTP is ${otp}",
            html: `<b><h4>Your OTP :${otp}</h4><br></b>`
        }

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:", info.messageId);
        return true;

    } catch (error) {
        console.error("Error sending email", error);
        return false;
    }
}



const getForgotPassPage = async (req, res) => {
    try {
        res.render("forgot-password")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


const forgotEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email: email });
        if (findUser) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp)
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("forgotPass-otp");
                console.log("OTP", otp);

            } else {
                res.json({ success: false, message: "Failed to send OTP .Please try again" })
            }
        } else {
            res.render("forgot-password", {
                message: "User with this email does not exist"
            })
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}



const verifyForgotPassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        if (enteredOtp === req.session.userOtp) {
            res.json({ success: true, redirectUrl: "/reset-password" });
        } else {
            res.json({ success: false, message: "OTP not matching" })
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occured .Please try again" })
    }
}

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
        console.log("Resending OTP to email:", email);
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("Resend OTP", otp);
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

        // const orders = await Order.find({ userId: user._id }).populate('address').sort({ createdOn: -1 });
        const orders = await Order.find({ userId: user._id }).sort({ createdOn: -1 });

   



        const address = await Address.findOne({ userId: user._id });
        const userWallet = await Wallet.findOne({ userId: user._id });
        res.render("profile", {
            user: user,
            orders: orders,
            userAddress: address || {},
            wallet: userWallet || { totalBalance: 0 },
        });
    } catch (error) {
        console.error("Error fetching user profile:", error.message);
        res.status(500).send("Internal Server Error");
    }
};


//change email....................................................................

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

//password changing.................................................................


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
      const { name, phone, email} = req.body;
  
      const userId = req.session.user;
      const user = await User.findById(userId);
  
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
  
      if (name) user.name = name;
      if (phone) user.phone = phone;
      if (email) user.email = email;
      await user.save();

      req.session.user = {
        name: user.name,
        phone: user.phone,
      };
  
      res.json({ success: true, message: 'Profile updated successfully!' });


    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ success: false, message: 'An error occurred while updating the profile.' });
    }
  };
  
const getAddressPage = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const addressData = await Address.findOne({ userId: userId });
        return res.render("displayaddress", { userAddress: addressData });
    } catch (error) {
        console.log("get address page error", error.message);
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
        console.log("address", addressType)
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
        console.log("post add address error", error);
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
        console.log(currAddress)
        const addressData = currAddress.address.find((item) => item._id.toString() === addressId);
        if (!addressData) {
            return res.redirect("/pageNotFound");
        }
        res.render("editAddress", { address: addressData, user: user, id: addressId });
    } catch (error) {
        console.log("edit page error", error.message);
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
        console.log("edit address error", error.message);
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
        console.log("delete address error", error.message);
        res.redirect("/pageNotFound");
    }
};


//order page........................

const getOrders = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const orders = await Order.find({ userId: userId }).sort({ createdAt: -1 });
        res.render("orders", { orders: orders });
    } catch (error) {
        console.log("get orders error", error.message);
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
        console.log("cancel order error", error.message);
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


module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    sendVerificationEmail,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    changeEmail,
    changeEmailValid,
    verifyEmailOtp,
    updateEmail,
    resetPassword,
    changePasswordValid,
    verifyChangepassOtp,
    updateProfile,
    getAddressPage,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
    getOrders,
    cancelOrder,
    renderChangePasswordPage,
    deleteOrder,
    getWalletBalance,
    addMoney,
    getWalletHistory,
    refundToWallet,
    getWalletForUser,
    updateProfile

}