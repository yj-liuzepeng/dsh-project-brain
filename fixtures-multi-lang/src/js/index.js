// fixtures-multi-lang/src/js/index.js
const express = require("express");
const { handleUser } = require("./user");

const app = express();

app.get("/api/users", handleUser);
app.post("/api/users", handleUser);

module.exports = { app };
