const User = require("../models/userSchema")

//userAuth............
const userAuth=(req,res,next)=>{
    if(req.session.user){
        console.log(req.session.user._id)
        User.findById(req.session.user._id)
        .then(data=>{
            if(data && !data.isBlocked){
                next();
            }else{
                req.session.user = null
                res.redirect("/login")
            }
        })
        .catch(error=>{
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
        res.status(500).send("internal Server Error")
        
    })
}

//...................


module.exports ={
    userAuth,
    adminAuth,
    
     
}