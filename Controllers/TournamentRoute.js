const express = require('express');
const { UserModel } = require('../Model/UserModel')
const { TeamModel } = require('../Model/TeamModel')
const bcrypt = require("bcrypt")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const { checkAdminRole } = require("../Middleware/Role")
const { authMiddleWare } = require("../Middleware/Authenticate")
const cloudinary = require('cloudinary').v2;
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
require("dotenv").config()
const TournamentRouter = express.Router();
TournamentRouter.post('/create-team', authMiddleWare, async (req, res) => {
    try {
        const { name, slogan, logoURL } = req.body;
        const userId = req.user._id;
        const existingTeamCreator = await TeamModel.findOne({ creator: userId });
        if (existingTeamCreator) {
            return res.status(400).json({ error: `You have already created team ${existingTeamCreator.name}` });
        }
        const existingTeamMember = await TeamModel.findOne({ members: userId });
        if (existingTeamMember) {
            return res.status(400).json({ error: 'User is already a member of a team.' });
        }
        if (!name) {
            return res.status(400).json({ error: 'Team Name is required.' });
        }
        if (!name || !/^[a-zA-Z0-9\s]+$/.test(name)) {
            return res.status(400).json({ error: 'Invalid team name. Only alphanumeric characters and spaces are allowed.' });
        }
        const prohibitedWords = ['MM', 'mm', 'sex', 'sexy'];
        if (prohibitedWords.some(word => name.toLowerCase().includes(word.toLowerCase()))) {
            return res.status(400).json({ error: 'Prohibited words in the team name.' });
        }
        // Check if the team name is already in use
        const existingTeamWithSameName = await TeamModel.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existingTeamWithSameName) {
            return res.status(400).json({ error: 'Team name is already in use.' });
        }
        const team = new TeamModel({
            name,
            creator: userId,
            slogan,
            logoURL
        });
        await team.save();
        const existingUser = await UserModel.findById(userId);
        existingUser.teamName = name;
        await existingUser.save();
        return res.status(201).json({ message: 'Team created successfully.', team });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

TournamentRouter.post('/join-team/:teamId', authMiddleWare, async (req, res) => {
    try {
        const { teamId } = req.params;
        const userId = req.user._id;

        // Check if the user is already part of a team
        const existingUser = await UserModel.findById(userId);
        if (existingUser.teamName) {
            return res.status(400).json({ error: `Already part of a team - ${existingUser.teamName} ` });
        }

        // Check if the team exists and is approved
        const team = await TeamModel.findById(teamId);
        if (!team.isApproved) {
            return res.status(404).json({ error: 'Team not approved.' });
        }

        // Check if the user is the team creator
        if (userId === team.creator.toString()) {
            return res.status(400).json({ error: 'Team creator cannot join their own team.' });
        }

        // Add the user to the team's join requests
        if (!team.joinRequests.includes(userId)) {
            team.joinRequests.push(userId);
            await team.save();
            return res.status(200).json({ message: 'Join request sent successfully.' });
        } else {
            return res.status(400).json({ error: 'Join request already sent.' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

TournamentRouter.post('/handle-join-request/:teamId', authMiddleWare, async (req, res) => {
    try {
        const { teamId } = req.params;
        const { userId, action } = req.body; // 'action' can be 'approve' or 'reject'
        const teamCreatorId = req.user._id;

        // Check if the user making the request is the team creator
        const team = await TeamModel.findOne({ _id: teamId, creator: teamCreatorId });
        if (!team) {
            return res.status(403).json({ error: 'Permission denied.' });
        }

        // Check if the user exists
        const userToHandle = await UserModel.findById(userId);
        if (!userToHandle) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Check if the user has a pending join request
        const joinRequestIndex = team.joinRequests.findIndex(request => request._id.toString() === userId.toString());

        if (joinRequestIndex === -1) {
            return res.status(400).json({ error: 'Invalid join request.' });
        }

        if (action === 'approve') {
            // Approve the join request
            if (team.members.length + 1 > 4) {
                return res.status(400).json({ error: 'Adding this user would exceed the team\'s maximum capacity (5 members).' });
            }
            team.members.push(userId);
            userToHandle.teamName = team.name;
        } else if (action === 'reject') {
            // Reject the join request
            userToHandle.teamName = null;
        } else {
            return res.status(400).json({ error: 'Invalid action.' });
        }

        // Remove the join request regardless of approve or reject
        team.joinRequests.splice(joinRequestIndex, 1);
        await team.save();
        await userToHandle.save();

        return res.status(200).json({ message: `Join request ${action}ed for ${userToHandle.name}` });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});


TournamentRouter.get('/my-team', authMiddleWare, async (req, res) => {
    try {
        const userId = req.user._id;
        const creatorTeam = await TeamModel.findOne({ creator: userId }).populate('members');
        const memberTeam = await TeamModel.findOne({ members: userId }).populate('members');
        if (creatorTeam) {
            return res.status(200).json({ team: creatorTeam, role: 'creator' });
        } else if (memberTeam) {
            return res.status(200).json({ team: memberTeam, role: 'member' });
        } else {
            // User is not part of any team, suggest joining a team
            return res.status(404).json({ error: 'No team found for the user. You can create or join a team.' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
TournamentRouter.get('/join-requests', authMiddleWare, async (req, res) => {
    try {
        const userId = req.user._id;
        const creatorTeam = await TeamModel.findOne({ creator: userId }).populate('members');
        const memberTeam = await TeamModel.findOne({ members: userId }).populate('members');
        if (creatorTeam) {
            return res.status(200).json({ team: creatorTeam, role: 'creator' });
        } else if (memberTeam) {
            return res.status(200).json({ team: memberTeam, role: 'member' });
        } else {
            // User is not part of any team, suggest joining a team
            return res.status(404).json({ error: 'No team found for the user. You can create or join a team.' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
// Add this route to your existing routes
TournamentRouter.get('/teams/:id?', authMiddleWare, async (req, res) => {
    try {
        const { id } = req.params;

        const aggregationPipeline = [
            {
                $match: id ? { _id: mongoose.Types.ObjectId(id) } : {}
            },
            {
                $lookup: {
                    from: "users",
                    localField: "creator",
                    foreignField: "_id",
                    as: "creatorUser"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "members",
                    foreignField: "_id",
                    as: "memberUsers"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "joinRequests._id",
                    foreignField: "_id",
                    as: "joinRequestUsers"
                }
            },
            {
                $unwind: "$creatorUser"
            },
            {
                $group: {
                    _id: "$_id",
                    root: { $mergeObjects: "$$ROOT" },
                    memberUsers: { $push: "$memberUsers" },
                    joinRequestUsers: { $push: "$joinRequestUsers" }
                }
            },
            {
                $replaceRoot: {
                    newRoot: {
                        $mergeObjects: ["$root", "$$ROOT"]
                    }
                }
            },
            {
                $project: {
                    root: 0
                }
            }
        ];

        const teams = await TeamModel.aggregate(aggregationPipeline);
        if (!teams || teams.length === 0) {
            return res.status(404).json({ error: 'Team not found.' });
        }
        return res.status(200).json({ teams });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
TournamentRouter.get('/team-action/:teamId', authMiddleWare, checkAdminRole, async (req, res) => {
    try {
        const { teamId } = req.params;
        const action = req.query.action; // 'approve' or 'reject'

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action specified.' });
        }

        const team = await TeamModel.findById(teamId);
        if (!team) {
            return res.status(404).json({ error: 'Team not found.' });
        }

        if (action === 'approve' && team.isApproved) {
            return res.status(400).json({ error: 'This team is already approved.' });
        }

        if (action === 'reject' && !team.isApproved) {
            return res.status(400).json({ error: 'This team is already rejected or not yet approved.' });
        }

        team.isApproved = (action === 'approve');
        await team.save();

        const message = action === 'approve' ? 'Team approved successfully.' : 'Team rejected successfully.';
        return res.status(200).json({ message, team });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


module.exports = { TournamentRouter };