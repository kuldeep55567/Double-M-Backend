const jwt =require('jsonwebtoken')
const {UserModel} = require("../Model/UserModel") 
require("dotenv").config();
  const authMiddleWare = async (req,res,next) => {
    try {
      const token = req.headers.authorization;
      const decodedToken = jwt.verify(token, process.env.SECRET);
      const { userId } = decodedToken;
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      if (user.isBlocked) {
        return res.status(403).json({ message: 'Your account has been blocked' });
      }
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ message: error.message });
    }
  }
module.exports = { authMiddleWare };
