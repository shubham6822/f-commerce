import { cache } from "react";
import { connectToDatabase } from "@/libs/connectToDb";
import Product from "@/models/Product";

export const getProduct = async function getProduct() {
  await connectToDatabase();
  const products = await Product.find({}).limit(100);
  return products;
};
