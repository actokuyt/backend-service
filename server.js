const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
const { Octokit } = require("octokit");
require("dotenv").config();

const app = express();

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Octokit with GitHub API token
const octokit = new Octokit({
  auth: process.env.GITHUB_API_TOKEN,
});

// Route for fetching GitHub user profile
app.post("/github-profiler", async (req, res) => {
  console.log(req.body);
  const { user_name } = req.body;

  try {
    // Make a request to GitHub API to get user information
    const response = await octokit.request("GET /users/{username}", {
      username: user_name,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    res.send(response.data);
  } catch (error) {
    console.error("GitHub API Error:", error.message);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Route for subscribing to newsletter using MailChimp
app.post("/newsletter", async (req, res) => {
  const { email_address } = req.body;

  // Prepare data for MailChimp API
  const data = {
    members: [{ email_address, status: "subscribed" }],
  };

  const jsonData = JSON.stringify(data);

  // Get MailChimp API key from environment variables
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const encodedApiKey = Buffer.from(`apikey:${apiKey}`).toString("base64");

  try {
    // Make a request to MailChimp API to subscribe the email
    const response = await axios.post(
      "https://us21.api.mailchimp.com/3.0/lists/f3efb70b2a",
      jsonData,
      {
        headers: {
          Authorization: `Basic ${encodedApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.send({ success: true });
  } catch (error) {
    console.error("MailChimp API Error:", error.message);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server Running on port ${PORT}`));
