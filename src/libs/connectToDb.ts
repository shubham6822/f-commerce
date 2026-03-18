import mongoose from "mongoose";

let isConnected: boolean = false;

export const connectToDatabase = async () => {
  mongoose.set("strictQuery", true);

  if (!process.env.MONGO_URL) {
    throw new Error("MONGODB_URL is missing in .env file");
  }

  if (!process.env.DB_NAME) {
    throw new Error("DB_NAME is missing in .env file");
  }

  if (isConnected) {
    console.log("=> using existing database connection");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URL as string, {
      dbName: process.env.DB_NAME,
    });
    console.log("=> database connection established");
    isConnected = true;
  } catch (error) {
    console.error("Error connecting to database: ", error);
    return;
  }
};
