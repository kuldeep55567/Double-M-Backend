const mongoose = require('mongoose');
const ChatSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});
const ChatModel = mongoose.model('Chat', ChatSchema);
module.exports = { ChatModel };
