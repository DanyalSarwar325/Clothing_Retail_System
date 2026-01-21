import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/libs/dbConnect";
import User from "@/app/libs/models/user";
import bcrypt from "bcryptjs";

// GET all users
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department");

    const query: any = {};
    if (department) {
      query.department = department;
    }

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { username, password, name, department, contactNo } = body;

    // Validation
    if (!username || !password || !name || !department) {
      return NextResponse.json(
        { success: false, error: "Username, password, name, and department are required" },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Username already exists" },
        { status: 400 }
      );
    }

    // Determine role based on department
    const departmentToRole: Record<string, string> = {
      "Admin": "admin",
      "Cutting": "cutting",
      "Sewing": "sewing",
      "Quality": "quality",
      "Handmade": "handmade",
      "Adda Work": "adda_work",
      "Patching": "patching",
      "Press": "press",
      "Packing": "packing",
      "Store": "store",
    };

    const role = departmentToRole[department] || "store";

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      username: username.toLowerCase(),
      password: hashedPassword,
      name,
      role,
      department,
      contactNo: contactNo || "",
      isActive: true,
    });

    // Return user without password
    const userResponse = {
      _id: user._id,
      username: user.username,
      name: user.name,
      role: user.role,
      department: user.department,
      contactNo: user.contactNo,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };

    return NextResponse.json({ success: true, user: userResponse }, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create user" },
      { status: 500 }
    );
  }
}
