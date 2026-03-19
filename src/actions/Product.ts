import { connectToDatabase } from "@/lib/connectToDb";
import Product from "@/models/Product";
import mongoose from "mongoose";
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

export const getSimilarProducts = async function getSimilarProducts(
  excludeId: string,
  limit: number = 4,
) {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  await connectToDatabase();
  let excludeOid: mongoose.Types.ObjectId | null = null;
  try {
    excludeOid = new mongoose.Types.ObjectId(excludeId);
  } catch {
    /* invalid id */
  }

  const products = await Product.find(
    excludeOid
      ? {
          _id: { $gt: excludeOid },
          image: { $exists: true, $not: { $size: 0 } },
        }
      : { image: { $exists: true, $not: { $size: 0 } } },
  )
    .sort({ _id: 1 })
    .limit(limit)
    .lean();

  return JSON.parse(JSON.stringify(products));
};

export async function getAllProductIds(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  await connectToDatabase();
  const products = await Product.find({}, { _id: 1 }).lean();
  return products.map((p) => String(p._id));
}
