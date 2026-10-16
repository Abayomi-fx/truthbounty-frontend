/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports -- test doubles and dynamic module access */
// Simple mock server implementation without MSW dependency
export const mockHandlers = {
  get: (url: string, response: any) => {
    // Mock implementation for GET requests
    return { url, method: "GET", response };
  },
  post: (url: string, response: any) => {
    // Mock implementation for POST requests
    return { url, method: "POST", response };
  },
};

export const setupMockServer = () => {
  // Mock server setup for testing
  const mockFetch = jest.fn();
  global.fetch = mockFetch;

  return {
    listen: () => {},
    resetHandlers: () => {
      mockFetch.mockClear();
    },
    close: () => {},
    use: (handler: any) => {
      // Override mock implementation
      if (handler.method === "GET") {
        mockFetch.mockImplementation(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(handler.response),
          }),
        );
      } else if (handler.method === "POST") {
        mockFetch.mockImplementation(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(handler.response),
          }),
        );
      }
    },
  };
};

// Helper to override handlers during tests
export const overrideHandler = (handler: any) => {
  // Implementation for overriding handlers
};
