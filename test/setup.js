const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

module.exports = async () => {
  jest.setTimeout(30000);
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.JWT_SECRET_ADMIN = 'testsecret';

  // wait for mongoose to connect after requiring index.js in tests
  // nothing else here; each test will require app after setting env
};

// Teardown handled in afterAll in tests if needed
