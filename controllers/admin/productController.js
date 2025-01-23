const Product=require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const Brand=require("../../models/brandSchema");
const User=require("../../models/userSchema");
const fs=require("fs");
const path = require("path");
//image resizing.............
const sharp=require("sharp");
const { log } = require("console");
const mongoose = require('mongoose')



const  getProductAddPage = async(req,res)=>{
    try {
        const category = await Category.find({isListed:true})
        const brand = await Brand.find({isBlocked:false})
        
        res.render("product-add",{
            cat:category,
            brand:brand
        })

    } catch (error) {
        console.error("Error in getProductAddPage:", error);
        res.redirect("/admin/error")
    }
}
const addProducts = async (req, res) => {
    try {
        const products = req.body;
        const images = req.files ? req.files.map(file => file.filename) : [];

        // Validate required fields
        if (!products.productName || !products.description || !products.brand || 
            !products.category || !products.regularPrice || !products.quantity || images.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: "All fields are required, including at least one image"
            });
        }

        // Validate brand ID
        if (!mongoose.Types.ObjectId.isValid(products.brand)) {
            return res.status(400).json({
                success: false,
                error: "Invalid brand ID format"
            });
        }

        const productExists = await Product.findOne({
            productName: products.productName,
        });

        if (productExists) {
            return res.status(400).json({
                success: false,
                error: "Product already exists. Please try with another name."
            });
        }

        const categoryId = await Category.findOne({ name: products.category });
        if (!categoryId) {
            return res.status(400).json({
                success: false,
                error: "Invalid category name"
            });
        }

        // Check if brand exists and is not blocked
        const brand = await Brand.findOne({ 
            _id: products.brand,
            isBlocked: false 
        });

        if (!brand) {
            return res.status(400).json({
                success: false,
                error: "Selected brand not found or is blocked"
            });
        }

        // Ensure salesPrice is set, even if it's the same as regularPrice
        const salesPrice = products.salePrice && products.salePrice.trim() !== '' 
            ? parseFloat(products.salePrice) 
            : parseFloat(products.regularPrice);

        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: products.brand,
            category: categoryId._id,
            regularPrice: parseFloat(products.regularPrice),
            salesPrice: salesPrice,
            createdOn: new Date(),
            quantity: parseInt(products.quantity),
            productImage: images,
            status: "Available",
        });

        const savedProduct = await newProduct.save();

        if (savedProduct) {
            return res.status(200).json({
                success: true,
                message: "Product added successfully",
                product: savedProduct
            });
        } else {
            return res.status(500).json({
                success: false,
                error: "Failed to save the product"
            });
        }
    } catch (error) {
        console.error("Error in addProducts:", error);
        return res.status(500).json({
            success: false,
            error: "Internal server error: " + error.message
        });
    }
};


const getAllProducts = async(req,res)=>{
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
  
        const searchQuery = {
            productName: { $regex: new RegExp(search, "i") }
        };
  
        const productData = await Product.find(searchQuery)
            .limit(limit)
            .skip((page - 1) * limit)
            .populate('category')
            .populate('brand', 'brandName')
            .exec();
    
        const count = await Product.countDocuments(searchQuery);
  
        const category = await Category.find({isListed:true});
        const brand = await Brand.find({isBlocked:false});

        // Calculate brand distribution
        const allProducts = await Product.find().populate('brand', 'brandName');
        const brandCounts = {};
        allProducts.forEach(product => {
            if (product.brand && product.brand.brandName) {
                const brandName = product.brand.brandName;
                brandCounts[brandName] = (brandCounts[brandName] || 0) + 1;
            }
        });

        const brandDistribution = {
            labels: Object.keys(brandCounts),
            data: Object.values(brandCounts)
        };
  
        res.render("products", {
            data: productData,
            currentPage: page,
            totalPages: Math.ceil(count/limit),
            cat: category,
            brand: brand,
            brandDistribution: brandDistribution
        });
    } catch (error) {
        console.error("Error in getAllProducts:", error);
        res.redirect("/admin/error");
    }
}
  
  

const addProductOffer = async (req, res) => {
    try {
        const { productId, percentage } = req.body;

        if (!productId || !percentage) {
            return res.status(400).json({
                status: false,
                message: "Product ID and percentage are required."
            });
        }

        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
            return res.status(400).json({
                status: false,
                message: "Percentage must be a number between 0 and 100."
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                status: false,
                message: "Product not found."
            });
        }

        const discount = Math.floor(product.regularPrice * (percentage / 100));
        product.salesPrice = product.regularPrice - discount;
        product.productOffer = percentage;
        await product.save();

        res.json({
            status: true,
            message: `Offer applied successfully (${percentage}% discount).`,
            product: product
        });
    } catch (error) {
        console.error("Error adding product offer:", error);
        res.status(500).json({
            status: false,
            message: "Internal server error.",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};
const removeProductOffer = async (req, res) => {
    try {
      const { productId } = req.body;
  
      // Find the product by ID
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          status: false,
          message: "Product not found."
        });
      }
  
      const discount = Math.floor(product.regularPrice * (product.productOffer / 100));
      product.salesPrice = product.regularPrice; // Reset the sales price to the regular price
  
      product.productOffer = 0;
  
      await product.save();
  
      res.json({
        status: true,
        message: "Offer removed successfully."
      });
  
    } catch (error) {
      console.error("Error removing product offer:", error);
      res.status(500).json({
        status: false,
        message: "Internal server error.",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  };
  


const blockProduct = async(req,res)=>{
    try {
        let id = req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect("/admin/products")
    } catch (error) {
        res.redirect("/admin/error")
    }
}



const unblockProduct=async(req,res)=>{
    try{
        let id=req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/products")
    } catch(error){
  res.redirect("/admin/error")
    }
}


const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.redirect("/admin/error"); 
        }
        
        const product = await Product.findById(id)
            .populate('brand', 'brandName')
            .populate('category');
            
        if (!product) {
            return res.redirect("/admin/error"); 
        }
        
        const category = await Category.find({isListed:true});
        const brand = await Brand.find({isBlocked:false});

        res.render("edit-product", {
            product: product,
            cat: category,
            brand: brand
        });
    } catch (error) {
        console.error("Error in getEditProduct:", error);
        res.redirect("/admin/error");
    }
};


const editProduct = async(req,res)=>{
    try {
        const id=req.params.id
        const product = await Product.findOne({_id:id})
        const data = req.body
const existingProduct = await Product.findOne({
    productName:data.productName,
    id:{$ne:id}
    
})

if(existingProduct && existingProduct._id != id){
    return res.status(400).json({error:"Product with this name already exists. Please try with another name"})
}
  const images =[];
  if(req.files && req.files.length>0){
    for(let i=0;i<req.files;i++){
        images.push(req.files[i].filename)
    }
  }


  const updateFields ={
    productName:data.productName,
    description:data.description,
    brand:data.brand,
    category:product.category,
    regularPrice:data.regularPrice,
    salePrice:data.salePrice,
    quantity:data.quantity,
    color:data.color
  }

  if(req.files && req.files.length > 0){
    updateFields.$push ={productImmage:{$each:images}};
  }

  await Product.findByIdAndUpdate(id,updateFields,{new:true})
  res.redirect("/admin/products")
   } catch (error) {
       console.error(error);
       res.redirect("/admin/error") 
    }
}
const updateProduct = async (req, res) => {
    try {
        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({success:true, message:"Invalid product id"})
        }

        const product = await Product.findById(id).populate('brand', 'brandName');
        if (!product) {
            return res.status(404).json({success:true, message:"Product Not Found"})
        }


        const data = req.body;

        const existsProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        });

        if (existsProduct) {
            const queryParams = new URLSearchParams({
                msg: "This Product name already exists",
                product: existsProduct._id,
            }).toString();

            // return res.redirect(`/admin/editProduct?${queryParams}`);
            return res.status(400).json({success:false, message:'Product with same name already exists'})
        }

        // Validate brand ID if provided
        if (data.brand && !mongoose.Types.ObjectId.isValid(data.brand)) {
            return res.status(400).json({success:false, message:"Invalid brand ID format"});
        }

        // Check if brand exists and is not blocked
        if (data.brand) {
            const brand = await Brand.findOne({ 
                _id: data.brand,
                isBlocked: false 
            });
            if (!brand) {
                return res.status(400).json({
                    success: false,
                    message: "Selected brand not found or is blocked"
                });
            }
        }

        const image = [];
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => image.push(file.filename));
        }

        const updateFields = {
            productName: data.productName,
            description: data.description,
            brand: data.brand || product.brand,
            category: product.category,
            regularPrice: data.regularPrice,
            salePrice: data.salePrice,
            quantity: data.quantity,
            flavor: data.flavor,
            size: data.size,
        };

        if (image.length > 0) {
            updateFields.productImage = image;
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            id, 
            updateFields, 
            { new: true }
        ).populate('brand', 'brandName');

        return res.status(200).json({
            success: true, 
            message: "Product updated successfully",
            product: updatedProduct
        });
    } catch (error) {
        console.error("Edit product error:", error);
        return res.status(400).json({success:false, message:"Something went wrong"})
    }
};


const deleteSingleImage = async(req,res)=>{
    try {
        const { imageName, productId } = req.body;
        
        // Validate input
        if (!imageName || !productId) {
            return res.status(400).json({
                success: false,
                error: "Image name and product ID are required"
            });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                error: "Product not found"
            });
        }

        // Check if image exists in product
        if (!product.productImage.includes(imageName)) {
            return res.status(404).json({
                success: false,
                error: "Image not found in product"
            });
        }

        // Update product
        await Product.findByIdAndUpdate(productId, {
            $pull: { productImage: imageName }
        });

        // Delete file
        const imagePath = path.join("public", "uploads", "re-images", imageName);
        if(fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
        
        return res.status(200).json({ 
            success: true, 
            message: "Image deleted successfully" 
        });
    } catch (error) {
        console.error('Error deleting image:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || "Internal server error" 
        });
    }
}

const addProductImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "No image file provided"
            });
        }

        const productId = req.body.productId;
        if (!productId) {
            return res.status(400).json({
                success: false,
                error: "Product ID is required"
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                error: "Product not found"
            });
        }

        if (product.productImage.length >= 4) {
            return res.status(400).json({
                success: false,
                error: "Maximum 4 images allowed"
            });
        }

        const file = req.file;
        const originalImagePath = file.path;
        const filename =   file.filename;
        const resizedImagePath = path.join(
            "public",
            "uploads",
            "re-images",
             filename
        );

        // Ensure directory exists
        const dir = path.join("public", "uploads", "re-images");
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Resize image
        await sharp(originalImagePath)
            .resize({ width: 800, height: 800 })
            .toFile(resizedImagePath);

        // Update product with new image
        await Product.findByIdAndUpdate(productId, {
            $push: { productImage: filename }
        });

        // Delete original file
        setTimeout(async () => {
            try {
                if (fs.existsSync(originalImagePath)) {
                    await fs.promises.unlink(originalImagePath);
                }
            } catch (err) {
                console.error('Error deleting original file:', err);
                // Continue execution even if deletion fails
            }
        }, 2000);

        return res.status(200).json({
            success: true,
            message: "Image uploaded successfully",
            imageName: filename
        });

    } catch (error) {
        console.error('Error uploading image:', error);
        return res.status(500).json({
            success: false,
            error: error.message || "Failed to upload image"
        });
    }
};



module.exports={
    getProductAddPage,
    addProducts,
    getAllProducts,
    addProductOffer,
    removeProductOffer,
    blockProduct ,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage ,
     updateProduct  ,
    addProductImage
}