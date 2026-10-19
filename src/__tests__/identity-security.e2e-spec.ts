import { test, expect } from '@playwright/test';
import { TestClient } from '../utils/test-client';

test.describe('Identity Verification Security', () => {
  test('❌ attacker cannot verify another user', async () => {
    const attacker = new TestClient();
    await attacker.init();

    const victimId = 'user-victim';

    // login as attacker
    const auth = await attacker.post('/auth/test-login', {
      userId: 'attacker',
    });

    const { token } = await auth.json();
    attacker.setToken(token);

    const res = await attacker.post(
      `/identity/users/${victimId}/verify-worldcoin`,
      {},
    );

    expect(res.status()).toBe(403);
  });

  test('❌ unauthenticated request blocked', async () => {
    const client = new TestClient();
    await client.init();

    const res = await client.post(
      `/identity/users/user1/verify-worldcoin`,
      {},
    );

    expect(res.status()).toBe(401);
  });

  test('✅ user can verify self', async () => {
    const client = new TestClient();
    await client.init();

    const auth = await client.post('/auth/test-login', {
      userId: 'user1',
    });

    const { token } = await auth.json();
    client.setToken(token);

    const res = await client.post(
      `/identity/users/user1/verify-worldcoin`,
      {},
    );

    expect(res.status()).toBe(200);
  });
});