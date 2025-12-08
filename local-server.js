// local-server.js
require('dotenv').config(); // optional since index.js already loads env, but harmless
const mongoose = require("mongoose");
const app = require("./index");

const PORT = process.env.PORT || 5000;

function startHttpServer() {
  app.listen(PORT, () => {
    console.log(`Local server started on port ${PORT}`);
  });
}

if (mongoose.connection.readyState === 1) {
  // Already connected
  startHttpServer();
} else {
  // Wait for mongoose to connect (index.js initiates connection)
  mongoose.connection.on("connected", startHttpServer);
  // Fallback in case the connection fails or takes too long
  mongoose.connection.on("error", (err) => {
    console.error("Mongoose connection error:", err.message);
  });
}