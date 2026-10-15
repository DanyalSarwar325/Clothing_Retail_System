import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
import bcrypt from "bcryptjs";

// GET all users
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department");

    const where: any = {};
    if (department) {
      where.department = department;
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        department: true,
        contactNo: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Provide both _id and id for 100% frontend compatibility
    const formattedUsers = users.map((u) => ({
      ...u,
      _id: u.id,
    }));

    return NextResponse.json({ success: true, users: formattedUsers });
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
    const existingUser = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Username already exists" },
        { status: 400 }
      );
    }

    // Determine role based on department
    const departmentToRole: Record<string, string> = {
      Admin: "admin",
      Accounting: "accountant",
      Sewing: "sewing",
      Quality: "quality",
      Handmade: "handmade",
      "Adda Work": "adda_work",
      Patching: "patching",
      Press: "press",
      Packing: "packing",
      Store: "store",
    };

    const role = departmentToRole[department] || "store";

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
        role,
        department,
        contactNo: contactNo || "",
        isActive: true,
      },
    });

    // Return user without password
    const userResponse = {
      id: user.id,
      _id: user.id,
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

// DELETE - Delete a user
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Prevent deleting admin users for safety
    if (user.role === "admin") {
      return NextResponse.json(
        { success: false, error: "Cannot delete admin users" },
        { status: 403 }
      );
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
