const User = require("../models/userSchema")

//userAuth............
const userAuth=(req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next();
            }else{
                res.redirect("/login")
            }
        })
        .catch(error=>{
            console.log("Error in user auth middleware");
            res.status(500).send("internal server error")
        })
    }else{
        res.redirect("/login")
    }
}


//adminAuth...........
const adminAuth = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data && req.session.admin){
            next()
        }else{
            res.redirect("/admin/login")
           
        }
    })
    .catch(error=>{
        console.log("Error in adminauth middleware",error);
        res.status(500).send("internal Server Error")
        
    })
}



module.exports ={
    userAuth,
    adminAuth,
     
}