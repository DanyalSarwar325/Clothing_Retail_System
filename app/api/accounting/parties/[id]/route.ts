import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/libs/prisma";
import { getPartyStatement } from "@/app/libs/accounting/postingService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getPartyStatement(id);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const party = await prisma.party.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        normalizedName: body.name ? body.name.trim().toLowerCase() : undefined,
        type: body.type,
        phone: body.phone?.trim(),
        address: body.address?.trim(),
        notes: body.notes?.trim(),
        status: body.status,
      },
    });

    return NextResponse.json({ success: true, data: { ...party, _id: party.id } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
