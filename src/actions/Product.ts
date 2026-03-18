import { connectToDatabase } from "@/lib/connectToDb";
import Product from "@/models/Product";
import { cacheLife, cacheTag } from "next/cache";

export const getProduct = async function getProduct() {
  "use cache";
  cacheLife("days");
  cacheTag("products");
  await connectToDatabase();
  const products = await Product.find({}).limit(100).lean();
  return JSON.parse(JSON.stringify(products));
};

export const getProductById = async function getProductById(id: string) {
  "use cache";
  cacheLife("days");
  cacheTag("products");
  await connectToDatabase();
  const product = await Product.findById(id).lean();
  return JSON.parse(JSON.stringify(product));
};
