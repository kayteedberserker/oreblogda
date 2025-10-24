// lib/db.js
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGO_URI);
const dbName = "blogDB";

export async function getPostsFromDB() {
  await client.connect();
  const db = client.db(dbName);
  const posts = await db.collection("posts").find({}).sort({ createdAt: -1 }).toArray();
  return posts;
}
