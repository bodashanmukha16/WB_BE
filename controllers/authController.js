import bcrypt from "bcrypt"
import generateToken from "../utils/generateToken.js"
import User from '../config/db.js';
export const login = async (req,res)=>{
    const {username, password} = req.body
    try{
        const userResult = await User.findOne({ username });
        if(userResult.rows.length === 0)
        {
            return res.status(400).json({message: "userNot found"
            })
        }
        const user = userResult.rows[0]
        const isMatch = await bcrypt.compare(password, user.password)

        if(!isMatch)
        {
            return res.status(400).json({message:"Invalid Credentials"})
        }
        const token = generateToken(user)
        res.json({
            message:"Login Successfull",
            token,
            user:{
                id:user.id,
                username: user.username,
                role: user.role
            }
        })
    }
    catch(e)
    {
        console.error(e)
        res.status(500).json({message:"500 Server Not Ready"})
    }
};