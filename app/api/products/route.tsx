import prisma from "@/app/libs/prisma";

/**
 * CREATE PRODUCT
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.name || typeof body.name !== "string") {
      return Response.json(
        { error: "Name is required and must be a string" },
        { status: 400 }
      );
    }

    if (!body.type || typeof body.type !== "string") {
      return Response.json(
        { error: "Type is required and must be a string" },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        name: body.name,
        type: body.type,
        status: body.status || "checked-in",
      },
    });

    return Response.json(
      {
        productId: product.id,
        _id: product.id,
        message: "Product created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/products error:", error);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * GET ALL PRODUCTS
 */
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    });

    const formatted = products.map((p) => ({
      ...p,
      _id: p.id,
    }));

    return Response.json(formatted);
  } catch (error) {
    console.error("GET /api/products error:", error);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
