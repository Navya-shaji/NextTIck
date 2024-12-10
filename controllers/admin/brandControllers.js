const Brand = require("../../models/brandSchema");
const Product=require("../../models/productSchema")


const getBrandPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const brandData = await Brand.find({})
            .sort({ createdAt: -1 }) 
            .skip(skip)
            .limit(limit);

        const totalBrands = await Brand.countDocuments();
        const totalPages = Math.ceil(totalBrands / limit);

        res.render("brands", {
            data: brandData,
            currentPage: page,
            totalPages: totalPages,
            totalBrands: totalBrands,
        });
    } catch (error) {
        console.error("Error fetching brand data:", error); 
        res.redirect("/pageerror");
    }
};


const addBrand=async(req,res)=>{
    try {
        const brand = req.body.name;
        const findBrand=await Brand.findOne({brand});
        if(!findBrand){
            const image = req.file.filename;
            const newBrand=new Brand({
                brandName:brand,
                brandImage:image,
            })
            await newBrand.save();
            res.redirect("/admin/brands")
        }
    } catch (error) {
        res.redirect("/pageerror")
    }
}


const blockBrand = async (req, res) => {
    try {
        const id = req.params.id;
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect("/admin/brands");
    } catch (error) {
        res.redirect("/pageerror");
    }
};

const unblockBrand = async (req, res) => {
    try {
        const id = req.params.id;
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect("/admin/brands");
    } catch (error) {
        res.redirect("/pageerror");
    }
};

const deleteBrand = async (req, res) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).redirect("/pageerror");
        }
        await Brand.deleteOne({ _id: id });
        res.redirect("/admin/brands");
    } catch (error) {
        console.error("Error deleting brand:", error);
        res.status(500).redirect("/pageerror");
    }
};


const updateBrand = async (req, res) => {
    try {
        console.log("update working");
        const id = req.body.brandId;
        const brandName = req.body.brandName;
        const image = req.file;

        const findBrand = await Brand.findOne({ brandName: brandName });
        if (findBrand) {
            console.log("find brand");
            return res.status(400).json({ success: false, message: "Brand already exists" });
        } else {
            const updateBrand = await Brand.updateOne(
                { _id: id },
                { $set: { brandName: brandName, brandImage: image?.filename } }
            );

            if (!updateBrand.modifiedCount) {
                return res.status(404).json({ success: false, message: "Brand not found" });
            }

            return res.status(200).json({ success: true, message: "Brand updated successfully" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error updating brand", error });
    }
};

module.exports={
    getBrandPage,
    addBrand,
    blockBrand,
    unblockBrand,
    deleteBrand,
    updateBrand 
}


