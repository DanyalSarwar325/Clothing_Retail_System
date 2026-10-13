import mongoose, { Schema, Document } from "mongoose";

export type UserRole = 
  | "admin" 
  | "sewing" 
  | "quality" 
  | "handmade" 
  | "adda_work" 
  | "patching" 
  | "press" 
  | "overlock"
  | "clipping"
  | "packing" 
  | "store";

export interface IUser extends Document {
  username: string;
  password: string;
  name: string;
  role: UserRole;
  department: string;
  contactNo: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      enum: [
        "admin",
        "sewing",
        "quality",
        "handmade",
        "adda_work",
        "patching",
        "press",
        "overlock",
        "clipping",
        "packing",
        "store",
      ],
    },
    department: {
      type: String,
      required: true,
    },
    contactNo: {
      type: String,
      required: false,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
