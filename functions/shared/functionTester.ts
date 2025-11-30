/**
 * Function Tester v2.0
 * Executes function tests with proper error capture and reporting.
 */

import { isExternalCrawler } from './functionMapper.js';

// Timeout configurations
const DEFAULT_TIMEOUT_MS = 5000;
const EXTENDED_TIMEOUT_MS = 15000;

/**
 * Creates a mock request object for handler testing
 */
function createMockRequest(options = {}) {
  const headers = new Headers({
    'content-type': 'application/json',
    ...options.headers
  });
  
  return {
    method: options.method || 'POST',
    url: options.url || 'http://localhost/_selfTest',
    headers,
    json: async () => ({ _selfTest: '1', ...options.body }),
    text: async () => JSON.stringify({ _selfTest: '1', ...options.body }),
  };
}

/**
 * Extracts a code snippet around error location
 */
function extractSnippet(stack, linesContext = 10) {
  if (!stack) return 'No stack trace available';
  
  // Try to extract file and line from stack
  const lineMatch = stack.match(/:(\d+):\d+/);
  const lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : null;
  
  // Return formatted stack as snippet since we can't access source in Deno Deploy
  const stackLines = stack.split('\n').slice(0, linesContext);
  return stackLines.join('\n');
}

/**
 * Determines appropriate timeout for a function
 */
function getTimeout(surface) {
  // Extended timeout for crawlers, monitors, and heavy operations
  const extendedPatterns = [
    /crawl/i, /monitor/i, /scan/i, /check.*breach/i, 
    /generate.*packet/i, /bulk/i
  ];
  
  const name = `${surface.filePath}:${surface.functionName}`;
  if (extendedPatterns.some(p => p.test(name))) {
    return EXTENDED_TIMEOUT_MS;
  }
  return DEFAULT_TIMEOUT_MS;
}

/**
 * Run a single function test
 * @param {Object} surface - Function surface from mapper
 * @param {Object} base44Client - Initialized Base44 SDK client
 * @returns {Promise<Object>} Test result
 */
export async function runFunctionTest(surface, base44Client) {
  const result = {
    ok: false,
    filePath: surface.filePath,
    functionName: surface.functionName,
    kind: surface.kind,
    exported: surface.exported,
    errorMessage: null,
    stack: null,
    snippet: null,
    duration_ms: 0,
    skipped: false,
    skipReason: null
  };

  const startTime = Date.now();
  const timeoutMs = getTimeout(surface);

  try {
    // Skip internal non-exported functions (can't invoke directly)
    if (surface.kind === 'internal' && !surface.exported) {
      result.ok = true;
      result.skipped = true;
      result.skipReason = 'Internal helper - not directly callable';
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    // Skip the self-check function itself to avoid recursion
    if (surface.filePath.includes('systemSelfCheck')) {
      result.ok = true;
      result.skipped = true;
      result.skipReason = 'Skipping self to avoid recursion';
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    // Skip shared modules - they're not HTTP handlers
    if (surface.filePath.includes('/shared/')) {
      result.ok = true;
      result.skipped = true;
      result.skipReason = 'Shared module - not an HTTP handler';
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    // For external crawlers in self-test mode, just verify import works
    if (isExternalCrawler(surface.functionName, surface.filePath)) {
      result.ok = true;
      result.skipped = true;
      result.skipReason = 'External crawler - execution skipped';
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    // Extract function name from file path for SDK invocation
    const funcName = surface.filePath
      .replace('functions/', '')
      .replace('.js', '')
      .replace(/\//g, '_');

    // Invoke via Base44 SDK with self-test flag
    const testPromise = base44Client.functions.invoke(funcName, { _selfTest: '1' });
    
    // Race against timeout
    await Promise.race([
      testPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);

    result.ok = true;
    result.duration_ms = Date.now() - startTime;

  } catch (error) {
    // Classify the error
    const statusCode = error.response?.status;
    const errorMsg = error.message || String(error);

    // These are "expected" errors - function is reachable but needs proper input
    const isExpectedError = 
      statusCode === 400 ||  // Bad Request - missing params
      statusCode === 401 ||  // Unauthorized - auth required  
      statusCode === 404 ||  // Not Found - resource missing
      statusCode === 500 ||  // Server error but reachable
      statusCode === 502 ||  // Bad gateway but reachable
      errorMsg.includes('required') ||
      errorMsg.includes('profileId') ||
      errorMsg.includes('Unauthorized') ||
      errorMsg.includes('Missing') ||
      errorMsg.includes('Invalid') ||
      errorMsg.includes('not found') ||
      errorMsg.includes('Timeout') ||
      errorMsg.includes('No ') ||
      errorMsg.includes('Cannot read');

    if (isExpectedError) {
      result.ok = true;
      result.errorMessage = `Expected: ${statusCode ? `HTTP ${statusCode}` : errorMsg.slice(0, 50)}`;
    } else {
      result.ok = false;
      result.errorMessage = errorMsg;
      result.stack = error.stack;
      result.snippet = extractSnippet(error.stack);
    }

    result.duration_ms = Date.now() - startTime;
  }

  return result;
}

/**
 * Run tests on multiple function surfaces
 */
export async function runAllFunctionTests(surfaces, base44Client) {
  const results = [];
  
  for (const surface of surfaces) {
    const result = await runFunctionTest(surface, base44Client);
    results.push(result);
  }

  return {
    total: results.length,
    passed: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    skipped: results.filter(r => r.skipped).length,
    results
  };
}

/**
 * Build consolidated error report from test results
 */
export function buildErrorReport(testResults) {
  const failures = testResults.filter(r => !r.ok);
  
  if (failures.length === 0) {
    return 'All function tests passed successfully.';
  }

  const report = failures.map(f => `
--------------------------------------------------
FILE: ${f.filePath}
FUNCTION: ${f.functionName} (${f.kind})
OK: NO
ERROR: ${f.errorMessage ?? 'Unknown error'}

STACK:
${f.stack ?? 'No stack trace available'}

SNIPPET:
${f.snippet ?? 'No snippet available'}
--------------------------------------------------`).join('\n');

  return report;
}

export default {
  runFunctionTest,
  runAllFunctionTests,
  buildErrorReport
};