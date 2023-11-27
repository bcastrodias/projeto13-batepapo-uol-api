import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import Joi from "joi";
import dotenv from "dotenv";
import dayjs from "dayjs";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());


const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect().then(() => {
    db = mongoClient.db(process.env.DATABASE);
});


const newParticipantSchema = Joi.object({
    name: Joi.string().required(),
});


const newMessageSchema = Joi.object({
    from: Joi.string().required(),
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().pattern(/^(private_message|message)$/),
    time: Joi.any()
});


app.listen(process.env.PORT, () => {
    console.log("Server running on port", process.env.PORT);
});


app.get("/participants", async (req, res) => {
    try {
        const users = await db.collection("users").find().toArray();
        res.send(users);
    } catch (error) {
        res.send(500);
    }})
