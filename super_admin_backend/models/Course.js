import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  courseId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    default: 'Programming',
    trim: true
  },
  level: {
    type: String,
    default: 'Beginner to Advanced'
  },
  duration: {
    type: String,
    default: '40 hours'
  },
  rating: {
    type: Number,
    default: 4.8
  },
  reviewsCount: {
    type: Number,
    default: 100
  },
  price: {
    type: String,
    default: 'Free'
  },
  instructor: {
    type: String,
    default: 'Expert Instructor'
  },
  instructorRole: {
    type: String,
    default: 'Senior Technical Educator'
  },
  badge: {
    type: String,
    default: 'Featured'
  },
  icon: {
    type: String,
    default: 'fas fa-graduation-cap'
  },
  color: {
    type: String,
    default: 'from-blue-500 to-indigo-600'
  },
  gradient: {
    type: String,
    default: 'from-blue-600 to-indigo-600'
  },
  description: {
    type: String,
    default: ''
  },
  overview: {
    type: String,
    default: ''
  },
  learningOutcomes: [{
    type: String
  }],
  modules: [{
    id: String,
    title: String,
    duration: String,
    topics: [{
      id: String,
      title: String,
      duration: String,
      videoUrl: String,
      youtubeId: String,
      videoId: String,
      summary: String,
      cheatSheet: [String]
    }]
  }],
  // --- Per-Organization Granular Access Provisions Matrix ---
  organizationProvisions: [{
    orgId: {
      type: String,
      lowercase: true,
      trim: true
    },
    // Array of Branch + Year Provision Rules
    rules: [{
      branches: [{
        type: String,
        uppercase: true,
        trim: true
      }],
      years: [{
        type: String,
        trim: true
      }]
    }],
    // Legacy fallback fields
    branches: [{
      type: String,
      uppercase: true,
      trim: true
    }],
    years: [{
      type: String,
      trim: true
    }]
  }],
  // --- Access Provisioning Fallback / Searching Arrays ---
  assignedOrganizations: [{
    type: String,
    lowercase: true,
    trim: true
  }], // Array of orgIds, e.g., ['svck', 'aits']
  assignedBranches: [{
    type: String,
    uppercase: true,
    trim: true
  }], // Array of branch codes, e.g., ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIML', 'AIDS']
  assignedYears: [{
    type: String,
    trim: true
  }], // Array of academic years, e.g., ['1', '2', '3', '4']
  isPublished: {
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

export default courseSchema;
