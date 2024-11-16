const pageNotFound =async (req,res)=>{
    try {
        res.render("page-404")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const loadHomepage =async (req,res)=>{
    try {
        return res.render("home")
    } catch (error) {
        console.log("home Page Not Found ");
        res.status(500).send("Server error")
        
    }
}

module.exports={
    loadHomepage,
    pageNotFound
}