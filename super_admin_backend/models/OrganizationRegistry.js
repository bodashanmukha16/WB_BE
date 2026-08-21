import mongoose from 'mongoose';

const organizationRegistrySchema = new mongoose.Schema({
  orgId: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  logo: {
    type: String,
    default: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=150&auto=format&fit=crop&q=80'
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'expired'],
    default: 'active'
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Default 1 year from now
  },
  dbName: {
    type: String,
    required: true
  },
  contactEmail: {
    type: String,
    default: ''
  },
  planType: {
    type: String,
    enum: ['Trial', 'Standard', 'Enterprise'],
    default: 'Enterprise'
  },
  isIpRestrictionEnabled: {
    type: Boolean,
    default: true
  },
  allowedIpPool: [{
    ip: { type: String, required: true },
    label: { type: String, default: 'College Lab Computer' },
    addedAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export default organizationRegistrySchema;
