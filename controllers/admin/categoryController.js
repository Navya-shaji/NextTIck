const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");

const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit);

        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalPages,
            totalCategories,
        });
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.redirect("/pageerror");
    }
};

//Adding Catagory.........................



const addCategory = async (req, res) => {
    const { name, description } = req.body;

    try {
        const existingCategory = await Category.findOne({ name:{$regex:name,$options:"i"} });
        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" });
        }

        
        const newCategory = new Category({
            name,
            description,
        });





        await newCategory.save();
        return res.json({ message: "Category added successfully" });
    } catch (error) {
        console.error("Error in addCategory:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};


//Adding Category Offer.................................


const addCategoryOffer = async (req, res) => {
    try {
        const { categoryId, percentage } = req.body;
        const category = await Category.findById(categoryId);

        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        const products = await Product.find({ category: category._id });
        const hasProductOffer = products.some(product => product.productOffer > percentage);

        if (hasProductOffer) {
            return res.json({ status: false, message: "Product offers exceed this percentage" });
        }

        category.categoryOffer = percentage;
        await category.save();

        for (const product of products) {
            product.productOffer = 0;
            product.salesPrice = product.regularPrice;
            await product.save();
        }

        res.json({ status: true, message: "Category offer added successfully" });
    } catch (error) {
        console.error("Error adding category offer:", error);
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};

//Removing Catagory Offer.........................


const removeCategoryOffer = async (req, res) => {
    try {
        const { categoryId } = req.body;
        const category = await Category.findById(categoryId);
      

        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        const percentage = category.categoryOffer;
        const products = await Product.find({ category: category._id });

        for (const product of products) {
            product.salePrice = Math.floor(product.regularPrice * (1 - percentage / 100));
            product.productOffer = 0;
            await product.save();
        }

        category.categoryOffer = 0;
        await category.save();
        res.json({ status: true, message: "Category offer removed successfully" });
    } catch (error) {
        console.error("Error removing category offer:", error);
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};

//Removing Category...............................



const removeCategory = async (req, res) => {
    try {
        const { categoryId } = req.body;

        // Check if the category exists
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        // Ensure no products are tied to this category before removing
        const associatedProducts = await Product.find({ category: category._id });
        if (associatedProducts.length > 0) {
            return res.status(400).json({ status: false, message: "Category cannot be deleted; associated products exist." });
        }

        // Remove the category
        await Category.findByIdAndDelete(categoryId);

        res.json({ status: true, message: "Category removed successfully" });
    } catch (error) {
        console.error("Error removing category:", error);
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};

//For Geting Listed Category............................................


const getListedCategory = async (req,res)=>{
    try{
        let id=req.query.id;
        console.log(id)
       
        await Category.updateOne({_id:id},{$set:{isListed:false}})
        res.redirect("/admin/category")
    }catch(error){
        res.redirect("/pageerror")
    }
}

//For Getting Unlisted Category................................................



const getUnlistedCategory=async(req,res)=>{
    try {
        let id = req.query.id;
        console.log(id)
       
        await Category.updateOne({_id:id},{$set:{isListed:true}})
        res.redirect("/admin/category")
    } catch (error) {
        res.redirect("/pageerror")
    }
}

const getEditCategory = async(req,res)=>{
    try{
        const id = req.query.id;
        const category = await Category.findOne({_id:id});
        res.render("editCategory",{category:category});
    }catch{
        res.redirect("/pageerror")
    }
};



const editCategory = async (req, res) => {
    try {
        const id = req.params.id; 
        const { categoryName, description } = req.body;

        const existingCategory = await Category.findOne({ name: categoryName });

        if (existingCategory && existingCategory._id.toString() !== id) {
            return res.status(400).json({ error: "Category exists, please choose another name" });
        }

       const updatedCategory = await Category.findByIdAndUpdate(
        id,
        { name: categoryName, description },
        { new: true, runValidators: true } 
    );

    if (!updatedCategory) {
        return res.status(404).json({ error: "Category not found." }); 
    }

    return res.redirect("/admin/category");
} catch (error) {
    console.error("Error updating category:", error);
    return res.status(500).json({ error: "Internal Server Error." }); 
}
};
  


module.exports = {
    categoryInfo,
    addCategory,
    addCategoryOffer,
    removeCategoryOffer,
    removeCategory,
    getListedCategory,
    getUnlistedCategory,
    getEditCategory,
    editCategory 
}
