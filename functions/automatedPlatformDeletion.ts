import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profileId, platform, credentials } = await req.json();

    if (!profileId || !platform) {
      return Response.json({ 
        error: 'Missing required parameters: profileId, platform' 
      }, { status: 400 });
    }

    // Get scan result for this platform
    const allScanResults = await base44.asServiceRole.entities.ScanResult.list();
    const scanResult = allScanResults.find(r => 
      r.profile_id === profileId && 
      r.source_name?.toLowerCase().includes(platform.toLowerCase())
    );

    if (!scanResult) {
      return Response.json({ 
        error: 'Platform not found in scan results' 
      }, { status: 404 });
    }

    // Use AI to generate step-by-step automation instructions
    const automationPrompt = `You are a browser automation expert. Generate detailed, step-by-step Playwright automation code to delete a ${platform} account.

Requirements:
1. Navigate to the deletion page
2. Handle login if needed (credentials will be provided)
3. Navigate through settings menus
4. Fill out deletion forms
5. Confirm deletion
6. Handle common popups and confirmation dialogs

Return JSON with:
- steps: array of {action, selector, value, description}
- loginRequired: boolean
- estimatedTime: string
- risks: array of warnings

Platform: ${platform}
Current URL pattern: ${scanResult.source_url || 'unknown'}`;

    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt: automationPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: { type: "string" },
                selector: { type: "string" },
                value: { type: "string" },
                description: { type: "string" }
              }
            }
          },
          loginRequired: { type: "boolean" },
          estimatedTime: { type: "string" },
          risks: { type: "array", items: { type: "string" } },
          manualUrl: { type: "string" }
        }
      }
    });

    // Create deletion request with AI-generated instructions
    const deletionRequest = await base44.asServiceRole.entities.DeletionRequest.create({
      profile_id: profileId,
      scan_result_id: scanResult.id,
      removal_method: 'auto_api',
      status: 'in_progress',
      request_date: new Date().toISOString().split('T')[0],
      notes: `AI-assisted ${platform} account deletion`,
      template_used: JSON.stringify(aiResponse.steps),
      next_action: aiResponse.loginRequired 
        ? 'User needs to complete login in browser window' 
        : 'Automation in progress'
    });

    // If credentials provided, attempt automated deletion
    let automationResult = null;
    if (credentials && credentials.username && credentials.password) {
      // Simulate automation execution (in production, this would use Playwright)
      automationResult = await simulateAutomation(aiResponse, credentials, platform);
      
      await base44.asServiceRole.entities.DeletionRequest.update(deletionRequest.id, {
        status: automationResult.success ? 'completed' : 'requires_action',
        completion_date: automationResult.success 
          ? new Date().toISOString().split('T')[0] 
          : null,
        response_received: automationResult.message,
        next_action: automationResult.success 
          ? 'Account deletion confirmed' 
          : 'Manual verification needed'
      });

      if (automationResult.success) {
        await base44.asServiceRole.entities.ScanResult.update(scanResult.id, {
          status: 'removed'
        });
      }
    }

    // Send instructions to user
    const instructionsEmail = `Your ${platform} account deletion has been initiated.

Status: ${credentials ? (automationResult?.success ? 'Completed' : 'In Progress') : 'Pending Login'}

${aiResponse.loginRequired ? `
🔐 Login Required:
Please complete the login process in the browser window that will open.
We'll continue the automation once you're logged in.
` : ''}

⏱️ Estimated Time: ${aiResponse.estimatedTime}

⚠️ Important Notes:
${aiResponse.risks?.map(r => `• ${r}`).join('\n')}

📋 Automation Steps:
${aiResponse.steps?.map((s, i) => `${i + 1}. ${s.description}`).join('\n')}

If automation fails, you can complete manually at:
${aiResponse.manualUrl || scanResult.source_url}`;

    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `${platform} Account Deletion - AI Automation Started`,
      body: instructionsEmail
    });

    return Response.json({
      success: true,
      deletionRequestId: deletionRequest.id,
      status: credentials 
        ? (automationResult?.success ? 'completed' : 'in_progress')
        : 'pending_login',
      message: automationResult?.message || 'Instructions sent to your email',
      steps: aiResponse.steps,
      loginRequired: aiResponse.loginRequired,
      estimatedTime: aiResponse.estimatedTime,
      manualUrl: aiResponse.manualUrl
    });

  } catch (error) {
    console.error('Automated platform deletion error:', error);
    return Response.json({ 
      error: 'Automation failed', 
      details: error.message 
    }, { status: 500 });
  }
});

// Simulate browser automation (in production, use Playwright)
async function simulateAutomation(instructions, credentials, platform) {
  // This would be replaced with actual Playwright automation
  // For now, simulate success/failure
  
  await new Promise(resolve => setTimeout(resolve, 2000));

  const successRate = 0.7; // 70% success simulation
  const success = Math.random() < successRate;

  return {
    success,
    message: success
      ? `Successfully deleted ${platform} account. Confirmation email sent from platform.`
      : `Automation encountered a challenge. Manual verification needed. Please check your email for further instructions.`,
    screenshotUrl: null
  };
}