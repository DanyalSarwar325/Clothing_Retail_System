import { NextResponse } from "next/server";
import { getSession } from "@/app/libs/auth";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: session.id,
        username: session.username,
        name: session.name,
        role: session.role,
        department: session.department,
      },
    });
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
