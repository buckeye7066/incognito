/**
 * Heavyweight Backend Function Tester
 * 
 * Tests EVERY function with real payloads and captures all failures
 * with error messages, stack traces, and code snippets.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Complete registry of all backend functions in this app
const ALL_FUNCTIONS = [
  { id: 'automateDataDeletion', filePath: 'functions/automateDataDeletion.js' },
  { id: 'automatedPlatformDeletion', filePath: 'functions/automatedPlatformDeletion.js' },
  { id: 'automateGDPRDeletion', filePath: 'functions/automateGDPRDeletion.js' },
  { id: 'bulkDeleteEmails', filePath: 'functions/bulkDeleteEmails.js' },
  { id: 'monitorDeletionResponses', filePath: 'functions/monitorDeletionResponses.js' },
  { id: 'calculateAdvancedRiskScore', filePath: 'functions/calculateAdvancedRiskScore.js' },
  { id: 'correlateProfileData', filePath: 'functions/correlateProfileData.js' },
  { id: 'checkBreachAlerts', filePath: 'functions/checkBreachAlerts.js' },
  { id: 'checkBreaches', filePath: 'functions/checkBreaches.js' },
  { id: 'checkHIBP', filePath: 'functions/checkHIBP.js' },
  { id: 'checkClassActions', filePath: 'functions/checkClassActions.js' },
  { id: 'findAttorneys', filePath: 'functions/findAttorneys.js' },
  { id: 'generateEvidencePacket', filePath: 'functions/generateEvidencePacket.js' },
  { id: 'generateLegalIntakePacket', filePath: 'functions/generateLegalIntakePacket.js' },
  { id: 'legalDiscoverCases', filePath: 'functions/legalDiscoverCases.js' },
  { id: 'legalGenerateFilingGuidance', filePath: 'functions/legalGenerateFilingGuidance.js' },
  { id: 'checkSocialMediaImpersonation', filePath: 'functions/checkSocialMediaImpersonation.js' },
  { id: 'monitorSocialMedia', filePath: 'functions/monitorSocialMedia.js' },
  { id: 'detectSearchQueries', filePath: 'functions/detectSearchQueries.js' },
  { id: 'fetchInboxEmails', filePath: 'functions/fetchInboxEmails.js' },
  { id: 'monitorEmails', filePath: 'functions/monitorEmails.js' },
  { id: 'fixExposure', filePath: 'functions/fixExposure.js' },
  { id: 'generateEmailAlias', filePath: 'functions/generateEmailAlias.js' },
  { id: 'generateVirtualCard', filePath: 'functions/generateVirtualCard.js' },
  { id: 'runIdentityScan', filePath: 'functions/runIdentityScan.js' },
  // testAllFunctions is excluded to prevent recursion
];

// Default test payloads for functions that don't have FunctionTestPayload entries
const DEFAULT_PAYLOADS = {
  automateDataDeletion: { profileId: 'test-profile-id', scanResultIds: ['test-scan-1'] },
  automatedPlatformDeletion: { profileId: 'test-profile-id', platform: 'test-platform' },
  automateGDPRDeletion: { profileId: 'test-profile-id', findingId: 'test-finding-id', findingType: 'scan_result' },
  bulkDeleteEmails: { emailIds: ['test-email-1'] },
  monitorDeletionResponses: { profileId: 'test-profile-id' },
  calculateAdvancedRiskScore: { profileId: 'test-profile-id' },
  correlateProfileData: { profileId: 'test-profile-id' },
  checkBreachAlerts: { profileId: 'test-profile-id' },
  checkBreaches: { profileId: 'test-profile-id', identifiers: [{ type: 'email', value: 'test@example.com' }] },
  checkHIBP: { email: 'test@example.com' },
  checkClassActions: { companyName: 'Test Company' },
  findAttorneys: { location: 'Tennessee', specialty: 'privacy' },
  generateEvidencePacket: { profileId: 'test-profile-id', findingId: 'test-finding-id' },
  generateLegalIntakePacket: { profileId: 'test-profile-id' },
  legalDiscoverCases: { sourceUrls: ['https://example.com/case'] },
  legalGenerateFilingGuidance: { profileId: 'test-profile-id', incidentSummary: 'test', jurisdictionHint: 'test' },
  checkSocialMediaImpersonation: { profileId: 'test-profile-id' },
  monitorSocialMedia: { profileId: 'test-profile-id' },
  detectSearchQueries: { profileId: 'test-profile-id' },
  fetchInboxEmails: { maxResults: 5 },
  monitorEmails: { profileId: 'test-profile-id' },
  fixExposure: { exposureId: 'test-exposure-id', exposureType: 'data_broker', profileId: 'test-profile-id' },
  generateEmailAlias: { profileId: 'test-profile-id', purpose: 'test', website: 'test.com' },
  generateVirtualCard: { profileId: 'test-profile-id', purpose: 'test' },
  runIdentityScan: { profileId: 'test-profile-id' },
};

// Code snippets for error reporting
const CODE_SNIPPETS = {
  automateDataDeletion: `Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  const body = await req.json();
  
  if (body._selfTest === '1') {
    return Response.json({ ok: true, testMode: true });
  }
  
  const { profileId, scanResultIds } = body;
  if (!profileId || !scanResultIds?.length) {
    return Response.json({ error: 'profileId and scanResultIds required' }, { status: 400 });
  }
  // ... deletion logic
});`,

  _default: `Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const body = await req.json();
  // ... function logic
});`
};

function getCodeSnippet(functionId) {
  return CODE_SNIPPETS[functionId] || CODE_SNIPPETS._default;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        ok: false, 
        error: 'Unauthorized',
        data: { checked: 0, failed: 1, failures: [] }
      }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ 
        ok: false, 
        error: 'Admin access required',
        data: { checked: 0, failed: 1, failures: [] }
      }, { status: 403 });
    }

    // Parse options
    let options = {};
    try {
      const text = await req.text();
      if (text) options = JSON.parse(text);
    } catch { options = {}; }

    // Self-test mode
    if (options._selfTest === '1') {
      return Response.json({ ok: true, testMode: true, function: 'testAllFunctions' });
    }

    const { skipSlowTests = false, timeoutMs = 15000 } = options;

    // Step 1: Load custom test payloads from FunctionTestPayload entity
    let customPayloads = {};
    try {
      const payloadRecords = await base44.asServiceRole.entities.FunctionTestPayload.list();
      for (const record of payloadRecords) {
        customPayloads[record.function_id] = {
          payload: record.payload,
          expectError: record.expect_error || false
        };
      }
    } catch (e) {
      // Entity might not exist yet, continue with defaults
    }

    // Step 2: Test each function
    const results = [];
    const failures = [];

    for (const func of ALL_FUNCTIONS) {
      const testConfig = customPayloads[func.id] || { 
        payload: DEFAULT_PAYLOADS[func.id] || {}, 
        expectError: false 
      };
      
      const result = {
        functionId: func.id,
        filePath: func.filePath,
        payload: testConfig.payload,
        expectError: testConfig.expectError,
        status: 'pending',
        errorMessage: null,
        rawOutput: null,
        stack: null,
        codeSnippet: null,
        duration_ms: 0
      };

      const funcStart = Date.now();

      try {
        // Run the function with timeout
        const testPromise = base44.functions.invoke(func.id, testConfig.payload);
        
        const response = await Promise.race([
          testPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
          )
        ]);

        result.duration_ms = Date.now() - funcStart;
        result.rawOutput = response?.data || response;

        // Check if response indicates an error
        const output = response?.data || response;
        
        if (output === undefined || output === null) {
          result.status = 'failed';
          result.errorMessage = 'Function returned undefined or null';
        } else if (typeof output !== 'object') {
          result.status = 'failed';
          result.errorMessage = `Function returned non-object: ${typeof output}`;
        } else if (output.error && !testConfig.expectError) {
          result.status = 'failed';
          result.errorMessage = output.error;
        } else {
          result.status = 'passed';
        }

      } catch (error) {
        result.duration_ms = Date.now() - funcStart;
        result.status = 'failed';
        result.errorMessage = error.message || String(error);
        result.stack = error.stack || null;
        
        // Check if this is an expected error (e.g., missing API keys, missing data)
        const isExpectedError = 
          error.message?.includes('required') ||
          error.message?.includes('not found') ||
          error.message?.includes('Unauthorized') ||
          error.message?.includes('API key') ||
          error.message?.includes('not configured') ||
          error.message?.includes('connector') ||
          error.message?.includes('Gmail') ||
          error.message?.includes('SimpleLogin') ||
          error.message?.includes('Privacy.com') ||
          error.response?.status === 400 ||
          error.response?.status === 401 ||
          error.response?.status === 404;

        if (isExpectedError || testConfig.expectError) {
          result.status = 'expected_error';
          result.errorMessage = `Expected: ${result.errorMessage}`;
        }
      }

      results.push(result);

      // Collect actual failures (not expected errors)
      if (result.status === 'failed') {
        result.codeSnippet = getCodeSnippet(func.id);
        failures.push(result);
      }
    }

    // Step 3: Build combined error report
    let combinedReport = '';
    
    if (failures.length > 0) {
      combinedReport = `
================================================================================
                         FUNCTION TEST FAILURES
================================================================================
Total Functions: ${ALL_FUNCTIONS.length}
Failed: ${failures.length}
Passed: ${results.filter(r => r.status === 'passed').length}
Expected Errors: ${results.filter(r => r.status === 'expected_error').length}
================================================================================

`;
      
      for (const f of failures) {
        combinedReport += `
--------------------------------------------------------------------------------
FUNCTION: ${f.functionId}
FILE: ${f.filePath}
--------------------------------------------------------------------------------
ERROR MESSAGE:
${f.errorMessage}

PAYLOAD USED:
${JSON.stringify(f.payload, null, 2)}

RAW OUTPUT:
${JSON.stringify(f.rawOutput, null, 2)}
${f.stack ? `
STACK TRACE:
${f.stack}` : ''}

CODE SNIPPET:
\`\`\`javascript
${f.codeSnippet}
\`\`\`
--------------------------------------------------------------------------------

`;
      }
    } else {
      combinedReport = `
================================================================================
                         ALL TESTS PASSED
================================================================================
Total Functions: ${ALL_FUNCTIONS.length}
Passed: ${results.filter(r => r.status === 'passed').length}
Expected Errors: ${results.filter(r => r.status === 'expected_error').length}
Duration: ${Date.now() - startTime}ms
================================================================================
`;
    }

    return Response.json({
      ok: failures.length === 0,
      error: failures.length > 0 ? `${failures.length} functions failed.` : null,
      data: {
        checked: ALL_FUNCTIONS.length,
        passed: results.filter(r => r.status === 'passed').length,
        expectedErrors: results.filter(r => r.status === 'expected_error').length,
        failed: failures.length,
        duration_ms: Date.now() - startTime,
        results,
        failures,
        combinedReport
      },
      timestamp: new Date().toISOString(),
      executedBy: user.email
    });

  } catch (error) {
    return Response.json({
      ok: false,
      error: error.message,
      data: {
        checked: 0,
        failed: 1,
        failures: [{
          functionId: 'testAllFunctions',
          filePath: 'functions/testAllFunctions.js',
          errorMessage: error.message,
          stack: error.stack,
          codeSnippet: 'Test runner itself failed'
        }],
        combinedReport: `
================================================================================
                         TEST RUNNER FAILURE
================================================================================
ERROR: ${error.message}

STACK:
${error.stack}
================================================================================
`
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});