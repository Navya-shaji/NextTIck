
const mongoose = require("mongoose");
const User = require("../../models/userSchema");



const customerInfo = async (req, res) => {
    try {
       
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 3;

        const query = {
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        };

       
        const [userData, count] = await Promise.all([
            User.find(query)
                .limit(limit)
                .skip((page - 1) * limit)
                .exec(),
            User.countDocuments(query)
        ]);

        res.render("customers", {
            customers: userData,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(count / limit)
            },
            search
        });
    } catch (error) {
        console.error("Error fetching customer data:", error.message);
        res.status(500).send("Internal Server Error");
    }
};




const customerBlocked = async (req, res) => {
    try {
        const id = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new Error("Invalid User ID");
        }

        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect("/admin/users");
    } catch (error) {
        console.error("Error blocking customer:", error.message);
        res.redirect("/pageerror");
    }
};



const customerunBlocked = async (req, res) => {
    try {
        const id = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new Error("Invalid User ID");
        }

        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect("/admin/users");
    } catch (error) {
        console.error("Error unblocking customer:", error.message);
        res.redirect("/pageerror");
    }
};


module.exports = {
    customerInfo,
    customerBlocked,
    customerunBlocked
};
