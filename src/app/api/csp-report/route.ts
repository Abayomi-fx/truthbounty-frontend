import { NextResponse } from "next/server";

const MAX_REPORT_SIZE = 16 * 1024;


type CspViolation = Record<string, unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeViolation(value: unknown): CspViolation | null {
  if (!isObject(value)) {
    return null;
  }

  const report = isObject(value.body) ? value.body : value;

  const effectiveDirective =
    report.effectiveDirective ?? report["effective-directive"];
  const blockedURL = report.blockedURL ?? report["blocked-uri"];
  const documentURL = report.documentURL ?? report["document-uri"];
  const sourceFile = report.sourceFile ?? report["source-file"];
  const disposition = report.disposition;
  const statusCode = report.statusCode ?? report["status-code"];

  const hasMeaningfulField =
    effectiveDirective !== undefined ||
    blockedURL !== undefined ||
    documentURL !== undefined ||
    sourceFile !== undefined ||
    disposition !== undefined ||
    statusCode !== undefined;

  if (!hasMeaningfulField) {
    return null;
  }

  return {
    effectiveDirective,
    blockedURL,
    documentURL,
    sourceFile,
    disposition,
    statusCode,
  };
}

const DIRECTIVES = new Set([
  'default-src', 'script-src', 'script-src-elem', 'script-src-attr',
  'style-src', 'style-src-elem', 'style-src-attr', 'connect-src', 'img-src',
  'frame-src', 'worker-src', 'font-src', 'media-src', 'object-src',
  'base-uri', 'form-action', 'frame-ancestors', 'manifest-src',
]);

/** Never retain attacker-controlled URL, source, sample, policy, or arbitrary text. */
function privateViolation(violation: CspViolation) {
  return {
    effectiveDirective: typeof violation.effectiveDirective === 'string' && DIRECTIVES.has(violation.effectiveDirective)
      ? violation.effectiveDirective : 'unknown',
    disposition: violation.disposition === 'enforce' || violation.disposition === 'report'
      ? violation.disposition : 'unknown',
    statusCode: typeof violation.statusCode === 'number' && Number.isInteger(violation.statusCode)
      && violation.statusCode >= 100 && violation.statusCode <= 599 ? violation.statusCode : undefined,
  };
}

/**
 * Accept CSP violation reports without exposing the raw attacker-controlled
 * report body in application logs.
 */
export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > MAX_REPORT_SIZE) {
    return new NextResponse(null, { status: 413 });
  }

  if (!request.body) {
    return new NextResponse(null, { status: 400 });
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      size += value.byteLength;

      if (size > MAX_REPORT_SIZE) {
        await reader.cancel();
        return new NextResponse(null, { status: 413 });
      }

      body += decoder.decode(value, { stream: true });
    }

    body += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  try {
    const payload = JSON.parse(body) as unknown;
    let reports: unknown[] = [];

    if (isObject(payload) && isObject(payload["csp-report"])) {
      reports = [payload["csp-report"]];
    } else if (Array.isArray(payload)) {
      reports = payload;
    } else if (isObject(payload) && isObject(payload.body)) {
      reports = [payload];
    } else if (isObject(payload)) {
      reports = [payload];
    }

    const violations = reports
      .map(normalizeViolation)
      .filter((report): report is CspViolation => report !== null);

    if (violations.length === 0) {
      return new NextResponse(null, { status: 400 });
    }

    for (const violation of violations) {
      console.warn("CSP violation", privateViolation(violation));
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 400 });
  }
}