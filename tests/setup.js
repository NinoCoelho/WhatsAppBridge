// Mock environment variables
process.env.PORT = '3000';
process.env.HOST = 'localhost';
process.env.LOG_LEVEL = 'error'; // Reduce noise during tests

// Mock fetch for webhook calls
global.fetch = jest.fn(() => 
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
    })
);

// Clear mocks between tests
afterEach(() => {
    jest.clearAllMocks();
});

// Cleanup after all tests
afterAll(() => {
    jest.restoreAllMocks();
}); 