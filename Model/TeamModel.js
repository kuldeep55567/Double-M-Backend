const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
    name: { type: String, required: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to the user who created the team
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],    // Array of user references
    joinRequests: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        isApproved: { type: Boolean, default: false },
    }],
    
    isApproved: { type: Boolean, default: false }, // Indicates whether the team is approved or not
    slogan: { type: String, default: null }, // Slogan of the team
    logoURL: { type: String, required:true,default: null }, // URL to the logo of the team // URL to the logo of the team
}, {
    timestamps: true,
    versionKey: false
});

const TeamModel = mongoose.model('Team', TeamSchema);
module.exports = { TeamModel };
