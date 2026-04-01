import express,{ Request,Response } from "express";
import cors from 'cors';

const app=express();
const port=4000

app.use(cors())
app.use(express.json())
type loginRequest={
    username:string;
    password:string;
};
app.post("/login",(req:Request<{},{},loginRequest>,res:Response)=>{
    const{username,password}=req.body;
    console.log("recieved:",username,password);
    if(!username||!password){
        return res.status(400).json({message:"All field are missing"});
    }
    if(username==="admin" && password==="1234"){
        return res.json({message:"Admin Login Successful"});
    }
});

app.listen(port,()=>{
    console.log(`Server running on port ${port}`);
})