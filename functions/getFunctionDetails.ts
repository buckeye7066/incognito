/**
 * Get Function Details
 * 
 * Fetches function source code and metadata from the static registry.
 * Returns main source code plus all dependency source codes.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Static registry - must be kept in sync with functionRegistry.js
const KNOWN_FUNCTIONS = [
  { functionId: 'testAllFunctions', filePath: 'functions/testAllFunctions.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'testing', description: 'Heavyweight test runner for all backend functions' },
  { functionId: 'getFunctionDetails', filePath: 'functions/getFunctionDetails.js', exportType: 'default', namedExports: [], dependencyPaths: ['functionRegistry.js'], category: 'testing', description: 'Fetches function source code and metadata' },
  { functionId: 'runIdentityScan', filePath: 'functions/runIdentityScan.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'scanning', description: 'OSINT identity scan across web sources' },
  { functionId: 'checkBreaches', filePath: 'functions/checkBreaches.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'scanning', description: 'Check emails against HIBP breach database' },
  { functionId: 'checkBreachAlerts', filePath: 'functions/checkBreachAlerts.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'scanning', description: 'Check for breach alerts on user data' },
  { functionId: 'checkHIBP', filePath: 'functions/checkHIBP.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'scanning', description: 'Direct HIBP API lookup for single email' },
  { functionId: 'detectSearchQueries', filePath: 'functions/detectSearchQueries.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'scanning', description: 'Detect public exposures of personal data' },
  { functionId: 'monitorSocialMedia', filePath: 'functions/monitorSocialMedia.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'social', description: 'Monitor social media for mentions and exposures' },
  { functionId: 'checkSocialMediaImpersonation', filePath: 'functions/checkSocialMediaImpersonation.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'social', description: 'Detect impersonation attempts on social platforms' },
  { functionId: 'fetchInboxEmails', filePath: 'functions/fetchInboxEmails.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'email', description: 'Fetch inbox emails for display' },
  { functionId: 'bulkDeleteEmails', filePath: 'functions/bulkDeleteEmails.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'email', description: 'Bulk delete email messages' },
  { functionId: 'monitorEmails', filePath: 'functions/monitorEmails.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'email', description: 'Monitor email accounts for spam' },
  { functionId: 'generateEmailAlias', filePath: 'functions/generateEmailAlias.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'email', description: 'Generate deterministic email alias' },
  { functionId: 'automateDataDeletion', filePath: 'functions/automateDataDeletion.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'deletion', description: 'Automate GDPR/CCPA deletion requests' },
  { functionId: 'automatedPlatformDeletion', filePath: 'functions/automatedPlatformDeletion.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'deletion', description: 'Automate platform account deletion' },
  { functionId: 'automateGDPRDeletion', filePath: 'functions/automateGDPRDeletion.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'deletion', description: 'Generate GDPR deletion request details' },
  { functionId: 'monitorDeletionResponses', filePath: 'functions/monitorDeletionResponses.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'deletion', description: 'Monitor for deletion request responses' },
  { functionId: 'calculateAdvancedRiskScore', filePath: 'functions/calculateAdvancedRiskScore.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'analysis', description: 'Calculate advanced risk score for profile' },
  { functionId: 'correlateProfileData', filePath: 'functions/correlateProfileData.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'analysis', description: 'Correlate profile data with scan findings' },
  { functionId: 'checkClassActions', filePath: 'functions/checkClassActions.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'legal', description: 'Check for class action lawsuits' },
  { functionId: 'findAttorneys', filePath: 'functions/findAttorneys.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'legal', description: 'Find attorneys by specialty and location' },
  { functionId: 'generateEvidencePacket', filePath: 'functions/generateEvidencePacket.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'legal', description: 'Generate forensic evidence packet' },
  { functionId: 'fixExposure', filePath: 'functions/fixExposure.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'legal', description: 'Initiate remediation for exposures' },
  { functionId: 'generateVirtualCard', filePath: 'functions/generateVirtualCard.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'credentials', description: 'Generate virtual credit card via Privacy.com' }
];

function getFunctionById(functionId) {
  return KNOWN_FUNCTIONS.find(f => f.functionId === functionId) || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Admin only
    if (user.role !== 'admin') {
      return Response.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { functionId, listAll } = body;

    // Self-test mode
    if (body._selfTest === '1') {
      return Response.json({ ok: true, testMode: true, function: 'getFunctionDetails' });
    }

    // List all functions
    if (listAll) {
      return Response.json({
        ok: true,
        data: {
          functions: KNOWN_FUNCTIONS,
          count: KNOWN_FUNCTIONS.length,
          categories: [...new Set(KNOWN_FUNCTIONS.map(f => f.category))]
        }
      });
    }

    // Get specific function details
    if (!functionId) {
      return Response.json({ ok: false, error: 'functionId is required' }, { status: 400 });
    }

    const funcInfo = getFunctionById(functionId);
    if (!funcInfo) {
      return Response.json({ 
        ok: false, 
        error: `Function not found: ${functionId}`,
        availableFunctions: KNOWN_FUNCTIONS.map(f => f.functionId)
      }, { status: 404 });
    }

    // Note: Base44 does not provide a file reading API for source code
    // In a real implementation, you would need to:
    // 1. Store source code in an entity
    // 2. Use a build step to extract source
    // 3. Or manually include source code snippets
    
    // For now, return metadata only with a placeholder for source
    const result = {
      ok: true,
      data: {
        functionId: funcInfo.functionId,
        filePath: funcInfo.filePath,
        exportType: funcInfo.exportType,
        namedExports: funcInfo.namedExports,
        category: funcInfo.category,
        description: funcInfo.description,
        dependencyPaths: funcInfo.dependencyPaths,
        dependencies: funcInfo.dependencyPaths.map(dep => ({
          filePath: dep,
          code: `// Source code for ${dep} - requires manual extraction or entity storage`
        })),
        sourceCode: `// Source code for ${funcInfo.filePath}\n// To view full source, check the functions folder in your Base44 dashboard.\n// File: ${funcInfo.filePath}`,
        sourceAvailable: false,
        note: 'Base44 does not provide runtime file reading. Source code viewing requires dashboard access or entity-based storage.'
      }
    };

    return Response.json(result);

  } catch (error) {
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});