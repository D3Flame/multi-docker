const {
  pgDatabase,
  pgHost,
  pgPassword,
  pgPort,
  pgUser,
  redisHost,
  redisPort,
} = require("./keys");

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const redis = require("redis");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const { Pool } = require("pg");
const pgClient = new Pool({
  user: pgUser,
  host: pgHost,
  database: pgDatabase,
  password: pgPassword,
  port: pgPort,
});

pgClient.on("error", () => console.log("Lost PG connection"));

pgClient.on("connect", async (client) => {
  try {
    await client.query("CREATE TABLE IF NOT EXISTS values (number INT)");
  } catch (err) {
    console.error(err);
  }
});

const redisClient = redis.createClient({
  host: redisHost,
  port: redisPort,
  retry_strategy: () => 1000,
});
const redisPublisher = redisClient.duplicate();

app.get("/", (_, res) => {
  res.send("Hi");
});

app.get("/values/all", async (_, res) => {
  const values = await pgClient.query("SELECT * from values");
  res.send(values.rows);
});

app.get("/values/current", async (_, res) => {
  redisClient.hgetall("values", (_, values) => {
    res.send(values);
  });
});

app.post("/values", async (req, res) => {
  const index = req.body.index;
  if (index > 40) {
    return res.status(422).send("Index too high");
  }

  redisClient.hset("values", index, "Nothing yet!");
  redisPublisher.publish("insert", index);
  pgClient.query("INSERT INTO values(number) VALUES($1)", [index]);

  res.send({ working: true });
});

app.listen(5000, (_) => {
  console.log("Listening");
});
