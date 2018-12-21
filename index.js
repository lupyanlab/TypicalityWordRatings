// Dependencies
const express = require("express");
const path = require("path");
const PythonShell = require("python-shell");
const fs = require("fs");
const csvWriter = require("csv-write-stream");
const _ = require("lodash");
const bodyParser = require("body-parser");
const csv = require("csvtojson");

let app = express();
let writer = csvWriter({ sendHeaders: false });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.set("port", process.env.PORT || 7100);

// Add headers
app.use(function(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); // HTTP 1.1.
  res.setHeader("Pragma", "no-cache"); // HTTP 1.0.
  res.setHeader("Expires", "0"); // Proxies.
  next();
});

// For Rendering HTML
app.get("/", function(req, res) {
  res.sendFile(path.join(__dirname + "/dev/index.html"));
});
app.use(express.static(__dirname + "/dev"));

app.listen(app.get("port"), function() {
  console.log("Node app is running at http://localhost:" + app.get("port"));
});

let batchesCount = { dev: {}, prod: {} };

// create a new file to store category counts
const batchesCountDevPath = "batchesCounts.dev.csv";
const batchesCountProdPath   = "batchesCounts.prod.csv";

if (!fs.existsSync(path.join("./demographics"))) {
  fs.mkdirSync(path.join("./demographics"));
}

if (!fs.existsSync(path.join("./trials"))) {
  fs.mkdirSync(path.join("./trials"));
}

if (!fs.existsSync(path.join("./data"))) {
  fs.mkdirSync(path.join("./data"));
}

if (fs.existsSync(batchesCountDevPath)) {
  // Read existing category counts if csv exists.
  csv()
    .fromFile(batchesCountDevPath)
    .on("json", jsonObj => {
      batchesCount.dev = jsonObj;
    })
    .on("done", error => {
      if (error) throw error;
      console.log(batchesCount.dev);
    });
} else {
  // Create new csv of category counts if doesn't exist.
  // Get all categories from image folders.
  fs.readdirSync(path.join("word_to_rate"), { withFileTypes: true }).forEach(file => {
    // Check for image folders that are non-empty
    batchesCount.dev[path.join('word_to_rate', file.name)] = 0;
  });
  writer = csvWriter({ headers: Object.keys(batchesCount.dev) });
  writer.pipe(fs.createWriteStream(batchesCountDevPath, { flags: "a" }));
  writer.write(batchesCount.dev);
  writer.end();
}

if (fs.existsSync(batchesCountProdPath)) {
  // Read existing category counts if csv exists.
  csv()
    .fromFile(batchesCountProdPath)
    .on("json", jsonObj => {
      batchesCount.prod = jsonObj;
    })
    .on("done", error => {
      if (error) throw error;
      console.log(batchesCount.prod);
    });
} else {
  // Create new csv of category counts if doesn't exist.
  // Get all categories from image folders.
  fs.readdirSync("word_to_rate").forEach(file => {
    batchesCount.prod[file] = 0;
  });
  writer = csvWriter({ headers: Object.keys(batchesCount.prod) });
  writer.pipe(fs.createWriteStream(batchesCountProdPath, { flags: "a" }));
  writer.write(batchesCount.prod);
  writer.end();
}

// POST endpoint for requesting trials
app.post("/trials", function(req, res) {
  console.log("trials post request received");

  let subjCode = req.body.subjCode;
  let numTrials = req.body.numTrials;
  let numPics = req.body.numPics || 17;
  let reset = req.body.reset;
  const dev = req.body.dev == true;
  const env = dev ? "dev" : "prod";
  console.log(`Trials Environment: ${env}`);
  console.log(req.body);

  const batchesCountPath = dev
    ? batchesCountDevPath
    : batchesCountProdPath;
  const trialsPath = path.join(__dirname, "trials/", `${subjCode}_trials.csv`);
  const dataPath = path.join(__dirname, "data", `${subjCode}_data.csv`);

  // subject is not finished
  // Read from already collected data
  // Read trials file
  // Send filtered trials to client
  if (fs.existsSync(dataPath) && reset == "false") {
    console.log("Grabbing unfinished trials");
    const completedWords = new Set();
    const trials = [];
    csv()
      .fromFile(dataPath)
      .on("json", jsonObj => {
        completedWords.add(jsonObj.word);
      })
      .on("done", error => {
        csv()
          .fromFile(trialsPath)
          .on("json", jsonObj => {
            !completedWords.has(jsonObj.word) && trials.push(jsonObj);
          })
          .on("done", error => {
            res.send({ success: true, trials });
          });
      });
  }
  // new subject or needs to reset trial data
  // Copy batch file to trials folder with subjectCode in filename
  // Send batch file data to client as json
  else {
    console.log("Creating new trials");

    // removes existing data files if resetting
    if (reset == "true") {
      if (fs.existsSync(trialsPath)) fs.unlinkSync(trialsPath);
      if (fs.existsSync(dataPath)) fs.unlinkSync(dataPath);
    }

    const batchFile = Object.entries(batchesCount[env]).reduce((a, c) =>
      Number(a[1]) < Number(c[1]) ? a : c
    )[0];

    fs.copyFileSync(batchFile, trialsPath);

    const trials = [];
    csv()
      .fromFile(trialsPath)
      .on("json", jsonObj => {
        trials.push(jsonObj);
      })
      .on("done", error => {
        batchesCount[env][batchFile] = String(
          Number(batchesCount[env][batchFile]) + 1
        );

        writer = csvWriter({ headers: Object.keys(batchesCount[env]) });
        writer.pipe(fs.createWriteStream(batchesCountPath, { flags: "a" }));
        writer.write(batchesCount[env]);
        writer.end();

        console.log(trials);
        res.send({ success: true, trials });
      });
  }
});

// POST endpoint for receiving trial responses
app.post("/data", function(req, res) {
  console.log("data post request received");

  // Parses the trial response data to csv
  let response = req.body;
  console.log(response);
  let path = "data/" + response.subjCode + "_data.csv";
  let headers = Object.keys(response);
  if (!fs.existsSync(path)) writer = csvWriter({ headers: headers });
  else writer = csvWriter({ sendHeaders: false });

  writer.pipe(fs.createWriteStream(path, { flags: "a" }));
  writer.write(response);
  writer.end();

  res.send({ success: true });
});

// POST endpoint for receiving trial responses
app.post("/demographics", function(req, res) {
  console.log("demographics post request received");

  // Parses the trial response data to csv
  let demographics = req.body;
  console.log(demographics);
  let path = "demographics/" + demographics.subjCode + "_demographics.csv";
  let headers = Object.keys(demographics);
  writer = csvWriter({ headers: headers });

  writer.pipe(fs.createWriteStream(path, { flags: "w" }));
  writer.write(demographics);
  writer.end();

  res.send({ success: true });
});
