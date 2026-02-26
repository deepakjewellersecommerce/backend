// local-server.js
require('dotenv').config();
const mongoose = require("mongoose");
const app = require("./index");
const cacheService = require("./services/cache.service");

const PORT = process.env.PORT || 5000;
let server;

function startHttpServer() {
  server = app.listen(PORT, () => {
    console.log(`Local server started on port ${PORT}`);
  });

  // Keep-alive timeout should be higher than any reverse proxy timeout
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

// ==================== GRACEFUL SHUTDOWN ====================

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // 1. Stop accepting new connections
  if (server) {
    server.close(() => {
      console.log("HTTP server closed — no new connections accepted.");
    });
  }

  // 2. Allow in-flight requests to finish (max 10 seconds)
  const forceExitTimeout = setTimeout(() => {
    console.error("Graceful shutdown timed out after 10s — forcing exit.");
    process.exit(1);
  }, 10000);

  try {
    // 3. Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("MongoDB connection closed.");
    }

    // 4. Close Redis connection
    if (cacheService.redis && cacheService.isConnected) {
      await cacheService.redis.quit();
      console.log("Redis connection closed.");
    }
  } catch (err) {
    console.error("Error during shutdown:", err.message);
  }

  clearTimeout(forceExitTimeout);
  console.log("Graceful shutdown complete.");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ==================== START SERVER ====================

if (mongoose.connection.readyState === 1) {
  // Already connected
  startHttpServer();
} else {
  // Wait for mongoose to connect (index.js initiates connection)
  mongoose.connection.on("connected", startHttpServer);
  mongoose.connection.on("error", (err) => {
    console.error("Mongoose connection error:", err.message);
  });
}
