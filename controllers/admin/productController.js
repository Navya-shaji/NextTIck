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
            console.log(images);
            
          
            const categoryId = await Category.findOne({ name: products.category });
            if (!categoryId) {
                return res.status(400).json("Invalid category name");
            }
            console.log(products);
            
         
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
            console.log(savedProduct);

            return res.redirect("/admin/addProducts");
        } else {
            return res.status(400).json("Product already exists. Please try with another name.");
        }
    } catch (error) {
        console.error("Error saving product", error);
        return res.redirect("/admin/pageerror");
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
    // console.log(category)
    const brand = await Product.find({isBlocked:false});
    // console.log(brand)

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
    console.log(error)
    res.redirect("/pageerror")
  }
}




const addProductOffer = async (req, res) => {
    try {

        const { productId, offerPrice } = req.body;
        console.log(req.body)
   
        if (!productId || !offerPrice) {
            return res.status(400).json({ message: "Product ID and Offer Price are required." });
        }

    
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: "Product not found." });
        }

  
        product.offerPrice = offerPrice;
        product.isOnOffer = true; 
        await product.save();

        res.status(200).json({
            message: "Offer added successfully.",
            product,
        });
    } catch (error) {
        console.error("Error adding product offer:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};




const removeProductOffer = async (req, res) => {
    try {
        const { productId } = req.body;

       
        if (!productId) {
            return res.status(400).json({ message: "Product ID is required." });
        }

      
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: "Product not found." });
        }

        product.offerPrice = null;
        product.isOnOffer = false; 
        await product.save();

        res.status(200).json({
            message: "Offer removed successfully.",
            product,
        });
    } catch (error) {
        console.error("Error removing product offer:", error);
        res.status(500).json({ message: "Internal server error." });
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



// const editProduct = async(req,res)=>{
//     try {
        
//         const id=req.params.id
//         console.log(req.body)
//         const data = req.body
// const existingProduct = await Product.findOne({
//     productName:req.body.productName,
//     id:{$ne:id}
    
// })

// if(existingProduct){
//     return res.status(400).json({error:"Product with this name already exists. Please try with another name"})
// }
//   const images =[];
//   if(req.files && req.files.length>0){
//     for(let i=0;i<req.files;i++){
//         images.push(req.files[i].filename)
//     }
//   }
//   const category = Category.findOne({name:data.name})
//   const updateFields ={
//     productName:data.productName,
//     description:data.description,
//     brand:data.brand,
//     category:category._id,
//     regularPrice:data.regularPrice,
//     salesPrice:data.salePrice,
//     quantity:data.quantity,
//     color:data.color
//   }
//   if(req.files.length>0){
//     updateFields.$push ={productImmage:{$each:images}};
//   }
//   await Product.findByIdAndUpdate(id,updateFields,{new:true})
//   res.redirect("/admin/products")
//    } catch (error) {
//        console.error(error);
//        res.redirect("/pageerror") 
//     }
// }

const editProduct = async(req,res)=>{
    try {
        const id=req.params.id
        const product = await Product.findOne({_id:id})
        const data = req.body
const existingProduct = await Product.findOne({
    productName:data.productName,
    id:{$ne:id}
    
})

if(existingProduct){
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


const deleteSingleImage = async(req,res)=>{
    try {
        const {imageNameToserver,productIdToServer}=req.body;
        console.log(req.body);
        
        console.log(imageNameToserver)
        const product=await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImage:imageNameToserver}})
        const imagePath = path.join("public","uploads","re-image",imageNameToserver);
        if(fs.existsSync(imagePath)){
            await fs.unlinkSync(imagePath);
            console.log(`Image ${imageNameToserver} deleted successfully`);
            
        }else{
            console.log(`Image ${imageNameToserver} not found`);
            
        }
        res.send({status:true})
    } catch (error) {
        console.log(error);
        
        res.redirect("/pageerror")
    }
}

// const deleteSingleImage = async(req,res)=>{
//     try {
//         const {imageNametoServer,productIdServer}=req.body;
//         const product=await Product.findByIdAndUpdate(productIdToServer,{$pull:{peoductImage:imageNameToServer}})
//         const imagePath = path.join("public","uploads","re-image",imageNametoServer);
//         if(fs.existsSync(imagePath)){
//             await fs.unlinkSync(imagePath);
//             console.log(`Image ${ImageNameToServer} deleted successfully`);
            
//         }else{
//             console.log(`Image ${ImageNameToServer} not found`);
            
//         }
//         res.send({status:true})
//     } catch (error) {
//         res.redirect("/pageerror")
//     }
// }

const updateproduct = async(req,res)=>{
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
        console.log("edit product error",erro);
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
    updateproduct 
}