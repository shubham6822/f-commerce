import mongoose, { Document, Schema } from "mongoose";

export interface IProduct extends Document {
  uniq_id: string;
  crawl_timestamp: string;
  product_url: string;
  product_name: string;
  product_category_tree: string[];
  pid: string;
  retail_price: number;
  discounted_price: number;
  image: string[];
  is_FK_Advantage_product: boolean;
  description: string;
  product_rating: string;
  overall_rating: string;
  brand: string;
  product_specifications: string;
}

const ProductSchema = new Schema<IProduct>({
  uniq_id: { type: String },
  crawl_timestamp: { type: String },
  product_url: { type: String },
  product_name: { type: String },
  product_category_tree: [{ type: String }],
  pid: { type: String },
  retail_price: { type: Number },
  discounted_price: { type: Number },
  image: [{ type: String }],
  is_FK_Advantage_product: { type: Boolean },
  description: { type: String },
  product_rating: { type: String },
  overall_rating: { type: String },
  brand: { type: String },
  product_specifications: { type: String },
});

const Product =
  mongoose.models.Product ||
  mongoose.model<IProduct>("Product", ProductSchema, "product");

export default Product;
