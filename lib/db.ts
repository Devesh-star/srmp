import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/srmp";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState >= 1) {
    cached.conn = mongoose;
    return cached.conn;
  }

  if (!cached.promise) {
    const uri = (process.env.MONGODB_URI && process.env.MONGODB_URI !== "placeholder_uri")
      ? process.env.MONGODB_URI
      : MONGODB_URI;

    cached.promise = mongoose
      .connect(uri)
      .then((mongooseInstance) => {
        return mongooseInstance;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
