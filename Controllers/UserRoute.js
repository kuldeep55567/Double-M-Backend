const express = require('express');
const { UserModel } = require('../Model/UserModel')
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const {checkAdminRole} = require("../Middleware/Role")
const { authMiddleWare } = require("../Middleware/Authenticate")
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
require("dotenv").config()
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.KEY);
const UserRouter = express.Router();
UserRouter.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    console.log(req.body);
    const exists = await UserModel.findOne({ email });
    if (exists) {
      return res.status(400).json({ ok: false, mssg: 'User already registered' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const token = jwt.sign({ email }, process.env.SECRET, { expiresIn: '2h' });
    const verificationURL = `https://nice-jade-cocoon-gear.cyclic.app/api/verify/${token}`;
    const user = new UserModel({
      name,
      email,
      password: hashed,
    });
    await user.save();
    const mailOptions = {
      to: email,
      from: process.env.Email,
      subject: 'Email Verification',
      html: `
            <p>Hello ${name},</p>
            <p>Please Verify Your Email by clicking on the Link Below</p>
            <a href="${verificationURL}">${verificationURL}</a>
            `,
    };
    sgMail
      .send(mailOptions)
      .then(() => {
        res.status(200).json({
          mssg: 'Verify your email before proceeding..',
          userID: user._id
        });
      })
      .catch((err) => {
        res.status(500).json({ mailError: err.message });
      });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
});

UserRouter.get('/verify/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const decoded = jwt.verify(token, process.env.SECRET);
    const email = decoded.email;
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ mssg: 'User not Found' });
    }
    user.isVerified = true;
    await user.save();
    res.redirect('https://double-m.vercel.app/login');

  } catch (error) {
    return res.status(500).json({ mssg: error.message });
  }
});

UserRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ mssg: 'User with this email not found' });
    }
    if (user.isVerified === false) {
      return res.status(401).json({ mssg: 'Verify your email first' });
    }
    const isSame = await bcrypt.compare(password, user.password);
    if (!isSame) {
      return res.status(401).json({ mssg: 'Wrong credentials' });
    }
    const ftoken = jwt.sign({ userId: user._id }, process.env.SECRET, { expiresIn: '24h' });
    const response = {
      ok: true,
      token: ftoken,
      id: user._id,
      mssg: 'Login Successfull',
      name: user.name
    };
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ mssg: error.message });
  }
});
UserRouter.get('/profile/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ mssg: 'User not found' });
    }
    user.password = undefined;
    res.status(200).json(user);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
});
UserRouter.get('/me', authMiddleWare, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.password = undefined;
    res.status(200).json(user);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
});
UserRouter.delete('/users/:id', authMiddleWare, checkAdminRole, async (req, res) => {
  try {
    const userIdToDelete = req.params.id;
    const deletedUser = await UserModel.findByIdAndDelete(userIdToDelete);
    
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
});
UserRouter.get('/users', async (req, res) => {
  try {
    const { searchTerm, role,inGameRole,limit = 10, skip = 0 } = req.query;
    let query = {isVerified:true};

    if (searchTerm) {
      query.$or = [
        { name: new RegExp(searchTerm, 'i') },
        { ffName: new RegExp(searchTerm, 'i') }
      ];
    }
    if (role) query.role = role;
    if (inGameRole) query.inGameRole = inGameRole

    const users = await UserModel.find(query)
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    const totalCount = await UserModel.countDocuments(query);

    res.status(200).json({
      total: totalCount,
      limit: parseInt(limit),
      skip: parseInt(skip),
      data: users
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
});
UserRouter.get('/admin/users', async (req, res) => {
  try {
    const { searchTerm, role,inGameRole,limit = 10, skip = 0 } = req.query;
    let query = {};

    if (searchTerm) {
      query.$or = [
        { name: new RegExp(searchTerm, 'i') },
        { ffName: new RegExp(searchTerm, 'i') }
      ];
    }
    if (role) query.role = role;
    if (inGameRole) query.inGameRole = inGameRole

    const users = await UserModel.find(query)
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    const totalCount = await UserModel.countDocuments(query);

    res.status(200).json({
      total: totalCount,
      limit: parseInt(limit),
      skip: parseInt(skip),
      data: users
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
});
UserRouter.post('/updateProfile', authMiddleWare, async (req, res) => {
  try {
    const userId = req.user._id;
    const { ffName, bio, inGameRole, otherGames, favGuns, instagramURL, discordTag,profilePicURL } = req.body;
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ mssg: 'User not Found' });
    }
    if (!user.isVerified) {
      return res.status(403).json({ mssg: 'User is not verified. Profile update not allowed.' });
    }
    user.ffName = ffName || user.ffName;
    user.bio = bio || user.bio;
    user.inGameRole = inGameRole || user.inGameRole;
    if (otherGames) {
      const processedOtherGames = typeof otherGames === "string" ? otherGames.split(',') : otherGames;
      if (!Array.isArray(processedOtherGames)) {
          return res.status(400).json({ mssg: 'Invalid format for otherGames' });
      }
      user.otherGames = [...new Set([...user.otherGames, ...processedOtherGames])];
  }
    if (favGuns) {
      const processedOtherGuns = typeof favGuns === "string" ? favGuns.split(',') : favGuns;
      if (!Array.isArray(processedOtherGuns)) {
          return res.status(400).json({ mssg: 'Invalid format for Guns' });
      }
      user.favGuns = [...new Set([...user.favGuns, ...processedOtherGuns])];
  }
    user.instagramURL = instagramURL || user.instagramURL;
    user.discordTag = discordTag || user.discordTag;

    if (profilePicURL) {
      user.profilePicURL = profilePicURL;
  }

  await user.save();  // Save the user updates to the database

  res.status(200).json({ mssg: 'Profile updated successfully!' });
  } catch (error) {
    return res.status(500).json({ mssg: error.message });
  }
});
UserRouter.post('/admin/updateProfile/:userId', authMiddleWare,checkAdminRole, async (req, res) => {
  try {
    const userIdToUpdate = req.params.userId;
    const { ffName, bio, inGameRole, otherGames, favGuns, instagramURL, discordTag, profilePicURL } = req.body;
    const user = await UserModel.findByIdAndUpdate(userIdToUpdate, { $set: req.body }, { new: true }); 
    if (!user) {
      return res.status(404).json({ mssg: 'User not Found' });
    }

    // No check for user verification as this is an admin action
    user.ffName = ffName || user.ffName;
    user.bio = bio || user.bio;
    user.inGameRole = inGameRole || user.inGameRole;

    if (otherGames) {
      const processedOtherGames = typeof otherGames === "string" ? otherGames.split(',') : otherGames;
      if (!Array.isArray(processedOtherGames)) {
          return res.status(400).json({ mssg: 'Invalid format for otherGames' });
      }
      user.otherGames = [...new Set([...user.otherGames, ...processedOtherGames])];
    }

    if (favGuns) {
      const processedOtherGuns = typeof favGuns === "string" ? favGuns.split(',') : favGuns;
      if (!Array.isArray(processedOtherGuns)) {
          return res.status(400).json({ mssg: 'Invalid format for Guns' });
      }
      user.favGuns = [...new Set([...user.favGuns, ...processedOtherGuns])];
    }

    user.instagramURL = instagramURL || user.instagramURL;
    user.discordTag = discordTag || user.discordTag;

    if (profilePicURL) {
      user.profilePicURL = profilePicURL;
    }
    try {
      await user.save();
  } catch (saveError) {
      console.error("Error saving the user:", saveError);
      return res.status(500).json({ mssg: "Error saving the user." });
  }  
    res.status(200).json({ mssg: 'Profile updated successfully!' });
  } catch (error) {
    return res.status(500).json({ mssg: error.message });
  }
});
module.exports = { UserRouter }