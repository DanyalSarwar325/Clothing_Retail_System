import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import DbConnect from "@/app/libs/dbConnect";
import User, { UserRole } from "@/app/libs/models/user";
import { createToken, ROLE_DEFAULT_ROUTE } from "@/app/libs/auth";

export async function POST(request: NextRequest) {
  try {
    await DbConnect();

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Find user by username
    const user = await User.findOne({ username: username.toLowerCase(), isActive: true });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = await createToken({
      id: user._id.toString(),
      username: user.username,
      name: user.name,
      role: user.role as UserRole,
      department: user.department,
    });

    // Get default redirect route for this role
    const userRole: UserRole = user.role;
    const redirectTo = ROLE_DEFAULT_ROUTE[userRole] || "/";

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        department: user.department,
      },
      redirectTo,
    });

    // Set HTTP-only cookie
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
