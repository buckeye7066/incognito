/**
 * System Self-Check v2.0
 * Comprehensive full-stack diagnostic with deep function introspection.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { mapAllFunctions, getFunctionStats } from './shared/functionMapper.js';
import { runAllFunctionTests, buildErrorReport } from './shared/functionTester.js';

// Known entities in this app
const KNOWN_ENTITIES = [
  'Profile',
  'PersonalData',
  'ScanResult',
  'DeletionRequest',
  'UserPreferences',
  'AIInsight',
  'DigitalFootprintReport',
  'NotificationAlert',
  'ScanSource',
  'SpamIncident',
  'MonitoredAccount',
  'DisposableCredential',
  'DeletionEmailResponse',
  'SocialMediaProfile',
  'SocialMediaFinding',
  'SearchQueryFinding',
  'SocialMediaMention',
  'ExposureFixLog',
  'SystemCheckLog'
];

// Required environment variables
const REQUIRED_ENV_VARS = ['BASE44_APP_ID'];
const OPTIONAL_ENV_VARS = ['HIBP_API_KEY', 'PRIVACY_COM_API_KEY'];

// Remediation suggestions
const REMEDIATION_MAP = {
  'Missing required environment variable': {
    suggestion: 'Go to Dashboard → Settings → Environment Variables and add the missing variable.',
    severity: 'critical'
  },
  'Entity not found': {
    suggestion: 'Create the entity schema in entities/{EntityName}.json or check for typos.',
    severity: 'critical'
  },
  'Permission denied': {
    suggestion: 'Check entity security rules in the dashboard.',
    severity: 'high'
  },
  'records without profile_id': {
    suggestion: 'Run data cleanup to assign orphaned records to profiles.',
    severity: 'high',
    autoFix: true,
    fixAction: 'cleanupOrphanedRecords'
  },
  'Service role': {
    suggestion: 'Ensure backend functions are enabled in Dashboard → Settings.',
    severity: 'critical'
  }
};

function getRemediation(errorMsg) {
  if (!errorMsg) return null;
  for (const [pattern, remediation] of Object.entries(REMEDIATION_MAP)) {
    if (errorMsg.toLowerCase().includes(pattern.toLowerCase())) {
      return remediation;
    }
  }
  return { suggestion: 'Review error details.', severity: 'medium' };
}

async function attemptAutoFix(check, base44) {
  if (!check.remediation?.autoFix) return null;
  
  try {
    if (check.remediation.fixAction === 'cleanupOrphanedRecords') {
      const profiles = await base44.asServiceRole.entities.Profile.list();
      if (profiles.length === 0) return { success: false, message: 'No profiles exist.' };
      
      const defaultProfileId = profiles[0].id;
      let fixed = 0;
      
      for (const entity of ['PersonalData', 'ScanResult', 'DeletionRequest']) {
        const records = await base44.asServiceRole.entities[entity].list();
        for (const record of records.filter(r => !r.profile_id)) {
          await base44.asServiceRole.entities[entity].update(record.id, { profile_id: defaultProfileId });
          fixed++;
        }
      }
      
      return { success: true, message: `Fixed ${fixed} orphaned records.`, fixed };
    }
  } catch (e) {
    return { success: false, message: e.message };
  }
  
  return null;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse options
    let options = {};
    try { options = await req.json(); } catch { options = {}; }
    const { autoFix = false, retryFailed = false, retryDelayMs = 2000 } = options;

    const otherChecks = [];
    const autoFixResults = [];

    // ===========================================
    // 1. ENVIRONMENT CHECKS
    // ===========================================
    for (const envVar of REQUIRED_ENV_VARS) {
      const value = Deno.env.get(envVar);
      otherChecks.push({
        category: 'environment',
        name: `ENV: ${envVar}`,
        ok: !!value,
        error: value ? null : `Missing required environment variable: ${envVar}`,
        remediation: value ? null : getRemediation('Missing required environment variable')
      });
    }

    for (const envVar of OPTIONAL_ENV_VARS) {
      const value = Deno.env.get(envVar);
      otherChecks.push({
        category: 'environment',
        name: `ENV (optional): ${envVar}`,
        ok: true,
        warning: value ? null : `Optional: ${envVar} not set`
      });
    }

    // ===========================================
    // 2. DATABASE CONNECTIVITY
    // ===========================================
    try {
      await base44.entities.Profile.list('-created_date', 1);
      otherChecks.push({
        category: 'database',
        name: 'Database Connectivity',
        ok: true
      });
    } catch (e) {
      otherChecks.push({
        category: 'database',
        name: 'Database Connectivity',
        ok: false,
        error: e.message,
        stack: e.stack
      });
    }

    // ===========================================
    // 3. ENTITY / SCHEMA CHECKS
    // ===========================================
    for (const entityName of KNOWN_ENTITIES) {
      try {
        const entity = base44.entities[entityName];
        if (!entity) {
          otherChecks.push({
            category: 'entity',
            name: `Entity: ${entityName}`,
            ok: false,
            error: `Entity ${entityName} not found in SDK`,
            remediation: getRemediation('Entity not found')
          });
          continue;
        }
        await entity.list('-created_date', 1);
        otherChecks.push({
          category: 'entity',
          name: `Entity: ${entityName}`,
          ok: true
        });
      } catch (e) {
        otherChecks.push({
          category: 'entity',
          name: `Entity: ${entityName}`,
          ok: false,
          error: e.message,
          remediation: getRemediation(e.message)
        });
      }
    }

    // ===========================================
    // 4. DATA ISOLATION / RLS CHECKS
    // ===========================================
    const isolationIssues = [];
    try {
      const personalData = await base44.asServiceRole.entities.PersonalData.list();
      const orphanedPD = personalData.filter(p => !p.profile_id);
      if (orphanedPD.length > 0) {
        isolationIssues.push(`${orphanedPD.length} PersonalData records without profile_id`);
      }

      const scanResults = await base44.asServiceRole.entities.ScanResult.list();
      const orphanedSR = scanResults.filter(s => !s.profile_id);
      if (orphanedSR.length > 0) {
        isolationIssues.push(`${orphanedSR.length} ScanResult records without profile_id`);
      }

      const check = {
        category: 'isolation',
        name: 'Data Isolation (RLS)',
        ok: isolationIssues.length === 0,
        error: isolationIssues.length > 0 ? isolationIssues.join('; ') : null,
        remediation: isolationIssues.length > 0 ? getRemediation('records without profile_id') : null
      };
      
      otherChecks.push(check);
      
      // Auto-fix if enabled
      if (autoFix && !check.ok && check.remediation?.autoFix) {
        const fixResult = await attemptAutoFix(check, base44);
        if (fixResult) {
          autoFixResults.push({ checkName: check.name, ...fixResult });
          if (fixResult.success) {
            check.autoFixResult = fixResult;
          }
        }
      }
    } catch (e) {
      otherChecks.push({
        category: 'isolation',
        name: 'Data Isolation (RLS)',
        ok: false,
        error: e.message
      });
    }

    // ===========================================
    // 5. SERVICE ROLE ACCESS
    // ===========================================
    try {
      await base44.asServiceRole.entities.Profile.list('-created_date', 1);
      otherChecks.push({
        category: 'access',
        name: 'Service Role Access',
        ok: true
      });
    } catch (e) {
      otherChecks.push({
        category: 'access',
        name: 'Service Role Access',
        ok: false,
        error: e.message,
        remediation: getRemediation('Service role')
      });
    }

    // ===========================================
    // 6. INTEGRATION CHECKS
    // ===========================================
    try {
      otherChecks.push({
        category: 'integration',
        name: 'Core Integration',
        ok: !!base44.integrations?.Core,
        error: base44.integrations?.Core ? null : 'Core integration not available'
      });
    } catch (e) {
      otherChecks.push({
        category: 'integration',
        name: 'Core Integration',
        ok: false,
        error: e.message
      });
    }

    // ===========================================
    // 7. FUNCTION INTROSPECTION (V2.0)
    // ===========================================
    const functionSurfaces = await mapAllFunctions();
    const functionStats = getFunctionStats();
    const functionTestResults = await runAllFunctionTests(functionSurfaces, base44);
    const functionErrorReport = buildErrorReport(functionTestResults.results);

    // ===========================================
    // 8. RETRY FAILED CHECKS (if enabled)
    // ===========================================
    let retryResults = null;
    if (retryFailed) {
      const failedOther = otherChecks.filter(c => !c.ok);
      if (failedOther.length > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        retryResults = { attempted: failedOther.length, improvements: [] };
        
        for (const check of failedOther) {
          if (check.category === 'entity') {
            const entityName = check.name.replace('Entity: ', '');
            try {
              await base44.entities[entityName].list('-created_date', 1);
              check.ok = true;
              check.error = null;
              check.retriedSuccessfully = true;
              retryResults.improvements.push(check.name);
            } catch { /* still failing */ }
          }
        }
      }
    }

    // ===========================================
    // 9. COMPILE RESULTS
    // ===========================================
    const otherPassed = otherChecks.filter(c => c.ok).length;
    const otherFailed = otherChecks.filter(c => !c.ok).length;
    const totalChecks = otherChecks.length + functionTestResults.total;
    const totalFailed = otherFailed + functionTestResults.failed;

    const overallOk = totalFailed === 0;

    // Build combined error report
    let combinedErrorReport = '';
    
    // Add other check failures
    const failedOtherChecks = otherChecks.filter(c => !c.ok);
    if (failedOtherChecks.length > 0) {
      combinedErrorReport += failedOtherChecks.map(c => `
--------------------------------------------------
CHECK: ${c.name}
CATEGORY: ${c.category}
ERROR: ${c.error}
SEVERITY: ${c.remediation?.severity || 'unknown'}

HOW TO FIX:
${c.remediation?.suggestion || 'Review error details.'}
${c.stack ? `\nSTACK:\n${c.stack}` : ''}
--------------------------------------------------`).join('\n');
    }
    
    // Add function failures
    if (functionTestResults.failed > 0) {
      combinedErrorReport += '\n\n=== FUNCTION FAILURES ===\n' + functionErrorReport;
    }

    if (!combinedErrorReport) {
      combinedErrorReport = 'All checks passed successfully.';
    }

    const response = {
      ok: overallOk,
      summary: {
        totalChecks,
        totalFunctions: functionStats.total,
        functionsPassed: functionTestResults.passed,
        functionsFailed: functionTestResults.failed,
        functionsSkipped: functionTestResults.skipped,
        otherChecksPassed: otherPassed,
        otherChecksFailed: otherFailed,
        duration_ms: Date.now() - startTime,
        autoFixEnabled: autoFix,
        retryEnabled: retryFailed
      },
      functionChecks: functionTestResults.results,
      otherChecks,
      autoFix: autoFix ? { enabled: true, results: autoFixResults } : null,
      retry: retryResults,
      combinedErrorReport,
      timestamp: new Date().toISOString(),
      executedBy: user.email
    };

    // Log if failures detected
    if (!overallOk) {
      try {
        await base44.asServiceRole.entities.SystemCheckLog.create({
          timestamp: new Date().toISOString(),
          summary: response.summary,
          checks: [...otherChecks, ...functionTestResults.results],
          user_email: user.email,
          app_name: Deno.env.get('BASE44_APP_ID') || 'unknown',
          overall_ok: overallOk
        });
      } catch { /* logging failure shouldn't break response */ }
    }

    return Response.json(response);

  } catch (error) {
    return Response.json({
      ok: false,
      error: error.message,
      stack: error.stack,
      summary: { totalChecks: 0, totalFunctions: 0, functionsFailed: 0, otherChecksFailed: 1 },
      combinedErrorReport: `
--------------------------------------------------
SYSTEM ERROR
ERROR: ${error.message}
STACK:
${error.stack}
--------------------------------------------------`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});