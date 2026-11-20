import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.DB_URI;
if (!uri) {
  console.error("Missing DB_URI in environment variables!");
}

export const client = new MongoClient(uri);

let db = null;

export async function connectDB() {
  if (db) return db;
  try {
    await client.connect();
    console.log("Connected to MongoDB cluster successfully!");
    db = client.db("hireloopdb");
    return db;
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    throw err;
  }
}

export function getDB() {
  if (!db) {
    db = client.db("hireloopdb");
  }
  return db;
}

export function getCollection(name) {
  return getDB().collection(name);
}

// Collections helper
export const collections = {
  users: () => getCollection("user"),
  jobs: () => getCollection("jobs"),
  companies: () => getCollection("companies"),
  applications: () => getCollection("applications"),
  savedJobs: () => getCollection("saved_jobs"),
  subscriptions: () => getCollection("subscriptions"),
  payments: () => getCollection("payments"),
};

// Helper to query by either custom 'id' or MongoDB '_id'
export function buildIdQuery(id) {
  if (!id) return {};
  if (ObjectId.isValid(id)) {
    return {
      $or: [
        { _id: new ObjectId(id) },
        { id: id }
      ]
    };
  }
  return { id: id };
}
