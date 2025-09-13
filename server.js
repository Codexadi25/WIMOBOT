const express = require('express');
const http = require('http');

const app = express();

app.get("/", (req, res) => {;
  res.redirect(`https://codexadi25.github.io/WIMOBOT/`)
});
