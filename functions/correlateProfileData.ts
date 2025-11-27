import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profileId, findings, userPII } = await req.json();

    if (!profileId) {
      return Response.json({ error: 'profileId is required' }, { status: 400 });
    }

    // If findings not provided, fetch from existing scan results
    let correlationFindings = findings || [];
    
    if (!findings) {
      const allScanResults = await base44.asServiceRole.entities.ScanResult.list();
      correlationFindings = allScanResults
        .filter(r => r.profile_id === profileId)
        .map(r => ({
          source_name: r.source_name,
          source_url: r.source_url,
          source_type: r.source_type,
          matched_fields: r.metadata?.matched_fields || r.data_exposed || [],
          matched_values: r.metadata?.matched_values || [],
          confidence: r.metadata?.confidence || 70,
          severity: r.risk_score >= 80 ? 'critical' : r.risk_score >= 60 ? 'high' : r.risk_score >= 40 ? 'medium' : 'low',
          is_impersonation: r.metadata?.is_impersonation || false,
          explanation: r.metadata?.explanation || r.metadata?.details || ''
        }));
    }

    // Correlation weights
    const fieldWeights = {
      ssn: 100,
      dob: 80,
      phone: 70,
      email: 65,
      address: 60,
      username: 55,
      alias: 50,
      employer: 40,
      name: 20 // Low weight for name alone
    };

    const sourceTypeMultipliers = {
      breach_database: 2.0,
      data_broker: 1.8,
      people_finder: 1.7,
      court_record: 1.6,
      paste: 1.5,
      forum: 1.3,
      social_media: 1.2,
      news: 1.0,
      other: 1.0
    };

    const severityMultipliers = {
      critical: 2.5,
      high: 1.8,
      medium: 1.3,
      low: 1.0
    };

    // Categorize findings
    const impersonationAlerts = [];
    const brokerFindings = [];
    const breachFindings = [];
    const socialFindings = [];
    const osintFindings = [];
    const courtFindings = [];
    
    const validMatches = [];

    for (const finding of correlationFindings) {
      const matchedFields = finding.matched_fields || [];
      
      // RULE B: Name requires 2+ additional matches
      const hasNameOnly = matchedFields.length === 1 && 
        matchedFields[0]?.toLowerCase().includes('name');
      
      if (hasNameOnly) continue; // Skip name-only matches
      
      // Check if name + less than 2 other fields
      const nameFields = matchedFields.filter(f => f?.toLowerCase().includes('name'));
      const nonNameFields = matchedFields.filter(f => !f?.toLowerCase().includes('name'));
      
      if (nameFields.length > 0 && nonNameFields.length < 2) {
        continue; // Skip - doesn't meet name+2 rule
      }

      // RULE A: Single strong data point = valid match
      const hasStrongMatch = matchedFields.some(f => {
        const field = f?.toLowerCase() || '';
        return ['email', 'phone', 'ssn', 'dob', 'address', 'username', 'alias'].some(
          strong => field.includes(strong)
        );
      });

      if (!hasStrongMatch && matchedFields.length < 2) continue;

      // Calculate match score
      let matchScore = 0;
      for (const field of matchedFields) {
        const fieldLower = field?.toLowerCase() || '';
        for (const [key, weight] of Object.entries(fieldWeights)) {
          if (fieldLower.includes(key)) {
            matchScore += weight;
            break;
          }
        }
      }

      // Apply multipliers
      const sourceMultiplier = sourceTypeMultipliers[finding.source_type] || 1.0;
      const severityMultiplier = severityMultipliers[finding.severity] || 1.0;
      
      const finalScore = Math.min(100, matchScore * sourceMultiplier * severityMultiplier * 0.5);

      const enrichedMatch = {
        source: finding.source_name,
        source_url: finding.source_url,
        source_type: finding.source_type,
        matched_fields: matchedFields,
        url: finding.source_url,
        severity: finding.severity,
        confidence: finding.confidence || 70,
        match_score: Math.round(finalScore),
        is_impersonation: finding.is_impersonation,
        explanation: finding.explanation
      };

      validMatches.push(enrichedMatch);

      // Categorize
      if (finding.is_impersonation) {
        impersonationAlerts.push(enrichedMatch);
      }
      
      switch (finding.source_type) {
        case 'data_broker':
        case 'people_finder':
          brokerFindings.push(enrichedMatch);
          break;
        case 'breach_database':
        case 'paste':
          breachFindings.push(enrichedMatch);
          break;
        case 'social_media':
          socialFindings.push(enrichedMatch);
          break;
        case 'court_record':
          courtFindings.push(enrichedMatch);
          break;
        default:
          osintFindings.push(enrichedMatch);
      }
    }

    // Calculate unified risk score
    let riskScore = 0;
    
    // Base score from match scores
    const avgMatchScore = validMatches.length > 0 
      ? validMatches.reduce((sum, m) => sum + m.match_score, 0) / validMatches.length 
      : 0;
    
    riskScore += avgMatchScore * 0.4;
    
    // Impersonation penalty
    riskScore += impersonationAlerts.length * 15;
    
    // Breach penalty
    riskScore += breachFindings.length * 10;
    
    // Broker penalty
    riskScore += brokerFindings.length * 8;
    
    // Volume penalty
    riskScore += Math.min(20, validMatches.length * 2);
    
    // Critical findings penalty
    const criticalCount = validMatches.filter(m => m.severity === 'critical').length;
    riskScore += criticalCount * 10;
    
    riskScore = Math.min(100, Math.round(riskScore));

    // Generate AI explanation
    const explanationPrompt = `IMPORTANT SAFETY RULES:
- NEVER fabricate breach data, impersonation findings, exposures, or personal details.
- NEVER invent platforms, people, websites, or records.
- NEVER guess. If unsure, explicitly say 'uncertain.'
- ONLY summarize the actual data provided.
- If a detail is not present in the evidence, DO NOT add it.

Based on these identity scan results, provide a brief risk assessment:

Total Matches: ${validMatches.length}
Impersonation Alerts: ${impersonationAlerts.length}
Breach Exposures: ${breachFindings.length}
Data Broker Listings: ${brokerFindings.length}
Risk Score: ${riskScore}/100

Top Findings:
${validMatches.slice(0, 5).map(m => `- ${m.source}: ${m.matched_fields.join(', ')} (${m.severity})`).join('\n')}

Provide:
1. A 2-sentence executive summary
2. The top 3 recommended actions
3. Which exposures are most urgent`;

    const aiExplanation = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: explanationPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          executive_summary: { type: "string" },
          recommended_actions: { type: "array", items: { type: "string" } },
          urgent_exposures: { type: "array", items: { type: "string" } }
        }
      }
    });

    return Response.json({
      success: true,
      matches: validMatches,
      impersonationAlerts,
      brokerFindings,
      breachFindings,
      socialFindings,
      osintFindings,
      courtFindings,
      risk_score: riskScore,
      analysis: aiExplanation,
      stats: {
        total_matches: validMatches.length,
        impersonations: impersonationAlerts.length,
        breaches: breachFindings.length,
        brokers: brokerFindings.length,
        social: socialFindings.length,
        osint: osintFindings.length,
        court: courtFindings.length
      }
    });

  } catch (error) {
    // SECURITY: Do not log full error details
    console.error('Correlation engine error occurred');
    return Response.json({ error: 'An error occurred during correlation analysis' }, { status: 500 });
  }
});