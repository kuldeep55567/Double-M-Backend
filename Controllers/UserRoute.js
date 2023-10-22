const express = require('express');
const { UserModel } = require('../Model/UserModel')
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")

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
    res.redirect('https://65353679598cac421a789565--fabulous-basbousa-1ac9fe.netlify.app');

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
UserRouter.get('/users/:role?/:inGameRole?', async (req, res) => {
  try {
    const { name, ffName } = req.query;
    const { role, inGameRole } = req.params;
    let query = {};
    if (name) query.name = new RegExp(name, 'i'); // case-insensitive search for name
    if (ffName) query.ffName = new RegExp(ffName, 'i'); // case-insensitive search for inGame name
    if (role) query.role = role;
    if (inGameRole) query.inGameRole = inGameRole;
    const users = await UserModel.find(query);
    res.status(200).json(users);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
});


UserRouter.post('/updateProfile', authMiddleWare, async (req, res) => {
  try {
    const userId = req.user._id;
    const { ffName, bio, inGameRole, otherGames, favGuns, instagramURL, discordTag } = req.body;
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
    const processedOtherGames = typeof otherGames === "string" ? otherGames.split(',') : otherGames;
    const processedFavGuns = typeof favGuns === "string" ? favGuns.split(',') : favGuns;
    user.otherGames = [...new Set([...user.otherGames, ...processedOtherGames])];
    user.favGuns = [...new Set([...user.favGuns, ...processedFavGuns])];
    user.instagramURL = instagramURL || user.instagramURL;
    user.discordTag = discordTag || user.discordTag;

    // Handle profile picture upload and update
    if (req.files && req.files.image) {
      console.log("Trying to upload to Cloudinary...");
      try {
        await cloudinary.uploader.upload_stream({ resource_type: 'raw' }, (error, result) => {
          if (error) {
            console.error("Cloudinary Upload Error:", error);
            throw error;
          } else {
            console.log("Cloudinary Upload Result:", result);
            user.profilePicURL = result.secure_url;
          }
        }).end(req.files.image.data);
      } catch (uploadError) {
        console.error("Caught Error:", uploadError);
        return res.status(500).json({ Uploading_Error_Message: uploadError.message });
      }
    }
    await user.save();
    return res.status(200).json({ mssg: 'Profile Updated Successfully' });
  } catch (error) {
    return res.status(500).json({ mssg: error.message });
  }
});

module.exports = { UserRouter }