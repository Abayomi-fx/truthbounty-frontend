import { test, expect } from '@playwright/test';
import { TestClient } from '../utils/test-client';

test.describe('Sybil Batch Recalculation', () => {
  test('❌ non-admin cannot trigger recalculation', async () => {
    const client = new TestClient();
    await client.init();

    const { token } = await (await client.post('/auth/test-login', {
      userId: 'user1',
    })).json();

    client.setToken(token);

    const res = await client.post('/admin/sybil/recalculate', {});

    expect(res.status()).toBe(403);
  });

  test('✅ admin can process batches safely', async () => {
    const client = new TestClient();
    await client.init();

    const { token } = await (await client.post('/auth/admin-login', {})).json();
    client.setToken(token);

    const res = await client.post('/admin/sybil/recalculate', {
      batchSize: 50,
      concurrency: 5,
    });

    expect(res.status()).toBe(200);

    const body = await res.json();

    expect(body.totalProcessed).toBeGreaterThan(0);
  });
});