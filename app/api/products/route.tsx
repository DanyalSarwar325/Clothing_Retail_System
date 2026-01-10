import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);

export async function POST(req) {
  const body = await req.json();
  await client.connect();

  const db = client.db("barcodeDB");
  const result = await db.collection("products").insertOne({
    name: body.name,
    type: body.type,
    createdAt: new Date(),
  });

  return Response.json({
    productId: result.insertedId.toString(),
  });
}
