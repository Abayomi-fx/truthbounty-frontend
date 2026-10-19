import { fetchAdminOverview, executeAdminOperation } from '../../admin.api';

describe('Admin Client API (V2-FE-154)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('fetchAdminOverview', () => {
    it('sends GET request with x-admin-address header and returns overview', async () => {
      const mockOverview = {
        isAuthorized: true,
        adminAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        healthMetrics: [],
        operationalQueue: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOverview,
      });

      const result = await fetchAdminOverview('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC');
      expect(result).toEqual(mockOverview);
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/overview', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-admin-address': '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        },
        cache: 'no-store',
      });
    });

    it('throws error with server reason on failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: 'unauthorized',
          reason: 'Admin role verification failed',
        }),
      });

      await expect(
        fetchAdminOverview('0x0000000000000000000000000000000000000001')
      ).rejects.toThrow('Admin role verification failed');
    });
  });

  describe('executeAdminOperation', () => {
    it('sends POST request with operation payload and returns response', async () => {
      const mockResponse = {
        success: true,
        operationId: 'op-retry-batch-4410',
        auditRecord: {
          auditId: 'AUD-001',
          consequenceHash: '0xabc',
        },
        message: 'Success',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const payload = {
        operationId: 'op-retry-batch-4410',
        confirmationText: 'CONFIRM',
        operatorAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      };

      const result = await executeAdminOperation(payload);
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-admin-address': '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        },
        body: JSON.stringify(payload),
      });
    });

    it('throws error when server rejects operation execution', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_confirmation',
          reason: 'Explicit confirmation string "CONFIRM" required',
        }),
      });

      await expect(
        executeAdminOperation({
          operationId: 'op-retry-batch-4410',
          confirmationText: 'wrong',
          operatorAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        })
      ).rejects.toThrow('Explicit confirmation string "CONFIRM" required');
    });
  });
});
