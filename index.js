import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

// const express = require('express');
const app = express();
const port = process.env.PORT || 5000;

//middlewares
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.DB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    throw err;
  }
}

const connectedClient = await connectToMongoDB();
const database = connectedClient.db("hireloopdb");
const userCollection = database.collection("user");



app.get('/', (req, res) => {
  res.send('Hireloop is looping!');
});

app.get('/users', async (req, res) => {
  const cursor = userCollection.find({});
  const result = await cursor.toArray();
  res.send(result);
});

app.listen(port, () => {
  console.log(`app is running at port ${port}`);
});