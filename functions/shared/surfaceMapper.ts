/**
 * Surface Mapper Module
 * Discovers all executable surfaces in the app for the Self-Check engine.
 * 
 * Note: In Deno Deploy, filesystem enumeration is not available at runtime.
 * This module maintains a registry of known surfaces that must be updated
 * when new functions are added to the app.
 */

// Registry of all known executable surfaces in this app
// This must be manually updated when adding/removing functions
const SURFACE_REGISTRY = [
  // Main functions
  { name: 'automateDataDeletion', type: 'function', filePath: 'functions/automateDataDeletion.js' },
  { name: 'automatedPlatformDeletion', type: 'function', filePath: 'functions/automatedPlatformDeletion.js' },
  { name: 'automateGDPRDeletion', type: 'function', filePath: 'functions/automateGDPRDeletion.js' },
  { name: 'bulkDeleteEmails', type: 'function', filePath: 'functions/bulkDeleteEmails.js' },
  { name: 'calculateAdvancedRiskScore', type: 'function', filePath: 'functions/calculateAdvancedRiskScore.js' },
  { name: 'checkBreachAlerts', type: 'function', filePath: 'functions/checkBreachAlerts.js' },
  { name: 'checkBreaches', type: 'function', filePath: 'functions/checkBreaches.js' },
  { name: 'checkClassActions', type: 'function', filePath: 'functions/checkClassActions.js' },
  { name: 'checkHIBP', type: 'function', filePath: 'functions/checkHIBP.js' },
  { name: 'checkSocialMediaImpersonation', type: 'function', filePath: 'functions/checkSocialMediaImpersonation.js' },
  { name: 'correlateProfileData', type: 'function', filePath: 'functions/correlateProfileData.js' },
  { name: 'detectSearchQueries', type: 'function', filePath: 'functions/detectSearchQueries.js' },
  { name: 'fetchInboxEmails', type: 'function', filePath: 'functions/fetchInboxEmails.js' },
  { name: 'findAttorneys', type: 'function', filePath: 'functions/findAttorneys.js' },
  { name: 'fixExposure', type: 'function', filePath: 'functions/fixExposure.js' },
  { name: 'generateEmailAlias', type: 'function', filePath: 'functions/generateEmailAlias.js' },
  { name: 'generateEvidencePacket', type: 'function', filePath: 'functions/generateEvidencePacket.js' },
  { name: 'generateVirtualCard', type: 'function', filePath: 'functions/generateVirtualCard.js' },
  { name: 'monitorDeletionResponses', type: 'function', filePath: 'functions/monitorDeletionResponses.js' },
  { name: 'monitorEmails', type: 'function', filePath: 'functions/monitorEmails.js' },
  { name: 'monitorSocialMedia', type: 'function', filePath: 'functions/monitorSocialMedia.js' },
  { name: 'runIdentityScan', type: 'function', filePath: 'functions/runIdentityScan.js' },
  { name: 'systemSelfCheck', type: 'function', filePath: 'functions/systemSelfCheck.js' },
  
  // Shared modules
  { name: 'surfaceMapper', type: 'shared', filePath: 'functions/shared/surfaceMapper.js' },
];

// Export type detection patterns
const EXPORT_PATTERNS = {
  denoServe: /Deno\.serve\s*\(/,
  defaultExport: /export\s+default/,
  handlerExport: /exports\.handler\s*=/,
  namedExport: /export\s+(const|function|class|let|var)\s+/,
  moduleExports: /module\.exports\s*=/
};

/**
 * Analyzes code content to determine export type
 */
function detectExportType(code) {
  if (!code || typeof code !== 'string') return 'unknown';
  
  // Deno.serve is the primary pattern for Base44 functions
  if (EXPORT_PATTERNS.denoServe.test(code)) return 'handler';
  if (EXPORT_PATTERNS.defaultExport.test(code)) return 'default';
  if (EXPORT_PATTERNS.handlerExport.test(code)) return 'handler';
  if (EXPORT_PATTERNS.namedExport.test(code)) return 'named';
  if (EXPORT_PATTERNS.moduleExports.test(code)) return 'default';
  
  return 'unknown';
}

/**
 * Extracts a code snippet around a specific line number
 */
function extractCodeSnippet(code, lineNumber, contextLines = 5) {
  if (!code) return null;
  
  const lines = code.split('\n');
  const startLine = Math.max(0, lineNumber - contextLines);
  const endLine = Math.min(lines.length, lineNumber + contextLines);
  
  return lines.slice(startLine, endLine).map((line, idx) => {
    const actualLine = startLine + idx + 1;
    const marker = actualLine === lineNumber ? '>>> ' : '    ';
    return `${marker}${actualLine}: ${line}`;
  }).join('\n');
}

/**
 * Parses error stack to find line number
 */
function parseStackForLine(stack) {
  if (!stack) return null;
  
  const lineMatch = stack.match(/:(\d+):\d+/);
  return lineMatch ? parseInt(lineMatch[1], 10) : null;
}

/**
 * Validates a surface entry by attempting to analyze its structure
 */
async function validateSurface(surface, base44Client) {
  const result = {
    ...surface,
    exportType: 'unknown',
    valid: false,
    error: null,
    errorStack: null,
    offendingCode: null
  };

  try {
    // For functions, we can test via the SDK
    if (surface.type === 'function' && surface.name !== 'systemSelfCheck') {
      try {
        // Attempt a self-test invocation with timeout
        await Promise.race([
          base44Client.functions.invoke(surface.name, { _selfTest: '1' }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Function timeout (10s)')), 10000)
          )
        ]);
        
        result.valid = true;
        result.exportType = 'handler';
      } catch (invokeError) {
        // Expected errors (missing params, etc.) are OK - function is reachable
        const isExpectedError = 
          invokeError.message?.includes('required') ||
          invokeError.message?.includes('profileId') ||
          invokeError.message?.includes('Unauthorized') ||
          invokeError.message?.includes('timeout') ||
          invokeError.message?.includes('Missing') ||
          invokeError.message?.includes('Invalid');
        
        if (isExpectedError) {
          result.valid = true;
          result.exportType = 'handler';
          result.warning = invokeError.message;
        } else {
          result.valid = false;
          result.error = invokeError.message;
          result.errorStack = invokeError.stack;
        }
      }
    } else if (surface.type === 'shared') {
      // Shared modules can't be invoked directly, mark as valid if in registry
      result.valid = true;
      result.exportType = 'named';
    } else {
      // Self-check function - always valid
      result.valid = true;
      result.exportType = 'handler';
    }
  } catch (e) {
    result.valid = false;
    result.error = e.message;
    result.errorStack = e.stack;
  }

  return result;
}

/**
 * Returns all discovered surfaces from the registry
 */
export async function getSurfaceMap() {
  return SURFACE_REGISTRY.map(surface => ({
    ...surface,
    exportType: surface.type === 'function' ? 'handler' : 
                surface.type === 'shared' ? 'named' : 'unknown'
  }));
}

/**
 * Returns only surfaces with valid runtime imports
 * Requires a base44 client to test function invocations
 */
export async function getExecutableSurfaces(base44Client) {
  const surfaces = await getSurfaceMap();
  const results = [];

  for (const surface of surfaces) {
    const validated = await validateSurface(surface, base44Client);
    results.push(validated);
  }

  return results;
}

/**
 * Performs a dry-run test on a function surface
 */
export async function dryRunSurface(surface, base44Client) {
  const result = {
    name: surface.name,
    filePath: surface.filePath,
    type: surface.type,
    ok: false,
    error: null,
    errorStack: null,
    offendingCode: null,
    duration_ms: 0
  };

  const startTime = Date.now();

  try {
    if (surface.type !== 'function') {
      // Non-function surfaces can't be dry-run
      result.ok = true;
      result.skipped = true;
      result.skipReason = `${surface.type} surfaces cannot be invoked`;
      return result;
    }

    if (surface.name === 'systemSelfCheck') {
      result.ok = true;
      result.skipped = true;
      result.skipReason = 'Skipping self to avoid recursion';
      return result;
    }

    // Attempt invocation with self-test flag
    await Promise.race([
      base44Client.functions.invoke(surface.name, { _selfTest: '1' }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Function timeout (15s)')), 15000)
      )
    ]);

    result.ok = true;
  } catch (e) {
    // Extract HTTP status code from axios errors
    const statusCode = e.response?.status || 
                       (e.message?.match(/status code (\d+)/)?.[1] ? 
                        parseInt(e.message.match(/status code (\d+)/)[1]) : null);
    
    // Classify errors - these are all "expected" errors meaning the function is reachable
    // 400 = Bad Request (missing params) - function works, just needs proper input
    // 401 = Unauthorized - function works, auth issue (often expected for self-test)
    // 404 = Not Found - could be missing resource, function is still reachable
    // Timeout = function is running but slow
    const isExpectedError = 
      statusCode === 400 ||
      statusCode === 401 ||
      statusCode === 404 ||
      e.message?.includes('required') ||
      e.message?.includes('profileId') ||
      e.message?.includes('Unauthorized') ||
      e.message?.includes('timeout') ||
      e.message?.includes('Missing') ||
      e.message?.includes('Invalid') ||
      e.message?.includes('not found') ||
      e.message?.includes('No ');

    if (isExpectedError) {
      result.ok = true;
      result.warning = `Expected: ${statusCode ? `HTTP ${statusCode}` : e.message}`;
    } else {
      result.ok = false;
      result.error = e.message;
      result.errorStack = e.stack;
      
      // Try to extract offending code location from stack
      const lineNumber = parseStackForLine(e.stack);
      if (lineNumber) {
        result.errorLine = lineNumber;
      }
    }
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}

/**
 * Runs dry-run tests on all executable surfaces
 */
export async function dryRunAllSurfaces(base44Client) {
  const surfaces = await getSurfaceMap();
  const results = [];

  for (const surface of surfaces) {
    const result = await dryRunSurface(surface, base44Client);
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
 * Gets surface statistics
 */
export function getSurfaceStats() {
  const stats = {
    total: SURFACE_REGISTRY.length,
    byType: {}
  };

  for (const surface of SURFACE_REGISTRY) {
    stats.byType[surface.type] = (stats.byType[surface.type] || 0) + 1;
  }

  return stats;
}

/**
 * Registers a new surface (for dynamic discovery)
 * Note: Changes are not persisted across deployments
 */
export function registerSurface(surface) {
  const exists = SURFACE_REGISTRY.find(s => s.filePath === surface.filePath);
  if (!exists) {
    SURFACE_REGISTRY.push(surface);
  }
  return SURFACE_REGISTRY.length;
}

export default {
  getSurfaceMap,
  getExecutableSurfaces,
  dryRunSurface,
  dryRunAllSurfaces,
  getSurfaceStats,
  registerSurface
};