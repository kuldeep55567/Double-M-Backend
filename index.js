const express  = require("express");
const {connection} = require("./Config/db")
const {UserRouter} =require("./Controllers/UserRoute")
const fileUpload = require('express-fileupload');
const {logger }= require('./Middleware/Logger')
const cors  = require("cors")
require("dotenv").config()
const app = express();
app.use(express.json())
app.use(express.urlencoded({ extended: true })); 
app.use(fileUpload({
    useTempFiles:true
}));
app.use(cors())
app.use(logger)
app.use("/api",UserRouter)
app.get("/",async(req,res)=>{res.send("Welcome to Backend of DOUBLE M")})
app.listen(process.env.PORT,async()=>{
try {
    await connection
    console.log(`Database Connected Successfully`);  
} catch (error) {
    console.log(error.message);   
}
    console.log(`Server is running at port ${process.env.PORT}`);
    
})