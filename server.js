const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Routes for the main pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'contact.html'));
});

app.get('/customize', (req, res) => {
  res.sendFile(path.join(__dirname, 'customize.html'));
});

app.get('/inventory', (req, res) => {
  res.sendFile(path.join(__dirname, 'inventory.html'));
});

app.listen(port, () => {
  console.log(`LuxHaas Motors server running at http://localhost:${port}`);
});