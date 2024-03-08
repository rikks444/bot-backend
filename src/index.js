const teleBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(
  cors({
    origin: "*",
  })
);

// Connect to MongoDB
mongoose.connect(
  "mongodb+srv://rikkx:00GipAAOtWrPnvN4@cluster0.ymjfbdo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  { useNewUrlParser: true, useUnifiedTopology: true }
);

// Define MongoDB schema and model for user information
const userSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  name: String,
  city: String,
  country: String,
  isBlocked: Boolean,
});

// Define MongoDB schema and model for admin settings
const adminSchema = new mongoose.Schema({
  apiKey: String,
  frequency: Number,
});

const Admin = mongoose.model("Admin", adminSchema);

const User = mongoose.model("User", userSchema);

require("dotenv").config();

const TOKEN = process.env.TOKEN;

const bot = new teleBot(TOKEN, { polling: true });

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Check if the user exists in the database
  const existingUser = await User.findOne({ chatId });

  if (!existingUser) {
    // If the user does not exist, save their information
    const newUser = new User({ chatId, isBlocked: false });
    await newUser.save();

    bot.sendMessage(chatId, "Thanks! Now, please provide your name:");
  } else if (!existingUser.name) {
    // If the user exists but city information is missing
    existingUser.name = text;
    await existingUser.save();

    bot.sendMessage(chatId, "Great! Now, please provide your city:");
  } else if (!existingUser.city) {
    // If the user exists but city information is missing
    existingUser.city = text;
    await existingUser.save();

    bot.sendMessage(chatId, "Great! Now, please provide your country:");
  } else if (!existingUser.country) {
    // If the user exists but country information is missing
    existingUser.country = text;
    await existingUser.save();

    bot.sendMessage(chatId, "Thank you! You are now registered.");
  }
});
const weatherApiKey = "d40f09b1c303f225924f3ccaa92c4161";

// ...

// Set up a daily weather update job

let currentIntervalId = null;

function sendNotification(freq) {
  currentIntervalId = setInterval(async () => {
    const users = await User.find();

    for (const user of users) {
      try {
        // Fetch weather data for the user's city and country

        if (user.isBlocked) {
          continue;
        }

        const response = await axios.get(
          `http://api.openweathermap.org/data/2.5/weather?q=${user.city},${user.country}&appid=${weatherApiKey}`
        );

        const weatherDescription = response.data.weather[0].description;
        const temperature = response.data.main.temp;

        // Send weather update to the user
        bot.sendMessage(
          user.chatId,
          `Good morning! Current weather in ${user.city}, ${user.country}: ${weatherDescription}. Temperature: ${temperature}°C`
        );
      } catch (error) {
        console.error(
          `Error sending weather update to ${user.chatId}: ${error.message}`
        );
      }
    }
  }, freq);
}

clearInterval(currentIntervalId);
sendNotification(5000);

// apis

app.get("/users", async (req, res) => {
  const users = await User.find();

  res.json({ users });
});

app.get("/admin/settings", async (req, res) => {
  const settings = await Admin.find();
  if (settings.length === 0) {
    const settings = new Admin({ apiKey: weatherApiKey, frequency: 5000 });
    await settings.save();
    res.json({ settings });
    return;
  }

  res.json({ settings });
});

// Endpoint for updating message frequency
app.post("/admin/settings", async (req, res) => {
  const { apiKey, frequency } = req.body;

  // Update message frequency in the database
  await Admin.findOneAndUpdate({}, { apiKey, frequency });

  clearInterval(currentIntervalId);
  sendNotification(frequency);

  res.json({ success: true });
});

// Endpoint for blocking/deleting users
app.post("/admin/blockuser", async (req, res) => {
  const { chatId, isBlocked } = req.body;

  await User.findOneAndUpdate({ chatId }, { isBlocked });

  res.json({ success: true });
});

app.post("/admin/deleteuser", async (req, res) => {
  const { chatId } = req.body;
  await User.findOneAndDelete({ chatId });
  res.json({ success: true });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
