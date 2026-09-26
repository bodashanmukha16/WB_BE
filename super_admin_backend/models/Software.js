import mongoose from 'mongoose';

const softwareSchema = new mongoose.Schema({
  softwareId: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  language: {
    type: String,
    default: '',
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  icon: {
    type: String,
    default: 'fa-download'
  },
  color: {
    type: String,
    default: 'from-blue-500 to-blue-700'
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export default softwareSchema;
