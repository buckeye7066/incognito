/**
 * Function Mapper v2.0
 * Discovers all functions in the application for self-check coverage.
 * 
 * Note: In Deno Deploy runtime, we cannot do filesystem enumeration.
 * This module maintains a comprehensive registry of all known functions.
 */

// Complete registry of all functions in this app
const FUNCTION_REGISTRY = [
  // Main API functions
  { filePath: 'functions/automateDataDeletion.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/automatedPlatformDeletion.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/automateGDPRDeletion.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/bulkDeleteEmails.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/calculateAdvancedRiskScore.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/checkBreachAlerts.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/checkBreaches.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/checkClassActions.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/checkHIBP.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/checkSocialMediaImpersonation.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/correlateProfileData.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/detectSearchQueries.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/fetchInboxEmails.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/findAttorneys.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/fixExposure.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/generateEmailAlias.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/generateEvidencePacket.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/generateVirtualCard.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/monitorDeletionResponses.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/monitorEmails.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/monitorSocialMedia.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/runIdentityScan.js', functionName: 'default', kind: 'default', exported: true },
  { filePath: 'functions/systemSelfCheck.js', functionName: 'default', kind: 'default', exported: true },
];

// Known internal helper functions (not directly callable via API)
const INTERNAL_HELPERS = [
  { filePath: 'functions/generateEvidencePacket.js', functionName: 'getPlatformReportInfo', kind: 'internal', exported: false },
];

/**
 * Returns all discovered function surfaces
 * @returns {Promise<Array<FunctionSurface>>}
 */
export async function mapAllFunctions() {
  // Combine exported functions and internal helpers
  const allFunctions = [
    ...FUNCTION_REGISTRY,
    ...INTERNAL_HELPERS
  ];
  
  return allFunctions.map(fn => ({
    ...fn,
    discoveredAt: new Date().toISOString()
  }));
}

/**
 * Returns only exported/callable functions
 */
export async function getExportedFunctions() {
  return FUNCTION_REGISTRY.filter(fn => fn.exported);
}

/**
 * Get function count statistics
 */
export function getFunctionStats() {
  return {
    total: FUNCTION_REGISTRY.length + INTERNAL_HELPERS.length,
    exported: FUNCTION_REGISTRY.length,
    internal: INTERNAL_HELPERS.length
  };
}

/**
 * Check if a function name indicates an external crawler/network call
 */
export function isExternalCrawler(functionName, filePath) {
  const crawlerPatterns = [
    /crawl/i,
    /fetch.*external/i,
    /scrape/i,
    /webhook/i
  ];
  
  const combinedName = `${filePath}:${functionName}`;
  return crawlerPatterns.some(pattern => pattern.test(combinedName));
}

/**
 * Register a new function (for dynamic discovery)
 */
export function registerFunction(surface) {
  const exists = FUNCTION_REGISTRY.find(
    f => f.filePath === surface.filePath && f.functionName === surface.functionName
  );
  if (!exists) {
    FUNCTION_REGISTRY.push(surface);
  }
}

export default {
  mapAllFunctions,
  getExportedFunctions,
  getFunctionStats,
  isExternalCrawler,
  registerFunction
};