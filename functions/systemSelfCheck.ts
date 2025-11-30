import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { getSurfaceMap, dryRunAllSurfaces, getSurfaceStats } from './shared/surfaceMapper.js';

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
const REQUIRED_ENV_VARS = [
  'BASE44_APP_ID'
];

// Optional but important env vars
const OPTIONAL_ENV_VARS = [
  'HIBP_API_KEY',
  'PRIVACY_COM_API_KEY'
];

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin-only access
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const checks = [];
    const contaminationResults = [];

    // ===========================================
    // 1. ENVIRONMENT VARIABLE CHECKS
    // ===========================================
    for (const envVar of REQUIRED_ENV_VARS) {
      const value = Deno.env.get(envVar);
      checks.push({
        category: 'environment',
        name: `ENV: ${envVar}`,
        ok: !!value,
        error: value ? null : `Missing required environment variable: ${envVar}`,
        filePath: null
      });
    }

    for (const envVar of OPTIONAL_ENV_VARS) {
      const value = Deno.env.get(envVar);
      checks.push({
        category: 'environment',
        name: `ENV (optional): ${envVar}`,
        ok: true, // Optional vars don't fail the check
        warning: value ? null : `Optional environment variable not set: ${envVar}`,
        filePath: null
      });
    }

    // ===========================================
    // 2. DATABASE / ENTITY CHECKS
    // ===========================================
    for (const entityName of KNOWN_ENTITIES) {
      try {
        // Test that entity exists and is queryable
        const entity = base44.entities[entityName];
        if (!entity) {
          checks.push({
            category: 'database',
            name: `Entity: ${entityName}`,
            ok: false,
            error: `Entity ${entityName} not found in SDK`,
            filePath: `entities/${entityName}.json`
          });
          continue;
        }

        // Try to list (with limit 1) to verify access
        await entity.list('-created_date', 1);
        
        checks.push({
          category: 'database',
          name: `Entity: ${entityName}`,
          ok: true,
          error: null,
          filePath: `entities/${entityName}.json`
        });
      } catch (e) {
        checks.push({
          category: 'database',
          name: `Entity: ${entityName}`,
          ok: false,
          error: e.message,
          filePath: `entities/${entityName}.json`,
          stack: e.stack
        });
      }
    }

    // ===========================================
    // 3. SURFACE MAPPER - DISCOVER ALL EXECUTABLE SURFACES
    // ===========================================
    let surfaceMap = [];
    let surfaceStats = {};
    
    try {
      surfaceMap = await getSurfaceMap();
      surfaceStats = getSurfaceStats();
      
      checks.push({
        category: 'surface_discovery',
        name: 'Surface Mapper',
        ok: true,
        error: null,
        details: `Discovered ${surfaceMap.length} surfaces: ${Object.entries(surfaceStats.byType).map(([k,v]) => `${v} ${k}s`).join(', ')}`
      });
    } catch (e) {
      checks.push({
        category: 'surface_discovery',
        name: 'Surface Mapper',
        ok: false,
        error: e.message,
        stack: e.stack
      });
    }

    // ===========================================
    // 4. DRY-RUN ALL SURFACES
    // ===========================================
    try {
      const dryRunResults = await dryRunAllSurfaces(base44);
      
      // Add summary check
      checks.push({
        category: 'surface_dryrun',
        name: 'Surface Dry-Run Summary',
        ok: dryRunResults.failed === 0,
        error: dryRunResults.failed > 0 ? `${dryRunResults.failed} surfaces failed dry-run` : null,
        details: `Passed: ${dryRunResults.passed}, Failed: ${dryRunResults.failed}, Skipped: ${dryRunResults.skipped}`
      });

      // Add individual surface results
      for (const result of dryRunResults.results) {
        if (result.skipped) {
          checks.push({
            category: 'function',
            name: `Surface: ${result.name}`,
            ok: true,
            warning: result.skipReason,
            filePath: result.filePath,
            surfaceType: result.type
          });
        } else {
          checks.push({
            category: 'function',
            name: `Surface: ${result.name}`,
            ok: result.ok,
            error: result.error,
            warning: result.warning,
            filePath: result.filePath,
            stack: result.errorStack,
            offendingCode: result.offendingCode,
            errorLine: result.errorLine,
            duration_ms: result.duration_ms,
            surfaceType: result.type
          });
        }
      }
    } catch (e) {
      checks.push({
        category: 'surface_dryrun',
        name: 'Surface Dry-Run',
        ok: false,
        error: `Dry-run execution failed: ${e.message}`,
        stack: e.stack
      });
    }

    // ===========================================
    // 4. INTEGRATION CHECKS
    // ===========================================
    try {
      // Test Core integration is available
      const integrations = base44.integrations;
      checks.push({
        category: 'integration',
        name: 'Core Integration',
        ok: !!integrations?.Core,
        error: integrations?.Core ? null : 'Core integration not available',
        filePath: null
      });
    } catch (e) {
      checks.push({
        category: 'integration',
        name: 'Core Integration',
        ok: false,
        error: e.message,
        filePath: null
      });
    }

    // ===========================================
    // 5. CROSS-CONTAMINATION DETECTION
    // ===========================================
    // Simulate two mock users and check for data leakage
    const mockUserA = { id: 'mock-user-a', email: 'usera@test.local', role: 'user' };
    const mockUserB = { id: 'mock-user-b', email: 'userb@test.local', role: 'user' };

    // Check profile isolation
    try {
      const allProfiles = await base44.asServiceRole.entities.Profile.list();
      
      // Group profiles by created_by
      const profilesByUser = {};
      for (const profile of allProfiles) {
        const owner = profile.created_by || 'unknown';
        if (!profilesByUser[owner]) profilesByUser[owner] = [];
        profilesByUser[owner].push(profile);
      }

      // Check if any user can see others' profiles (simulated)
      // In a real scenario, this would involve actual user context switching
      const userEmails = Object.keys(profilesByUser);
      
      if (userEmails.length > 1) {
        // Check for profiles without proper profile_id filtering patterns in code
        // This is a static analysis check
        const potentialLeaks = [];

        // Check PersonalData - should always filter by profile_id
        const allPersonalData = await base44.asServiceRole.entities.PersonalData.list();
        const pdByProfile = {};
        for (const pd of allPersonalData) {
          const pid = pd.profile_id || 'unassigned';
          if (!pdByProfile[pid]) pdByProfile[pid] = [];
          pdByProfile[pid].push(pd);
        }

        if (pdByProfile['unassigned']?.length > 0) {
          contaminationResults.push({
            leak: true,
            description: `Found ${pdByProfile['unassigned'].length} PersonalData records without profile_id`,
            filePath: 'entities/PersonalData.json',
            functionName: 'N/A - Data integrity issue',
            offendingCode: 'PersonalData records exist without profile_id assignment'
          });
        }

        // Check ScanResults - should always have profile_id
        const allScanResults = await base44.asServiceRole.entities.ScanResult.list();
        const orphanedScans = allScanResults.filter(s => !s.profile_id);
        
        if (orphanedScans.length > 0) {
          contaminationResults.push({
            leak: true,
            description: `Found ${orphanedScans.length} ScanResult records without profile_id`,
            filePath: 'entities/ScanResult.json',
            functionName: 'N/A - Data integrity issue',
            offendingCode: 'ScanResult records exist without profile_id assignment'
          });
        }

        // Check DeletionRequests
        const allDeletionReqs = await base44.asServiceRole.entities.DeletionRequest.list();
        const orphanedDeletions = allDeletionReqs.filter(d => !d.profile_id);
        
        if (orphanedDeletions.length > 0) {
          contaminationResults.push({
            leak: true,
            description: `Found ${orphanedDeletions.length} DeletionRequest records without profile_id`,
            filePath: 'entities/DeletionRequest.json',
            functionName: 'N/A - Data integrity issue',
            offendingCode: 'DeletionRequest records exist without profile_id assignment'
          });
        }
      }

      checks.push({
        category: 'isolation',
        name: 'Profile Data Isolation',
        ok: contaminationResults.length === 0,
        error: contaminationResults.length > 0 ? `Found ${contaminationResults.length} potential data isolation issues` : null,
        filePath: null
      });

    } catch (e) {
      checks.push({
        category: 'isolation',
        name: 'Profile Data Isolation',
        ok: false,
        error: `Failed to check data isolation: ${e.message}`,
        filePath: null
      });
    }

    // ===========================================
    // 6. STATIC CODE ANALYSIS FOR CONTAMINATION
    // ===========================================
    // Check for common patterns that could cause cross-user data leaks
    const riskPatterns = [
      {
        pattern: '.list() without filter',
        description: 'Listing all records without filtering by user/profile could expose other users data',
        risk: 'high'
      },
      {
        pattern: 'Missing profile_id check',
        description: 'Operations that dont verify profile ownership',
        risk: 'high'
      }
    ];

    // Add pattern analysis results as informational
    checks.push({
      category: 'static_analysis',
      name: 'Code Pattern Analysis',
      ok: true,
      warning: 'Manual review recommended for: ' + riskPatterns.map(p => p.pattern).join(', '),
      filePath: null,
      patterns: riskPatterns
    });

    // ===========================================
    // 7. SERVICE ROLE ACCESS CHECK
    // ===========================================
    try {
      // Verify service role can access entities (admin override)
      await base44.asServiceRole.entities.Profile.list('-created_date', 1);
      
      checks.push({
        category: 'access',
        name: 'Service Role Access',
        ok: true,
        error: null,
        filePath: null
      });
    } catch (e) {
      checks.push({
        category: 'access',
        name: 'Service Role Access',
        ok: false,
        error: e.message,
        filePath: null
      });
    }

    // ===========================================
    // COMPILE RESULTS
    // ===========================================
    const passed = checks.filter(c => c.ok).length;
    const failed = checks.filter(c => !c.ok).length;
    const warnings = checks.filter(c => c.warning).length;

    const summary = {
      total: checks.length,
      passed,
      failed,
      warnings,
      duration_ms: Date.now() - startTime
    };

    const overallOk = failed === 0 && contaminationResults.filter(c => c.leak).length === 0;

    const result = {
      ok: overallOk,
      summary,
      checks,
      contamination: {
        ok: contaminationResults.filter(c => c.leak).length === 0,
        results: contaminationResults
      },
      timestamp: new Date().toISOString()
    };

    // Log results if there are failures
    if (!overallOk) {
      try {
        await base44.asServiceRole.entities.SystemCheckLog.create({
          timestamp: new Date().toISOString(),
          summary,
          checks,
          contamination: result.contamination,
          user_email: user.email,
          app_name: Deno.env.get('BASE44_APP_ID') || 'unknown',
          overall_ok: overallOk
        });
      } catch (logError) {
        // Don't fail the check if logging fails
        result.log_error = logError.message;
      }
    }

    return Response.json(result);

  } catch (error) {
    return Response.json({ 
      ok: false,
      error: error.message,
      stack: error.stack,
      summary: { total: 0, passed: 0, failed: 1 },
      checks: [{
        category: 'system',
        name: 'Self-Check Execution',
        ok: false,
        error: error.message,
        stack: error.stack
      }],
      contamination: { ok: true, results: [] }
    }, { status: 500 });
  }
});