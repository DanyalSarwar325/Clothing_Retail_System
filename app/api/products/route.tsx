import DbConnect from "@/app/libs/dbConnect";
import Product from "@/app/libs/models/product";

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

    await DbConnect();

    const product = await Product.create({
      name: body.name,
      type: body.type,
      createdAt: new Date(),
      status: "checked-in",
    });

    return Response.json(
      {
        productId: product._id.toString(),
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
    await DbConnect();

    const products = await Product.find({}).sort({ createdAt: -1 });

    return Response.json(products);
  } catch (error) {
    console.error("GET /api/products error:", error);
    return Response.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
