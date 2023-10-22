const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, match: /@/ },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin", "guild"], default: "user" },
    isVerified: { type: Boolean, default: false }, 
    isBlocked: { type: Boolean, default: false },   
    
    // New fields
    ffName:{ type: String, default: null },
    position: {type:String, default:"member"},
    bio: { type: String, default: null },
    otherGames: { type: [String], default: [] }, 
    inGameRole:{ type: String, default: null },
    favGuns: { type: [String], default: [] },   
    instagramURL: { type: String, default: 'https://help.instagram.com/415595770433263/?helpref=uf_share' },
    discordTag: { type: String, default: null },
    teamName: { type: String, default: null },
    tournamentsPlayed: { type: Number, default: 0 },
    profilePicURL: { type: String, default: null }
}, {
    timestamps:true,
    versionKey: false
});

const UserModel = mongoose.model('User', UserSchema);
module.exports = { UserModel }
