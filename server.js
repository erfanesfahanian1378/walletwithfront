const express = require("express");
const path = require("path");
const app = express();
const csv = require("csv-parser");
const fs = require("fs");
const multer = require("multer");
const http = require("http");
const socketIo = require("socket.io");
const { main } = require("./index2");
const { master } = require("./master_process");

require("dotenv").config();

const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = socketIo(server);

app.get("/wallet", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "wallet.html"));
});

app.post("/wallet", async (req, res) => {
  const wallet = req.body.wallet;
  await main(wallet);

  const filePath = path.join(__dirname, "grouped_transactions.csv");
  if (fs.existsSync(filePath)) {
    res.download(filePath, "grouped_transactions.csv", (err) => {
      if (err) {
        console.log(err);
        res.status(500).send("Error downloading file");
      } else {
        console.log("File downloaded successfully");
      }
    });
  } else {
    res.status(500).send("Error file not found");
  }
});

app.get("/show-final-csv", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "show-csv.html"));
});

app.get("/get-final-csv", (req, res) => {
  const results = [];
  const filePath = path.join(__dirname, "final.csv");

  if (fs.existsSync(filePath)) {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => {
        res.json(results);
      });
  } else {
    res.json({});
  }
});

app.get("/win-rate", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "win-rate.html"));
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, __dirname);
  },
  filename: function (req, file, cb) {
    cb(null, "Solana Wallet Addresses - Projects (1) 2024-07-07 22_51_10.csv"); // Save as file.txt
  },
});

// Create multer instance with specified storage options
const upload = multer({ storage: storage });
const promises = [];

app.post("/win-rate", upload.single("file"), async (req, res) => {
  // get csv file from front
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const filePath = path.join(__dirname, "final.csv");

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  const minWinRate = req.body.minWinRate;
  const minProjects = req.body.minProjects;
  const roi = req.body.roi;
  const heliusApi = req.body.heliusApi;
  const day = req.body.day;

  process.env.WINRATE = minWinRate;
  process.env.TOTALTOKEN = minProjects;
  process.env.ROI = roi;
  process.env.HELIUS_KEY = heliusApi;
  process.env.DAY = day;

  // call master_process main
  console.log(process.env.HELIUS_KEY);
  console.log(  process.env.DAY);
  console.log("Started the master process");
  const promises = master(minWinRate, minProjects, roi, heliusApi);
  await Promise.all(promises);
  console.log("Finished the master process");

  res.send("Processed all wallets");
});

app.get("/stop-win-rate", (req, res) => {
  console.log("Stopping the win rate process");
  promises.forEach((promise) => {
    promise.cancel();
  });
  res.send("Stopped the win rate process");
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
