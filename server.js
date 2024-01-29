const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
const { Pool } = require("pg");
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

const pool = new Pool({
  user: "acto",
  host: "dpg-cmrl1pen7f5s738jqh6g-a.frankfurt-postgres.render.com",
  database: "todo_app_b1u0",
  password: "DNLatjmq6J5CEcXVmgvCB93Dj3X4yJXd",
  port: 5432,
  ssl: true,
});

pool.connect();

// Test route to ensure server is active
app.get("/", async (req, res) => {
  res.send("server is active")
})

// Routes for GitHub-profiler
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

// Routes for todo-app-v2
// Get all todos
app.get("/todos", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM todos");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching todos:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add a new todo
app.post("/todos", async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text is required for a todo." });
  }

  try {
    const result = await pool.query(
      "INSERT INTO todos (text) VALUES ($1) RETURNING *",
      [text]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error adding todo:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update todo route
app.put("/todos/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid todo ID." });
  }

  const newText = req.body.text;

  try {
    let result;

    if (newText !== undefined) {
      // Update the text of the todo
      result = await pool.query(
        "UPDATE todos SET text = $1 WHERE id = $2 RETURNING *",
        [newText, id]
      );
    } else if (newText === undefined) {
      //get requested todo
      const requestedTodo = await pool.query(
        "SELECT * FROM todos WHERE id = $1",
        [id]
      );

      //get current state
      currentState = requestedTodo.rows[0].completed;

      const newState = !currentState;

      //set new state in database
      result = await pool.query(
        "UPDATE todos SET completed = $1 WHERE id = $2 RETURNING *",
        [newState, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Todo not found." });
      }
    } else {
      return res.status(400).json({ error: "Invalid request" });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Todo not found" });
    }

    // Return the updated todo
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating todo:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete a todo
app.delete("/todos/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid todo ID." });
  }

  try {
    const result = await pool.query(
      "DELETE FROM todos WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Todo not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error deleting todo:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server Running on port ${PORT}`));
