module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  coveragePathIgnorePatterns: ['/node_modules/'],
  globalSetup: './test/setup.js',
  testTimeout: 30000,
  // Force exit after tests complete to handle any lingering async operations
  forceExit: true,
  // Detect open handles to help identify what's keeping the process alive
  detectOpenHandles: false,
};