type RequestContext = {
  account?: string;
  chain?: string;
  release?: string;
  route?: string;
};

type RequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  retry?: boolean;
  context?: RequestContext;
  idempotencyKey?: string;
};

type RetryBudget = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  maxConcurrentRetries: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_BUDGET: RetryBudget = {
  maxRetries: 3,
  baseDelayMs: 250,
  maxDelayMs: 4_000,
  maxConcurrentRetries: 8,
};

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

let activeRetries = 0;
let currentContext: RequestContext = {};
const inflight = new Map<string, AbortController>();
const latestRequestByKey = new Map<string, number>();
let requestSequence = 0;

export function setRequestContext(next: RequestContext): void {
  const changed =
    next.account !== currentContext.account ||
    next.chain !== currentContext.chain ||
    next.release !== currentContext.release ||
    next.route !== currentContext.route;
  currentContext = { ...next };
  if (changed) {
    abortAllInflight();
  }
}

export function getRequestContext(): RequestContext {
  return { ...currentContext };
}

export function abortAllInflight(): void {
  for (const controller of inflight.values()) {
    controller.abort();
  }
  inflight.clear();
}

export function getRetryBudget(): RetryBudget {
  return { ...DEFAULT_RETRY_BUDGET };
}

function contextKey(ctx: RequestContext): string {
  return [ctx.account ?? '', ctx.chain ?? '', ctx.release ?? '', ctx.route ?? ''].join('|');
}

function validateContext(ctx: RequestContext): void {
  if (ctx.account !== undefined && ctx.account === '') {
    throw new Error('INVALID_CONTEXT_ACCOUNT');
  }
  if (ctx.chain !== undefined && ctx.chain === '') {
    throw new Error('INVALID_CONTEXT_CHAIN');
  }
  if (ctx.release !== undefined && ctx.release === '') {
    throw new Error('INVALID_CONTEXT_RELEASE');
  }
}

function isRetriableStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

function isRetriableError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return false;
  if (err instanceof TypeError) return true;
  return false;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function requestWithLifecycle(
  input: string,
  init: RequestInit,
  options: RequestOptions = {},
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const idempotent = IDEMPOTENT_METHODS.has(method);
  const ctx = options.context ?? currentContext;
  validateContext(ctx);

  const key = `${method} ${input} ${contextKey(ctx)}`;
  const seq = ++requestSequence;
  latestRequestByKey.set(key, seq);

  const controller = new AbortController();
  const externalSignal = options.signal;
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  inflight.set(key, controller);

  const headers = new Headers(init.headers);
  if (ctx.account) headers.set('X-Account', ctx.account);
  if (ctx.chain) headers.set('X-Chain', ctx.chain);
  if (ctx.release) headers.set('X-Release', ctx.release);
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);

  const budget = DEFAULT_RETRY_BUDGET;
  const allowRetry = options.retry === true && idempotent;
  let attempt = 0;
  let lastError: unknown;

  try {
    while (true) {
      try {
        const res = await fetch(input, { ...init, headers, signal: controller.signal });
        if (!res.ok && allowRetry && isRetriableStatus(res.status) && attempt < budget.maxRetries) {
          attempt += 1;
          const backoff = Math.min(budget.baseDelayMs * 2 ** (attempt - 1), budget.maxDelayMs);
          const jitter = Math.floor(Math.random() * budget.baseDelayMs);
          await delay(backoff + jitter, controller.signal);
          continue;
        }
        if (latestRequestByKey.get(key) !== seq) {
          throw new DOMException('Stale response suppressed', 'AbortError');
        }
        return res;
      } catch (err) {
        lastError = err;
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        if (allowRetry && isRetriableError(err) && attempt < budget.maxRetries) {
          attempt += 1;
          if (activeRetries >= budget.maxConcurrentRetries) {
            throw new Error('RETRY_BUDGET_EXHAUSTED');
          }
          activeRetries += 1;
          try {
            const backoff = Math.min(budget.baseDelayMs * 2 ** (attempt - 1), budget.maxDelayMs);
            const jitter = Math.floor(Math.random() * budget.baseDelayMs);
            await delay(backoff + jitter, controller.signal);
          } finally {
            activeRetries -= 1;
          }
          continue;
        }
        throw err;
      }
    }
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    if (inflight.get(key) === controller) inflight.delete(key);
    if (lastError && latestRequestByKey.get(key) !== seq) {
      // stale request completed; nothing to do
    }
  }
}

export async function getClaimById(id: string) {
  const res = await requestWithLifecycle(
    `/api/claims/${id}`,
    { method: 'GET' },
    { retry: true, context: currentContext },
  );
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('CLAIM_NOT_FOUND');
    }
    throw new Error('Failed to fetch claim');
  }
  return res.json();
}

export async function submitVerification(payload: {
  claimId: string;
  decision: 'verify' | 'reject';
  stakeAmount: number;
}) {
  const idempotencyKey = `${payload.claimId}:${payload.decision}:${payload.stakeAmount}`;
  const res = await requestWithLifecycle(
    '/api/verifications',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    { retry: false, context: currentContext, idempotencyKey },
  );

  if (!res.ok) throw new Error('Verification failed');
  return res.json();
}
