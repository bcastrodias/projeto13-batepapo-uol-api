import express from 'express';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
import joi from 'joi';

dotenv.config();
const app = express();
app.use(express.json());

const mongoClient = new MongoClient(process.env.DATABASE_URL);

try {
  await mongoClient.connect();
} catch (err) {
  console.log(err);
}

const db = mongoClient.db();

const authenticateUser = (req, res, next) => {
  const name = req.headers.user;
  if (!name) {
    return res.sendStatus(401);
  }
  next();
};

const validateName = (req, res, next) => {
  const nameSchema = joi.object({ name: joi.string().required() });
  const validation = nameSchema.validate(req.body);
  if (validation.error) {
    return res.status(422).send(validation.error);
  }
  next();
};

const validateMessage = (req, res, next) => {
  const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message', 'private_message').required(),
    from: joi.string().required()
  });
  const validation = messageSchema.validate(req.body, { abortEarly: false });
  if (validation.error) {
    return res.status(422).send(validation.error);
  }
  next();
};

app.post("/participants", validateName, async (req, res) => {
  try {
    const { name } = req.body;

    const users = await db.collection("participants").findOne({ name });
    if (users) {
      return res.status(409).send("Usuário já cadastrado");
    }

    await db.collection("participants").insertOne({
      name: name,
      lastStatus: Date.now()
    });

    await db.collection("messages").insertOne({
      from: name,
      to: 'Todos',
      text: "entra na sala...",
      type: 'status',
      time: dayjs().format("hh:mm:ss")
    });

    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get("/participants", async (_, res) => {
  try {
    res.send(await db.collection("participants").find().toArray());
  } catch (err) {
    return res.send(err.message);
  }
});

app.post("/messages", authenticateUser, validateMessage, async (req, res) => {
  try {
    const { to, text, type } = req.body;
    const from = req.headers.user;

    if (!await db.collection("participants").findOne({ name: from })) {
      return res.sendStatus(422);
    }

    await db.collection("messages").insertOne({
      to,
      text,
      type,
      from,
      time: dayjs().format("hh:mm:ss")
    });

    res.sendStatus(201);
  } catch (err) {
    return res.status(422).send(err.message);
  }
});

app.get("/messages", authenticateUser, async (req, res) => {
  try {
    const from = req.headers.user;
    let limit = req.query.limit;

    if (limit === undefined) {
      limit = 0;
    } else {
      if (isNaN(limit) || limit <= 0) {
        return res.sendStatus(422);
      }
    }

    const messages = await db.collection("messages").find({
      $or: [
        { type: 'message' },
        { type: 'status' },
        { type: "private_message", from },
        { type: "private_message", to: from }
      ]
    }).toArray();

    res.send(messages.slice(-limit).reverse());
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

app.post("/status", authenticateUser, async (req, res) => {
  try {
    const name = req.headers.user;
    if (await db.collection("participants").findOne({ name })) {
      await db.collection("participants").updateOne({ name }, { $set: { lastStatus: Date.now() } });
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    res.send(err);
  }
});

setInterval(async () => {
  try {
    const participants = await db.collection("participants").find().toArray();
    const afkParticipants = participants.filter((p) => {
      if (p.lastStatus < Date.now() - 10000) {
        db.collection("messages").insertOne({
          from: p.name,
          to: 'Todos',
          text: "sai da sala...",
          type: 'status',
          time: dayjs().format("hh:mm:ss")
        });
        return p;
      }
      else return null;
    }).map(p => p.name);

    await db.collection("participants").deleteMany({ name: { $in: afkParticipants } });
  } catch (err) {
    console.log(err);
  }
}, 15000);

app.listen(5000, () => console.log("Servidor conectado"));