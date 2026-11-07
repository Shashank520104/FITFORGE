import mongoose from "mongoose";

export async function connectDB(
  mongoUri = process.env.MONGODB_URI,
): Promise<void> {
  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing from environment variables");
  }

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
