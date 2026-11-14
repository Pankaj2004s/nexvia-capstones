const mongoose = require('mongoose');

const ROLES = ['student', 'instructor', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'student', index: true },
    isActive: { type: Boolean, default: true },
    refreshTokenHash: { type: String, select: false },
    bio: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return { id: this._id.toString(), name: this.name, email: this.email, role: this.role, isActive: this.isActive, bio: this.bio };
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
