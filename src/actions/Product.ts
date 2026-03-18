import { connectToDatabase } from "@/libs/connectToDb";
import Product from "@/models/Product";

export async function getProduct() {
  await connectToDatabase();
  const products = await Product.find({});
  return products;
}
