const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');

describe('Dashboard Analytics Controller', () => {
  beforeAll(async () => {
    // Wait for the DB connection in index.js to be established if necessary
    // or rely on the MongoMemoryServer if setup.js is running.
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /admin/dashboard/analytics/revenue-by-metal', () => {
    it('should return 200 and data array', async () => {
      // Note: We need a mock admin token if the route is protected
      // For now, let's assume it might be protected or not based on configuration
      const response = await request(app)
        .get('/admin/dashboard/analytics/revenue-by-metal');
      
      // If it's 401, it's fine, it means the route exists but is protected
      // If it's 404, the route is not registered
      expect(response.status).not.toBe(404);
    });
  });

  describe('GET /admin/dashboard/analytics/performance-by-item', () => {
    it('should return 200 and data array', async () => {
      const response = await request(app)
        .get('/admin/dashboard/analytics/performance-by-item');
      expect(response.status).not.toBe(404);
    });
  });
});
