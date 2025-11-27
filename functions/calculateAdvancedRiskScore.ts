import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profileId } = await req.json();

    if (!profileId) {
      return Response.json({ error: 'profileId is required' }, { status: 400 });
    }

    // Fetch all relevant data
    const [allPersonalData, allScanResults, allSocialFindings] = await Promise.all([
      base44.asServiceRole.entities.PersonalData.list(),
      base44.asServiceRole.entities.ScanResult.list(),
      base44.asServiceRole.entities.SocialMediaFinding.list()
    ]);

    const personalData = allPersonalData.filter(d => d.profile_id === profileId);
    const scanResults = allScanResults.filter(r => r.profile_id === profileId);
    const socialFindings = allSocialFindings.filter(f => f.profile_id === profileId);

    // Calculate data sensitivity scores
    const sensitivityWeights = {
      ssn: 100,
      passport: 95,
      drivers_license: 90,
      credit_card: 90,
      bank_account: 85,
      medical_id: 80,
      tax_id: 85,
      green_card: 90,
      dob: 70,
      address: 60,
      phone: 50,
      email: 45,
      full_name: 40,
      username: 30,
      employer: 25,
      relative: 20,
      alias: 20,
      student_id: 30,
      vehicle_vin: 40,
      property_deed: 50
    };

    // Calculate source reputation scores
    const sourceRiskMultipliers = {
      breach_database: 2.0,
      data_broker: 1.8,
      dark_web: 2.5,
      public_record: 1.3,
      social_media: 1.2,
      forum: 1.5,
      people_finder: 1.7,
      court_record: 1.6,
      paste: 1.5,
      news: 1.0,
      other: 1.0
    };

    // Impersonation weight
    const impersonationWeight = 25;
    
    // Public visibility multipliers (higher exposure = higher risk)
    const publicVisibilityMultipliers = {
      google_indexed: 1.5,
      twitter_public: 1.3,
      reddit_public: 1.3,
      facebook_public: 1.4
    };

    // Analyze data correlations
    const correlationPrompt = `IMPORTANT SAFETY RULES:
- NEVER fabricate breach data, impersonation findings, exposures, or personal details.
- NEVER invent platforms, people, websites, or records.
- NEVER guess. If unsure, explicitly say 'uncertain.'
- ONLY use the JSON evidence provided.
- NEVER output private information unless masked.
- NEVER output passwords, full SSN, full DOB, or exact address.

Analyze the following personal data for correlation risks:

${personalData.map(d => `${d.data_type}: ${d.monitoring_enabled ? 'monitored' : 'not monitored'}`).join('\n')}

Exposed data from scans:
${scanResults.map(r => `${r.source_type}: ${r.data_exposed?.join(', ')}`).join('\n')}

Identify:
1. High-risk combinations (e.g., SSN + DOB + Address = identity theft risk)
2. Data points that together enable account takeover
3. Information that could be used for social engineering
4. Exposed credentials that match monitored accounts

Return JSON with:
- high_risk_combinations: array of {data_types: [], risk_score: 0-100, threat: string}
- correlation_multiplier: 1.0-3.0 (how much correlated exposure increases risk)
- specific_threats: array of threat descriptions`;

    const correlationAnalysis = await base44.integrations.Core.InvokeLLM({
      prompt: correlationPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          high_risk_combinations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                data_types: { type: "array", items: { type: "string" } },
                risk_score: { type: "number" },
                threat: { type: "string" }
              }
            }
          },
          correlation_multiplier: { type: "number" },
          specific_threats: { type: "array", items: { type: "string" } }
        }
      }
    });

    // Calculate base risk scores for scan results
    let totalRisk = 0;
    const enhancedScanResults = [];

    for (const result of scanResults) {
      const dataTypes = result.data_exposed || [];
      let baseScore = result.risk_score || 0;

      // Apply sensitivity weighting
      const sensitivityScore = dataTypes.reduce((sum, type) => {
        return sum + (sensitivityWeights[type] || 30);
      }, 0) / Math.max(dataTypes.length, 1);

      // Apply source reputation multiplier
      const reputationMultiplier = sourceRiskMultipliers[result.source_type] || 1.0;

      // Apply exposure pattern analysis (more recent = higher risk)
      const daysSinceScan = result.scan_date 
        ? (new Date() - new Date(result.scan_date)) / (1000 * 60 * 60 * 24)
        : 30;
      const recencyMultiplier = daysSinceScan < 30 ? 1.3 : daysSinceScan < 90 ? 1.1 : 1.0;

      // Apply correlation multiplier
      const correlationMultiplier = correlationAnalysis.correlation_multiplier || 1.0;

      // Calculate advanced risk score
      const advancedScore = Math.min(100, 
        (sensitivityScore * reputationMultiplier * recencyMultiplier * correlationMultiplier) * 0.8
      );

      enhancedScanResults.push({
        id: result.id,
        original_score: baseScore,
        advanced_score: Math.round(advancedScore),
        sensitivity_score: Math.round(sensitivityScore),
        reputation_multiplier: reputationMultiplier,
        recency_multiplier: recencyMultiplier,
        correlation_multiplier: correlationMultiplier
      });

      totalRisk += advancedScore;
    }

    // Factor in social media findings
    const socialRisk = socialFindings
      .filter(f => f.status === 'new' || f.status === 'investigating')
      .reduce((sum, f) => {
        const severityScores = { critical: 90, high: 70, medium: 50, low: 30 };
        return sum + (severityScores[f.severity] || 30);
      }, 0);

    // Calculate impersonation risk
    const impersonationFindings = socialFindings.filter(f => 
      f.finding_type === 'impersonation' || f.finding_type === 'identity_theft'
    );
    const impersonationRisk = impersonationFindings.length * impersonationWeight;

    // Calculate confirmed PII match bonus (name+2 rule findings get extra weight)
    const confirmedPIIMatches = scanResults.filter(r => {
      const matchedFields = r.metadata?.matched_fields || r.data_exposed || [];
      const nonNameFields = matchedFields.filter(f => !f?.toLowerCase().includes('name'));
      return nonNameFields.length >= 2;
    });
    const confirmedMatchBonus = confirmedPIIMatches.length * 5;

    // Frequency penalty - more appearances = higher risk
    const frequencyPenalty = Math.min(20, scanResults.length * 1.5);

    // Calculate overall risk score with all factors
    const exposureCount = scanResults.length + socialFindings.length;
    const baseAverageRisk = exposureCount > 0 
      ? (totalRisk + socialRisk) / exposureCount 
      : 0;
    
    // Combine all risk factors
    const averageRisk = Math.min(100, 
      baseAverageRisk + 
      impersonationRisk + 
      confirmedMatchBonus + 
      frequencyPenalty
    );

    // Update scan results with advanced scores
    for (const enhanced of enhancedScanResults) {
      await base44.asServiceRole.entities.ScanResult.update(enhanced.id, {
        risk_score: enhanced.advanced_score
      });
    }

    // Create risk analysis insight
    await base44.asServiceRole.entities.AIInsight.create({
      profile_id: profileId,
      insight_type: 'risk_prediction',
      title: 'Advanced Risk Analysis Complete',
      description: `Analyzed ${personalData.length} data points and ${exposureCount} exposures. Found ${correlationAnalysis.high_risk_combinations.length} high-risk data correlations.`,
      severity: averageRisk > 70 ? 'high' : averageRisk > 40 ? 'medium' : 'low',
      recommendations: [
        ...correlationAnalysis.specific_threats.slice(0, 3),
        'Review high-risk combinations in your data vault',
        'Consider removal requests for high-risk exposures'
      ],
      confidence_score: 85,
      data_points: correlationAnalysis.high_risk_combinations.map(c => c.threat),
      is_read: false
    });

    return Response.json({
      success: true,
      overall_risk_score: Math.round(averageRisk),
      exposure_count: exposureCount,
      high_risk_combinations: correlationAnalysis.high_risk_combinations,
      correlation_multiplier: correlationAnalysis.correlation_multiplier,
      specific_threats: correlationAnalysis.specific_threats,
      enhanced_results: enhancedScanResults
    });

  } catch (error) {
    // SECURITY: Do not log full error details
    console.error('Advanced risk calculation error occurred');
    return Response.json({ 
      error: 'Failed to calculate advanced risk score',
      details: 'An error occurred during risk calculation'
    }, { status: 500 });
  }
});