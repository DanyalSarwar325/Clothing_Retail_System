import { log } from "console";
import { AnyARecord } from "dns";
import { MongoClient, ObjectId } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);

export default async function ProductPage (params) {
  const { id } = params;
  console.log(id); 
  await client.connect();
  const db = client.db("barcodeDB");

  const product = await db.collection("products").findOne({
    _id: ,
  });

  if (!product) return <h2>Product Not Found</h2>;

  return (
    <div>
      <h1>{product.name}</h1>
      <p>Type: {product.type}</p>
    </div>
  );
}
