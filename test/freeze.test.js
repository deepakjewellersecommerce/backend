const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

let app;
let server;

const Admin = mongoose.model('Admin');
const Material = mongoose.model('Material');
const Gender = mongoose.model('Gender');
const Item = mongoose.model('Item');
const Category = mongoose.model('Category');
const Subcategory = mongoose.model('Subcategory');
const PriceComponent = mongoose.model('PriceComponent');
const SubcategoryPricing = require('../models/subcategory-pricing.model');
const Product = mongoose.model('Product');
const MetalPrice = mongoose.model('MetalPrice');
const Job = require('../models/job.model');

beforeAll(async () => {
  // require app after process.env has been set by setup
  app = require('../index');
  // wait for mongoose to connect
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => mongoose.connection.once('connected', resolve));
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('Freeze preview and apply', () => {
  let adminToken;
  let adminId;
  let subcategoryId;

  beforeEach(async () => {
    // clear DB
    await mongoose.connection.db.dropDatabase();

    // create admin and token
    const admin = await Admin.create({ name: 'Test Admin', email: 'a@a.com', password: 'pw' });
    adminId = admin._id;
    adminToken = jwt.sign({ _id: adminId }, process.env.JWT_SECRET_ADMIN);

    // create metal price
    await MetalPrice.create({ metalType: 'GOLD_22K', pricePerGram: 5000, source: 'MANUAL', updatedBy: 'test' });

    // create material/gender/item/category/subcategory
    const material = await Material.create({ name: 'Gold(22K)', idAttribute: 'G22', metalType: 'GOLD_22K' });
    const gender = await Gender.create({ name: 'Female', idAttribute: 'F' });
    const item = await Item.create({ name: 'Necklace', idAttribute: 'N' });
    const category = await Category.create({ name: 'Test Cat', idAttribute: 'T', materialId: material._id, genderId: gender._id, itemId: item._id });

    const sub = await Subcategory.create({ name: 'Sub', idAttribute: 'SI', categoryId: category._id, materialId: material._id, genderId: gender._id, itemId: item._id });
    subcategoryId = sub._id;

    // create a system price component
    await PriceComponent.create({ name: 'Metal Cost', key: 'metal_cost', calculationType: 'PER_GRAM', defaultValue: 1, isSystemComponent: true });

    // create default pricing for subcategory
    await SubcategoryPricing.createDefault(subcategoryId, 'tester');

    // create products
    for (let i = 0; i < 5; i++) {
      await Product.create({ productTitle: `P${i}`, productSlug: `p${i}`, skuNo: `SKU${i}`, subcategoryId: subcategoryId, grossWeight: 5 + i, netWeight: 4 + i, metalType: 'GOLD_22K', pricingMode: 'SUBCATEGORY_DYNAMIC', isActive: true });
    }
  });

  test('preview freeze returns frozenValue and previews', async () => {
    const res = await request(app)
      .post(`/admin/subcategories/${subcategoryId}/pricing/components/metal_cost/freeze?preview=true`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sampleType: 'median' });

    expect(res.status).toBe(200);
    expect(res.body.data.frozenValue).toBeDefined();
    expect(Array.isArray(res.body.data.sampleProductPreviews)).toBe(true);
    expect(res.body.data.affectedCount).toBe(5);
  });

  test('apply freeze persists history and recalculates products sync', async () => {
    const resPreview = await request(app)
      .post(`/admin/subcategories/${subcategoryId}/pricing/components/metal_cost/freeze?preview=true`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sampleType: 'median' });

    const frozenValue = resPreview.body.data.frozenValue;

    const resApply = await request(app)
      .patch(`/admin/subcategories/${subcategoryId}/pricing/components/metal_cost/freeze`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sampleType: 'median', reason: 'lock for price' });

    expect(resApply.status).toBe(200);
    expect(resApply.body.data.recalculation.mode).toBe('sync');

    // verify freeze history
    const pricing = await SubcategoryPricing.findOne({ subcategoryId });
    const last = pricing.freezeHistory[pricing.freezeHistory.length - 1];
    expect(last.action).toBe('freeze');
    expect(last.frozenValue).toBeDefined();
    expect(last.freezeContext).toBeDefined();

    // check that products have calculatedPrice updated
    const prod = await Product.findOne({ subcategoryId });
    expect(prod.calculatedPrice).toBeDefined();
  });

  test('apply freeze creates background job for large sets', async () => {
    // create many products to force background path
    for (let i = 0; i < 250; i++) {
      await Product.create({ productTitle: `B${i}`, productSlug: `b${i}`, skuNo: `BSKU${i}`, subcategoryId: subcategoryId, grossWeight: 5, netWeight: 4, metalType: 'GOLD_22K', pricingMode: 'SUBCATEGORY_DYNAMIC', isActive: true });
    }

    const resApply = await request(app)
      .patch(`/admin/subcategories/${subcategoryId}/pricing/components/metal_cost/freeze`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sampleType: 'median', reason: 'lock bulk' });

    expect(resApply.status).toBe(200);
    expect(resApply.body.data.recalculation.mode).toBe('background');
    expect(resApply.body.data.recalculation.jobId).toBeDefined();

    const job = await Job.findById(resApply.body.data.recalculation.jobId);
    expect(job).not.toBeNull();
    expect(job.status).toBeDefined();

    // Also check job status endpoint
    const statusRes = await request(app)
      .get(`/admin/jobs/${resApply.body.data.recalculation.jobId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.job._id).toBeDefined();
  });
});
