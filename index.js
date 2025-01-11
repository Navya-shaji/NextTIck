const express = require("express");
const app = express(); // app server instance
const path = require("path");
const session = require("express-session");
const env = require("dotenv").config(); // inputing .env
const passport = require("./config/passport");
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const nocache=require("nocache")
db();

app.use(express.json()); //middleware
app.use(express.urlencoded({ extended: true }));
app.use(nocache())
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, 
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.set("cache-control", "no-store");
  next();
});

app.set("view engine", "ejs"); 


app.use(express.static(path.join(__dirname, "public")));

app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
]);



app.use("/", userRouter);
app.use("/admin", adminRouter);


const PORT = 1212 || process.env.PORT;
app.listen(PORT, () => {
  console.log("Server Running!...........");
});

module.exports = app;
