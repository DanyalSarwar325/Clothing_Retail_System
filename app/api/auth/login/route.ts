import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/app/libs/prisma";
import { createToken, ROLE_DEFAULT_ROUTE, UserRole } from "@/app/libs/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Find user by username using Prisma
    const user = await prisma.user.findFirst({
      where: {
        username: username.toLowerCase().trim(),
        isActive: true,
      },
    });

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
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role as UserRole,
      department: user.department || "General",
    });

    // Get default redirect route for this role
    const userRole = user.role as UserRole;
    const redirectTo = ROLE_DEFAULT_ROUTE[userRole] || "/";

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        _id: user.id, // Ensure backwards compatibility with any frontend checking _id
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
