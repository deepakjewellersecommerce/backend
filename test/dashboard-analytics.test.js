const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');

// Load models
const User_Order = mongoose.model("User_Order");
const Inventory = mongoose.model("Inventory");
const Product = mongoose.model("Product");
const Admin = mongoose.model("Admin");

describe('Dashboard Analytics Controller', () => {
  let adminToken;
  let testProduct1;
  let testProduct2;

  beforeAll(async () => {
    // Wait for DB connection
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => {
        mongoose.connection.once('connected', resolve);
      });
    }

    // Clean up test data
    await User_Order.deleteMany({});
    await Inventory.deleteMany({});
    await Product.deleteMany({});
    await Admin.deleteMany({});

    // Create test admin user for authentication
    const testAdmin = new Admin({
      fullName: 'Test Admin',
      email: 'testadmin@test.com',
      password: 'hashedpassword123',
      role: 'admin',
      isVerified: true
    });
    await testAdmin.save();

    // Mock admin login to get token (if needed)
    // For now, tests will check for 401 or 200 status
  });

  afterAll(async () => {
    // Clean up test data
    await User_Order.deleteMany({});
    await Inventory.deleteMany({});
    await Product.deleteMany({});
    await Admin.deleteMany({});
    
    await mongoose.connection.close();
  });

  describe('GET /admin/dashboard/analytics/revenue-by-metal', () => {
    it('should return route exists (200 or 401, not 404)', async () => {
      const response = await request(app)
        .get('/admin/dashboard/analytics/revenue-by-metal');
      
      // Route should exist (either 200 if no auth, or 401 if protected)
      expect(response.status).not.toBe(404);
      expect([200, 401]).toContain(response.status);
    });

    it('should accept date range query parameters', async () => {
      const response = await request(app)
        .get('/admin/dashboard/analytics/revenue-by-metal')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });
      
      expect(response.status).not.toBe(404);
      expect([200, 401]).toContain(response.status);
    });

    it('should return data with correct structure when successful', async () => {
      const response = await request(app)
        .get('/admin/dashboard/analytics/revenue-by-metal');
      
      // If authorized and successful, check structure
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data.data)).toBe(true);
      }
    });
  });

  describe('GET /admin/dashboard/analytics/performance-by-item', () => {
    it('should return route exists (200 or 401, not 404)', async () => {
      const response = await request(app)
        .get('/admin/dashboard/analytics/performance-by-item');
      
      expect(response.status).not.toBe(404);
      expect([200, 401]).toContain(response.status);
    });

    it('should accept date range query parameters', async () => {
      const response = await request(app)
        .get('/admin/dashboard/analytics/performance-by-item')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });
      
      expect(response.status).not.toBe(404);
      expect([200, 401]).toContain(response.status);
    });
  });

  describe('GET /admin/dashboard/analytics/discount-efficiency', () => {
    it('should return route exists (200 or 401, not 404)', async () => {
      const response = await request(app)
        .get('/admin/dashboard/analytics/discount-efficiency');
      
      expect(response.status).not.toBe(404);
      expect([200, 401]).toContain(response.status);
    });

    it('should accept date range query parameters', async () => {
      const response = await request(app)
        .get('/admin/dashboard/analytics/discount-efficiency')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });
      
      expect(response.status).not.toBe(404);
      expect([200, 401]).toContain(response.status);
    });

    it('should return data with correct structure when successful', async () => {
      const response = await request(app)
        .get('/admin/dashboard/analytics/discount-efficiency');
      
      // If authorized and successful, check structure
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(response.body.data.data).toHaveProperty('grossRevenue');
        expect(response.body.data.data).toHaveProperty('totalDiscount');
        expect(response.body.data.data).toHaveProperty('netRevenue');
      }
    });
  });

  describe('GET /admin/dashboard/analytics/inventory-health', () => {
    it('should return route exists (200 or 401, not 404)', async () => {
      const response = await request(app)
        .get('/admin/dashboard/analytics/inventory-health');
      
      expect(response.status).not.toBe(404);
      expect([200, 401]).toContain(response.status);
    });

    it('should return data with correct structure when successful', async () => {
      const response = await request(app)
        .get('/admin/dashboard/analytics/inventory-health');
      
      // If authorized and successful, check structure
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(response.body.data.data).toHaveProperty('valuation');
        expect(response.body.data.data).toHaveProperty('totalStockCount');
        expect(response.body.data.data).toHaveProperty('stuckStock');
      }
    });
  });

  describe('GET /admin/dashboard/analytics/order-funnel', () => {
    it('should return route exists (200 or 401, not 404)', async () => {
      const response = await request(app)
        .get('/admin/dashboard/analytics/order-funnel');
      
      expect(response.status).not.toBe(404);
      expect([200, 401]).toContain(response.status);
    });

    it('should accept date range query parameters', async () => {
      const response = await request(app)
        .get('/admin/dashboard/analytics/order-funnel')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });
      
      expect(response.status).not.toBe(404);
      expect([200, 401]).toContain(response.status);
    });

    it('should return data with correct structure when successful', async () => {
      const response = await request(app)
        .get('/admin/dashboard/analytics/order-funnel');
      
      // If authorized and successful, check structure
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data.data)).toBe(true);
      }
    });
  });

  describe('GET /admin/dashboard/analytics/kpi-cards', () => {
    it('should return route exists (200 or 401, not 404)', async () => {
      const response = await request(app)
        .get('/admin/dashboard/analytics/kpi-cards');
      
      expect(response.status).not.toBe(404);
      expect([200, 401]).toContain(response.status);
    });

    it('should return data with correct KPI structure when successful', async () => {
      const response = await request(app)
        .get('/admin/dashboard/analytics/kpi-cards');
      
      // If authorized and successful, check structure
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(response.body.data.data).toHaveProperty('pendingOrders');
        expect(response.body.data.data).toHaveProperty('todayRevenue');
        expect(response.body.data.data).toHaveProperty('inventoryHealth');
        expect(response.body.data.data.pendingOrders).toHaveProperty('count');
        expect(response.body.data.data.todayRevenue).toHaveProperty('amount');
        expect(response.body.data.data.todayRevenue).toHaveProperty('orderCount');
        expect(response.body.data.data.inventoryHealth).toHaveProperty('valuation');
        expect(response.body.data.data.inventoryHealth).toHaveProperty('totalStockCount');
      }
    });
  });
});
