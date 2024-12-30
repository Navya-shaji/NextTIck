const Product=require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const Brand=require("../../models/brandSchema");
const User=require("../../models/userSchema")
const fs=require("fs")
const path = require("path")
//image resizing.............
const sharp=require("sharp");
const { log } = require("console");



const getProductAddPage = async(req,res)=>{
    try {
        const category = await Category.find({isListed:true})
        const brand = await Brand.find({isBlocked:false})
        
        res.render("product-add",{
            cat:category,
            brand:brand
        })

    } catch (error) {
        
        res.redirect("/pageerror")
    }
}


const addProducts = async (req, res) => {
    try {
        const products = req.body;

        
        const productExists = await Product.findOne({
            productName: products.productName,
        });

        if (!productExists) {
            const images = [];

           
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const originalImagePath = path.join(
                        "public",
                        "uploads",
                        "re-image",
                        req.files[i].filename
                    );
                    const resizedImagePath = path.join(
                        "public",
                        "uploads",
                        "re-image",
                        `resized-${req.files[i].filename}`
                    );

                   
                    await sharp(originalImagePath)
                        .resize({ width: 440, height: 440 })
                        .toFile(resizedImagePath);

                
                    images.push(`resized-${req.files[i].filename}`);
                }
            }
            
          
            const categoryId = await Category.findOne({ name: products.category });
            if (!categoryId) {
                return res.status(400).json("Invalid category name");
            }
            
         
            const newProduct = new Product({
                productName: products.productName,
                description: products.description,
                brand: products.brand,
                category: categoryId._id,
                regularPrice: products.regularPrice,
                salesPrice: products.salePrice,
                createdOn: new Date(),
                quantity: products.quantity,
                size: products.size,
                color: products.color,
                productImage: images,
                status: "Available",
            });
            

            const savedProduct = await newProduct.save();

            return res.redirect("/admin/addProducts");
        } else {
            return res.status(400).json("Product already exists. Please try with another name.");
        }
    } catch (error) {
        console.error("Error saving product", error);
        return res.redirect("/pageerror");
    }
};




const getAllProducts = async(req,res)=>{
  try {
    const search=req.query.search || "";
    const page = req.query.page || 1;
    const limit = 4

    const productData= await Product.find({
        $or:[
            {productName:{$regex:new RegExp(".*"+search+".*","i")}},
            {brand:{$regex:new RegExp(".*"+search+".*","i")}}
        ],
    }).limit(limit*1).skip((page-1)*limit).populate('category').exec();

    const count = await Product.find({
        $or:[
            {productName:{$regex:new RegExp(".*"+search+".*","i")}},
            {brand:{$regex:new RegExp(".*"+search+".*","i")}}
        ],
    }).countDocuments();

    const category = await Category.find({isListed:true});
    const brand = await Product.find({isBlocked:false});

    if(category && brand){
        res.render("products",{
            data:productData,
            currentPage:page,
            totalPages:page,
            totalPages:Math.ceil(count/limit),
            cat:category,
            brand:brand,
        })
    }else{
        res.render("page-404")
    }
  } catch (error) {
    res.redirect("/pageerror")
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
  
      // Restore the sales price by removing the discount
      const discount = Math.floor(product.regularPrice * (product.productOffer / 100));
      product.salesPrice = product.regularPrice; // Reset the sales price to the regular price
  
      // Clear the offer percentage
      product.productOffer = 0;
  
      // Save the updated product
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
        res.redirect("/pageerror")
    }
}



const unblockProduct=async(req,res)=>{
    try{
        let id=req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/products")
    } catch(error){
  res.redirect("/pageerror")
    }
}


const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) {
            return res.redirect("/pageerror"); 
        }
        const product = await Product.findOne({ _id: id });
        if (!product) {
            return res.redirect("/pageerror"); 
        }
        const category = await Category.find({isListed:true})
        const brand = await Brand.find({isBlocked:false});
        res.render("edit-product", {
            product: product,
            cat: category,
            brand:brand
        });
    } catch (error) {
        res.redirect("/pageerror");
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
       res.redirect("/pageerror") 
    }
}
const deleteSingleImage = async (req, res) => {
    try {
      const { imageNameToServer, productIdToServer } = req.body;
  
      // Find and update product
      const product = await Product.findByIdAndUpdate(
        productIdToServer,
        { $pull: { productImage: imageNameToServer } },
        { new: true }
      );
  
      if (!product) {
        return res.status(404).send({ status: false, message: "Product not found" });
      }
  
      // Build the image path
      const imagePath = path.join(
        __dirname,
        "..",
        "public",
        "uploads",
        "re-image",
        imageNameToServer
      );
  
    
      fs.access(imagePath, fs.constants.F_OK, (err) => {
        if (!err) {
          fs.unlink(imagePath, (unlinkErr) => {
            if (unlinkErr) {
              console.error(`Error deleting image ${imageNameToServer}`, unlinkErr);
            } else {
              console.log(`Image ${imageNameToServer} deleted successfully`);
            }
          });
        } else {
          console.log(`Image ${imageNameToServer} not found`);
        }
      });
  
      res.send({ status: true });
    } catch (error) {
      console.error("Error in deleteSingleImage:", error.message);
      res.status(500).json({ status: false, message: error.message });
    }
  };

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
            "product-images",
             filename
        );

        // Ensure directory exists
        const dir = path.join("public", "uploads", "product-images");
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

const updateProduct = async(req,res)=>{
    try {
       const id = req.query.id;
       const product = await Product.findOne({_id:id});
       const data = req.body;

       const existsProduct = await Product.findOne({
        productName:data.productName,
        _id:{$ne:id}
       });
       const category = await Category.find({isListed:true});
        const brand = await Brand.find({isBlock:false});

       if(existsProduct){
        return res.status(404).redirect(`/admin/editProduct?msg= This Product name already exists& product=${existsProduct}&cat=${category}&brand=${brand}`);
       }

       const image = [];
       if (product) {
        product.productImage = [];
        await product.save();
        }
       if(req.files && req.files.length>0){
        for(let i=0;i<req.files.length;i++){
            image.push(req.files[i].filename);
        }
       }

       const updatefilds = {
        productName:data.productName,
        description:data.description,
        brand:data.brand,
        category:product.category,
        regularPrice:data.regularPrice,
        salePrice:data.salePrice,
        quantity:data.quantity,
        flavor:data.flavor,
        size:data.size,
       }
       if(req.files.length>0){
        updatefilds.$push = {productImage:{$each:image}};
       }

       await Product.findByIdAndUpdate(id,updatefilds,{new:true});
       return res.redirect("/admin/product");
    } catch (error) {
        console.log("edit product error",error);
        return res.redirect("/admin/error");
    }
}



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