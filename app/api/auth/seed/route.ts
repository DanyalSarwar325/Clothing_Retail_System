import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/app/libs/prisma";

// Default users for each department
const defaultUsers = [
  { username: "admin", password: "admin123", name: "Administrator", role: "admin", department: "Management" },
  { username: "cutting", password: "cutting123", name: "Cutting Staff", role: "cutting", department: "Cutting" },
  { username: "sewing", password: "sewing123", name: "Sewing Staff", role: "sewing", department: "Sewing" },
  { username: "quality", password: "quality123", name: "Quality Staff", role: "quality", department: "Quality" },
  { username: "handmade", password: "handmade123", name: "Handmade Staff", role: "handmade", department: "Handmade" },
  { username: "addawork", password: "addawork123", name: "Adda Work Staff", role: "adda_work", department: "Adda Work" },
  { username: "patching", password: "patching123", name: "Patching Staff", role: "patching", department: "Patching" },
  { username: "press", password: "press123", name: "Press Staff", role: "press", department: "Press" },
  { username: "packing", password: "packing123", name: "Packing Staff", role: "packing", department: "Packing" },
  { username: "store", password: "store123", name: "Store Staff", role: "store", department: "Store" },
];

export async function POST() {
  try {
    const createdUsers = [];
    const skippedUsers = [];

    for (const userData of defaultUsers) {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { username: userData.username },
      });

      if (existingUser) {
        skippedUsers.push(userData.username);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          username: userData.username,
          password: hashedPassword,
          name: userData.name,
          role: userData.role,
          department: userData.department,
        },
      });

      createdUsers.push({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        department: user.department,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Users seeded successfully",
      created: createdUsers,
      skipped: skippedUsers,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed users" },
      { status: 500 }
    );
  }
}

// GET endpoint to show available credentials
export async function GET() {
  return NextResponse.json({
    message: "Default login credentials",
    note: "POST to this endpoint to create these users in the database",
    users: defaultUsers.map((u) => ({
      username: u.username,
      password: u.password,
      role: u.role,
      department: u.department,
    })),
  });
}
