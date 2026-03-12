const STORAGE_PREFIX = 'incognito_entity_';
const SETTINGS_KEY = 'incognito_api_keys';

function generateId() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

export function getApiKeys() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch { return {}; }
}

export function setApiKeys(keys) {
  const current = getApiKeys();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...keys }));
}

function createEntityStore(entityName) {
  const storageKey = STORAGE_PREFIX + entityName;

  function getAll() {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveAll(items) {
    localStorage.setItem(storageKey, JSON.stringify(items));
  }

  return {
    async list(sortField, limit) {
      let items = getAll();
      if (sortField && typeof sortField === 'string') {
        const desc = sortField.startsWith('-');
        const field = desc ? sortField.slice(1) : sortField;
        items.sort((a, b) => {
          const aVal = a[field] ?? '';
          const bVal = b[field] ?? '';
          if (aVal < bVal) return desc ? 1 : -1;
          if (aVal > bVal) return desc ? -1 : 1;
          return 0;
        });
      }
      if (typeof limit === 'number' && limit > 0) {
        items = items.slice(0, limit);
      }
      return items;
    },

    async create(data) {
      const items = getAll();
      const now = new Date().toISOString();
      const newItem = { id: generateId(), ...data, created_date: now, updated_date: now };
      items.push(newItem);
      saveAll(items);
      return newItem;
    },

    async update(id, data) {
      const items = getAll();
      const idx = items.findIndex((item) => item.id === id);
      if (idx === -1) return null;
      items[idx] = { ...items[idx], ...data, id, updated_date: new Date().toISOString() };
      saveAll(items);
      return items[idx];
    },

    async delete(id) {
      const items = getAll();
      const filtered = items.filter((item) => item.id !== id);
      if (filtered.length === items.length) return false;
      saveAll(filtered);
      return true;
    },

    async filter(criteria) {
      const items = getAll();
      return items.filter(item => {
        for (const [key, value] of Object.entries(criteria)) {
          if (item[key] !== value) return false;
        }
        return true;
      });
    },
  };
}

const ENTITY_NAMES = [
  'Profile', 'PersonalData', 'ScanResult', 'SocialMediaFinding',
  'SocialMediaProfile', 'SocialMediaMention', 'ExposureFixLog',
  'FinancialAccount', 'SuspiciousActivity', 'UserPreferences',
  'SpamIncident', 'NotificationAlert', 'MonitoredAccount',
  'DisposableCredential', 'DeletionRequest', 'DeletionEmailResponse',
  'AIInsight', 'DigitalFootprintReport', 'SearchQueryFinding',
];

const entities = {};
for (const name of ENTITY_NAMES) {
  entities[name] = createEntityStore(name);
}

// ---------------------------------------------------------------------------
// LLM Integration (OpenAI-compatible)
// ---------------------------------------------------------------------------
async function invokeLLM({ prompt, response_json_schema, add_context_from_internet }) {
  const keys = getApiKeys();
  if (!keys.openai_api_key) {
    throw new Error('OpenAI API key not configured. Go to Settings → API Keys to add it.');
  }

  const messages = [{ role: 'user', content: prompt }];
  const body = {
    model: keys.openai_model || 'gpt-4o-mini',
    messages,
    temperature: 0.3,
  };

  if (response_json_schema) {
    body.response_format = { type: 'json_object' };
    messages[0].content += '\n\nRespond ONLY with valid JSON matching this schema: ' + JSON.stringify(response_json_schema);
  }

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${keys.openai_api_key}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';

  if (response_json_schema) {
    try { return JSON.parse(content); } catch { return content; }
  }
  return content;
}

// ---------------------------------------------------------------------------
// Privacy.com API helpers
// ---------------------------------------------------------------------------
async function privacyComApi(endpoint, method = 'GET', body = null) {
  const keys = getApiKeys();
  if (!keys.privacy_com_api_key) {
    throw new Error('Privacy.com API key not configured. Go to Settings → API Keys.');
  }
  const baseUrl = keys.privacy_com_sandbox ? 'https://sandbox.privacy.com/v1' : 'https://api.privacy.com/v1';
  const opts = {
    method,
    headers: {
      'Authorization': `api-key ${keys.privacy_com_api_key}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${baseUrl}${endpoint}`, opts);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Privacy.com API error (${resp.status}): ${text}`);
  }
  return resp.json();
}

// ---------------------------------------------------------------------------
// HIBP API helpers
// ---------------------------------------------------------------------------
async function hibpApi(endpoint) {
  const keys = getApiKeys();
  if (!keys.hibp_api_key) {
    throw new Error('HIBP API key not configured. Go to Settings → API Keys.');
  }
  const resp = await fetch(`https://haveibeenpwned.com/api/v3${endpoint}`, {
    headers: {
      'hibp-api-key': keys.hibp_api_key,
      'user-agent': 'Incognito-Privacy-App',
    },
  });
  if (resp.status === 404) return [];
  if (resp.status === 429) throw new Error('HIBP rate limit exceeded. Wait 6 seconds and retry.');
  if (!resp.ok) throw new Error(`HIBP API error (${resp.status})`);
  return resp.json();
}

// ---------------------------------------------------------------------------
// Local function implementations
// ---------------------------------------------------------------------------
const localFunctions = {
  async checkHIBP({ email }) {
    const breaches = await hibpApi(`/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`);
    return { data: { found: breaches.length > 0, breaches, email } };
  },

  async checkBreaches({ emails, profileId }) {
    const allBreaches = [];
    for (const email of (emails || [])) {
      try {
        const breaches = await hibpApi(`/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`);
        for (const b of breaches) {
          allBreaches.push({
            source_name: b.Name,
            breach_date: b.BreachDate,
            data_exposed: b.DataClasses || [],
            risk_score: b.DataClasses?.some(d => /password|ssn|credit/i.test(d)) ? 90 : 60,
            email,
          });
        }
        await new Promise(r => setTimeout(r, 1600));
      } catch (e) {
        if (!e.message.includes('404')) console.warn(`[checkBreaches] ${email}:`, e.message);
      }
    }

    for (const b of allBreaches) {
      await entities.ScanResult.create({
        profile_id: profileId,
        source_name: b.source_name,
        source_type: 'breach_database',
        risk_score: b.risk_score,
        data_exposed: b.data_exposed,
        breach_date: b.breach_date,
        status: 'new',
        scan_date: new Date().toISOString().split('T')[0],
        metadata: { email: b.email },
      });
    }

    return { data: { total: allBreaches.length, breaches: allBreaches } };
  },

  async checkPasswordBreach({ password }) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const resp = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    const text = await resp.text();
    const match = text.split('\n').find(line => line.startsWith(suffix));
    const count = match ? parseInt(match.split(':')[1]) : 0;
    return { data: { compromised: count > 0, count, hash_prefix: prefix } };
  },

  async listCards() {
    const result = await privacyComApi('/card?page_size=50');
    return { data: result.data || [] };
  },

  async listSubscriptions({ cardToken }) {
    const result = await privacyComApi(`/transaction?card_token=${cardToken}&page_size=100`);
    const txns = result.data || [];

    const merchantMap = {};
    for (const txn of txns) {
      const merchant = txn.merchant?.descriptor || txn.merchant?.city || 'Unknown';
      if (!merchantMap[merchant]) {
        merchantMap[merchant] = { merchant, count: 0, total: 0, transactions: [], card_token: cardToken };
      }
      merchantMap[merchant].count++;
      merchantMap[merchant].total += txn.amount || 0;
      merchantMap[merchant].transactions.push(txn);
    }

    const subs = Object.values(merchantMap)
      .filter(m => m.count >= 2)
      .map(m => {
        const sorted = m.transactions.sort((a, b) => new Date(a.created) - new Date(b.created));
        const intervals = [];
        for (let i = 1; i < sorted.length; i++) {
          intervals.push((new Date(sorted[i].created) - new Date(sorted[i - 1].created)) / 86400000);
        }
        const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : null;
        return {
          merchant: m.merchant,
          count: m.count,
          total: m.total,
          card_token: m.card_token,
          first_transaction: sorted[0]?.created,
          last_transaction: sorted[sorted.length - 1]?.created,
          estimated_interval_days: avgInterval,
        };
      })
      .sort((a, b) => b.total - a.total);

    return { data: subs };
  },

  async generateVirtualCard({ purpose, website, spendLimit }) {
    const result = await privacyComApi('/card', 'POST', {
      type: 'MERCHANT_LOCKED',
      memo: purpose || `Card for ${website}`,
      spend_limit: spendLimit || 10000,
      spend_limit_duration: 'MONTHLY',
    });
    return { data: { card: result } };
  },

  async closeCard({ cardToken }) {
    const result = await privacyComApi(`/card`, 'PUT', { card_token: cardToken, state: 'CLOSED' });
    return { data: result };
  },

  async pauseCard({ cardToken }) {
    const currentCards = await privacyComApi('/card?page_size=50');
    const card = (currentCards.data || []).find(c => c.token === cardToken);
    const newState = card?.state === 'PAUSED' ? 'OPEN' : 'PAUSED';
    const result = await privacyComApi(`/card`, 'PUT', { card_token: cardToken, state: newState });
    return { data: result };
  },

  async detectSearchQueries({ profileId, fullName, emails, phones, addresses }) {
    const result = await invokeLLM({
      prompt: `Search the internet for where this person's data appears on data broker sites, people-search sites, and public records.

Person: ${fullName}
Emails: ${(emails || []).join(', ')}
Phones: ${(phones || []).join(', ')}
Addresses: ${(addresses || []).join(', ')}

For each exposure found, provide:
- site_name: The website name
- site_url: URL where the data appears
- data_found: Array of what data is exposed (name, email, phone, address, etc.)
- risk_level: "high", "medium", or "low"
- removal_difficulty: "easy", "medium", "hard"
- removal_url: URL to request removal (if available)`,
      response_json_schema: {
        type: 'object',
        properties: {
          exposures: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                site_name: { type: 'string' },
                site_url: { type: 'string' },
                data_found: { type: 'array', items: { type: 'string' } },
                risk_level: { type: 'string' },
                removal_difficulty: { type: 'string' },
                removal_url: { type: 'string' },
              },
            },
          },
        },
      },
      add_context_from_internet: true,
    });

    const exposures = result.exposures || [];
    for (const exp of exposures) {
      await entities.SearchQueryFinding.create({
        profile_id: profileId,
        site_name: exp.site_name,
        site_url: exp.site_url,
        data_found: exp.data_found,
        risk_level: exp.risk_level,
        removal_difficulty: exp.removal_difficulty,
        removal_url: exp.removal_url,
        status: 'new',
      });
    }

    return { data: { total: exposures.length, exposures } };
  },

  async monitorSocialMedia({ profileId, fullName, usernames }) {
    const result = await invokeLLM({
      prompt: `Search for social media accounts and mentions of this person. Look for impersonation, unauthorized use of their name/photo, and mentions in concerning contexts.

Person: ${fullName}
Known usernames: ${(usernames || []).join(', ')}

For each finding:
- platform: Social media platform
- username: The account username found
- profile_url: URL to the profile
- match_type: "impersonation", "mention", "data_exposure", "legitimate"
- confidence: 0-100
- description: What was found`,
      response_json_schema: {
        type: 'object',
        properties: {
          findings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                platform: { type: 'string' },
                username: { type: 'string' },
                profile_url: { type: 'string' },
                match_type: { type: 'string' },
                confidence: { type: 'number' },
                description: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const findings = result.findings || [];
    for (const f of findings) {
      if (f.match_type !== 'legitimate') {
        await entities.SocialMediaFinding.create({
          profile_id: profileId,
          platform: f.platform,
          suspicious_username: f.username,
          profile_url: f.profile_url,
          match_type: f.match_type,
          confidence: f.confidence,
          description: f.description,
          status: 'new',
        });
      }
    }

    return { data: { total: findings.length, findings } };
  },

  async runIdentityScan({ profileId, fullName, emails, phones, addresses }) {
    const result = await invokeLLM({
      prompt: `Perform a comprehensive identity exposure scan for this person. Check for:
1. Data broker listings (Spokeo, WhitePages, BeenVerified, etc.)
2. Public records exposure
3. Social media presence that reveals PII
4. Possible identity cloning indicators
5. Dark web mentions (based on known breach databases)

Person: ${fullName}
Emails: ${(emails || []).join(', ')}
Phones: ${(phones || []).join(', ')}
Addresses: ${(addresses || []).join(', ')}

For each finding provide: source_name, source_type, risk_score (0-100), data_exposed (array), description, remediation_steps`,
      response_json_schema: {
        type: 'object',
        properties: {
          scan_summary: { type: 'string' },
          overall_risk: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          findings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                source_name: { type: 'string' },
                source_type: { type: 'string' },
                risk_score: { type: 'number' },
                data_exposed: { type: 'array', items: { type: 'string' } },
                description: { type: 'string' },
                remediation_steps: { type: 'string' },
              },
            },
          },
        },
      },
    });

    for (const f of (result.findings || [])) {
      await entities.ScanResult.create({
        profile_id: profileId,
        source_name: f.source_name,
        source_type: f.source_type || 'identity_scan',
        risk_score: f.risk_score,
        data_exposed: f.data_exposed,
        description: f.description,
        status: 'new',
        scan_date: new Date().toISOString().split('T')[0],
      });
    }

    return { data: result };
  },

  async correlateProfileData({ profileId }) {
    const [scanResults, socialFindings, searchFindings] = await Promise.all([
      entities.ScanResult.filter({ profile_id: profileId }),
      entities.SocialMediaFinding.filter({ profile_id: profileId }),
      entities.SearchQueryFinding.filter({ profile_id: profileId }),
    ]);

    const result = await invokeLLM({
      prompt: `Analyze these identity scan results and find correlations, patterns, and risk indicators.

Scan Results: ${JSON.stringify(scanResults.slice(0, 20))}
Social Findings: ${JSON.stringify(socialFindings.slice(0, 10))}
Search Findings: ${JSON.stringify(searchFindings.slice(0, 10))}

Provide:
- overall_risk_score: 0-100
- correlations: Array of patterns found (e.g., same data appearing on multiple sites)
- identity_clone_risk: "high", "medium", "low" with explanation
- priority_actions: Array of recommended next steps
- matches: Array of linked findings that show the same exposure across sources`,
      response_json_schema: {
        type: 'object',
        properties: {
          overall_risk_score: { type: 'number' },
          correlations: { type: 'array', items: { type: 'object', properties: { pattern: { type: 'string' }, severity: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } } } } },
          identity_clone_risk: { type: 'object', properties: { level: { type: 'string' }, explanation: { type: 'string' } } },
          priority_actions: { type: 'array', items: { type: 'string' } },
          matches: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, source: { type: 'string' }, data: { type: 'string' }, risk: { type: 'string' } } } },
        },
      },
    });

    return { data: result };
  },

  async checkClassActions({ companyName }) {
    const result = await invokeLLM({
      prompt: `Search for active class action lawsuits or settlements involving "${companyName}" related to data breaches, privacy violations, or identity theft. Only return REAL, verified lawsuits. If none exist, return an empty array.

For each lawsuit: title, status (active/settled/pending), court, deadline, url, how_to_join, matched_company, description`,
      response_json_schema: {
        type: 'object',
        properties: {
          litigation: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' }, status: { type: 'string' }, court: { type: 'string' },
                deadline: { type: 'string' }, url: { type: 'string' }, how_to_join: { type: 'string' },
                matched_company: { type: 'string' }, description: { type: 'string' },
              },
            },
          },
        },
      },
    });
    return { data: result };
  },

  async findAttorneys({ exposureType }) {
    const result = await invokeLLM({
      prompt: `Find attorneys or law firms specializing in ${exposureType || 'identity theft'} and data privacy law. Only return REAL attorneys with verifiable contact info. If unsure, return an empty array.

For each: name, firm, location, phone, email, website, specialties (array), free_consultation (boolean)`,
      response_json_schema: {
        type: 'object',
        properties: {
          attorneys: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' }, firm: { type: 'string' }, location: { type: 'string' },
                phone: { type: 'string' }, email: { type: 'string' }, website: { type: 'string' },
                specialties: { type: 'array', items: { type: 'string' } }, free_consultation: { type: 'boolean' },
              },
            },
          },
        },
      },
    });
    return { data: result };
  },

  async generateEvidencePacket({ findingId, profileId, type }) {
    const [profiles, scanResults, socialFindings] = await Promise.all([
      entities.Profile.list(),
      entities.ScanResult.list(),
      entities.SocialMediaFinding.list(),
    ]);
    const profile = profiles.find(p => p.id === profileId) || profiles[0];
    const finding = socialFindings.find(f => f.id === findingId) || scanResults.find(r => r.id === findingId);

    if (!finding) return { data: { error: 'Finding not found' } };

    const result = await invokeLLM({
      prompt: `Generate a formal ${type === 'law_enforcement' ? 'law enforcement report' : 'attorney consultation'} evidence packet for an identity theft / impersonation case.

Victim: ${profile?.full_name || 'Unknown'}
Finding: ${JSON.stringify(finding)}

The packet should be formatted as a professional document with:
- Case summary
- Timeline of events
- Evidence collected
- Recommended actions
- Legal references`,
    });

    const key = type === 'law_enforcement' ? 'lawEnforcementPacket' : 'attorneyPacket';
    return { data: { [key]: result } };
  },

  async fixExposure({ exposureId, profileId, action }) {
    const result = await invokeLLM({
      prompt: `Generate step-by-step instructions and a pre-written removal request for fixing this data exposure.

Action requested: ${action || 'remove'}
Exposure ID: ${exposureId}
Profile ID: ${profileId}

Provide:
- steps: Array of action steps
- removal_letter: A formal CCPA/GDPR removal request letter
- estimated_time: How long the process takes
- difficulty: easy/medium/hard`,
      response_json_schema: {
        type: 'object',
        properties: {
          steps: { type: 'array', items: { type: 'string' } },
          removal_letter: { type: 'string' },
          estimated_time: { type: 'string' },
          difficulty: { type: 'string' },
        },
      },
    });
    return { data: result };
  },

  async automateDataDeletion({ siteName, siteUrl, profileId, personalData }) {
    const result = await invokeLLM({
      prompt: `Generate a CCPA/GDPR data deletion request for ${siteName} (${siteUrl}).

Personal data to request deletion of: ${JSON.stringify(personalData)}

Provide:
- subject_line: Email subject
- email_body: The full formal deletion request letter (attorney-level quality)
- deletion_url: Direct link to submit the request (if known)
- legal_basis: Which law applies (CCPA, GDPR, state law)
- expected_response_time: How long they have to respond`,
      response_json_schema: {
        type: 'object',
        properties: {
          subject_line: { type: 'string' },
          email_body: { type: 'string' },
          deletion_url: { type: 'string' },
          legal_basis: { type: 'string' },
          expected_response_time: { type: 'string' },
        },
      },
    });
    return { data: result };
  },

  async automateGDPRDeletion({ targetSite, personalData }) {
    return localFunctions.automateDataDeletion({ siteName: targetSite, siteUrl: targetSite, personalData });
  },

  async automatedPlatformDeletion({ platform, accountUrl }) {
    const result = await invokeLLM({
      prompt: `Provide step-by-step instructions to delete an account on ${platform} (${accountUrl || ''}).

Include:
- steps: Numbered steps to delete the account
- direct_url: Direct link to account deletion page
- data_download_url: Link to download your data first (if available)
- estimated_time: How long deletion takes
- notes: Important caveats`,
      response_json_schema: {
        type: 'object',
        properties: {
          steps: { type: 'array', items: { type: 'string' } },
          direct_url: { type: 'string' },
          data_download_url: { type: 'string' },
          estimated_time: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    });
    return { data: result };
  },

  async checkSocialMediaImpersonation({ profileId, fullName, usernames }) {
    return localFunctions.monitorSocialMedia({ profileId, fullName, usernames });
  },

  async searchNoProofSettlements({ profileId }) {
    const scanResults = await entities.ScanResult.list();
    const profileScans = scanResults.filter(s => s.profile_id === profileId);
    const companies = [...new Set(profileScans.map(s => s.source_name).filter(Boolean))];

    const result = await invokeLLM({
      prompt: `Find currently OPEN class action settlements that require NO PROOF OF PURCHASE or minimal proof. Only return REAL, verified settlements with actual claim URLs. An empty array is better than fabricated results.

User's known companies/breaches: ${companies.join(', ') || 'none'}

For each verified settlement:
- settlement_name, company, category, settlement_amount, estimated_individual_payout
- proof_required, proof_difficulty (none/minimal/moderate), eligibility
- claim_deadline, claim_url, website, court, status, filing_time_estimate, confidence (0-100)`,
      response_json_schema: {
        type: 'object',
        properties: {
          settlements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                settlement_name: { type: 'string' }, company: { type: 'string' },
                category: { type: 'string' }, settlement_amount: { type: 'string' },
                estimated_individual_payout: { type: 'string' }, proof_required: { type: 'string' },
                proof_difficulty: { type: 'string' }, eligibility: { type: 'string' },
                claim_deadline: { type: 'string' }, claim_url: { type: 'string' },
                website: { type: 'string' }, court: { type: 'string' },
                status: { type: 'string' }, filing_time_estimate: { type: 'string' },
                confidence: { type: 'number' },
              },
            },
          },
          search_metadata: { type: 'object', properties: { total_found: { type: 'number' } } },
        },
      },
    });

    const settlements = (result.settlements || []).filter(s => s.confidence >= 65 && s.settlement_name);
    const tagged = settlements.map(s => {
      const match = companies.some(c => (s.company || '').toLowerCase().includes(c.toLowerCase()));
      return { ...s, profile_match: match, match_reason: match ? 'Found in your breach history' : null };
    });
    tagged.sort((a, b) => (b.profile_match ? 1 : 0) - (a.profile_match ? 1 : 0));

    return {
      data: {
        settlements: tagged,
        stats: {
          total_found: tagged.length,
          profile_matches: tagged.filter(s => s.profile_match).length,
          no_proof_count: tagged.filter(s => s.proof_difficulty === 'none').length,
          minimal_proof_count: tagged.filter(s => s.proof_difficulty === 'minimal').length,
          categories: [...new Set(tagged.map(s => s.category))],
          profile_companies_checked: companies,
        },
        metadata: result.search_metadata,
      },
    };
  },

  async analyzeBreachNotice({ noticeText, profileId }) {
    const analysis = await invokeLLM({
      prompt: `Analyze this DATA BREACH NOTIFICATION. Extract: company_name, breach_date, data_types_exposed (array), affected_count, breach_description, remediation_offered, remediation_provider, claim_deadline, severity_assessment (critical/high/medium/low), class_action_mentioned (boolean), class_action_details.

--- BREACH NOTICE ---
${(noticeText || '').slice(0, 8000)}
--- END ---`,
      response_json_schema: {
        type: 'object',
        properties: {
          company_name: { type: 'string' }, breach_date: { type: 'string' },
          data_types_exposed: { type: 'array', items: { type: 'string' } },
          affected_count: { type: 'string' }, breach_description: { type: 'string' },
          remediation_offered: { type: 'string' }, remediation_provider: { type: 'string' },
          claim_deadline: { type: 'string' }, severity_assessment: { type: 'string' },
          class_action_mentioned: { type: 'boolean' },
          class_action_details: { type: 'object', properties: { case_name: { type: 'string' }, settlement_url: { type: 'string' } } },
        },
      },
    });

    let classActions = [];
    if (analysis.company_name) {
      try {
        const caResult = await localFunctions.checkClassActions({ companyName: analysis.company_name });
        classActions = caResult.data?.litigation || [];
      } catch { /* continue */ }
    }

    if (profileId && analysis.company_name) {
      await entities.ScanResult.create({
        profile_id: profileId,
        source_name: analysis.company_name,
        source_type: 'breach_notice',
        risk_score: analysis.severity_assessment === 'critical' ? 95 : analysis.severity_assessment === 'high' ? 80 : 60,
        data_exposed: analysis.data_types_exposed || [],
        breach_date: analysis.breach_date,
        status: 'new',
        scan_date: new Date().toISOString().split('T')[0],
      });
    }

    return {
      data: {
        analysis,
        class_actions: { total_found: classActions.length, combined: classActions },
        profile_impact: {
          severity: analysis.severity_assessment,
          data_at_risk: analysis.data_types_exposed || [],
          action_required: ['critical', 'high'].includes(analysis.severity_assessment),
          has_class_action: classActions.length > 0,
          has_remediation: !!analysis.remediation_offered,
        },
      },
    };
  },

  async generateEmailAlias({ profileId, purpose, website }) {
    const ts = Date.now().toString(36);
    const alias = `incognito+${purpose?.replace(/\s+/g, '') || 'alias'}_${ts}@protonmail.com`;
    await entities.DisposableCredential.create({
      profile_id: profileId,
      type: 'email_alias',
      value: alias,
      purpose,
      website,
    });
    return { data: { alias } };
  },

  async monitorDeletionResponses() {
    return { data: { message: 'Gmail monitoring requires OAuth setup. Check your email manually for deletion confirmation responses.' } };
  },

  async getFunctionDetails({ functionName }) {
    return { data: { name: functionName, status: 'local', description: `Function ${functionName} runs locally` } };
  },

  async testAllFunctions() {
    const results = {};
    for (const name of Object.keys(localFunctions)) {
      results[name] = { status: 'available' };
    }
    return { data: results };
  },

  async listClassActions({ company }) {
    return { data: { lawsuits: [] } };
  },

  async listBills() {
    return { data: [] };
  },

  async calculateAdvancedRiskScore({ profileId }) {
    const [scans, social, search] = await Promise.all([
      entities.ScanResult.filter({ profile_id: profileId }),
      entities.SocialMediaFinding.filter({ profile_id: profileId }),
      entities.SearchQueryFinding.filter({ profile_id: profileId }),
    ]);
    const totalFindings = scans.length + social.length + search.length;
    const highRisk = scans.filter(s => s.risk_score > 70).length;
    const score = Math.min(100, Math.round((highRisk * 15) + (totalFindings * 3)));
    return { data: { risk_score: score, total_findings: totalFindings, high_risk_count: highRisk } };
  },

  async checkBreachAlerts({ profileId }) {
    return localFunctions.checkBreaches({ profileId, emails: [] });
  },

  async autoBreachCheck() {
    return { data: { message: 'Auto breach check not configured' } };
  },

  async fetchInboxEmails() {
    return { data: { message: 'Gmail OAuth not configured' } };
  },

  async bulkDeleteEmails() {
    return { data: { message: 'Gmail OAuth not configured' } };
  },

  async monitorEmails() {
    return { data: { message: 'Gmail OAuth not configured' } };
  },

  async deleteEmailAlias({ aliasId }) {
    await entities.DisposableCredential.delete(aliasId);
    return { data: { deleted: true } };
  },
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export const incognito = {
  auth: {
    me: async () => ({ id: 'local_user', name: 'Local User' }),
    requireUser: () => ({ id: 'local_user', name: 'Local User' }),
    signOut: async () => {},
    logout: () => {},
    redirectToLogin: () => {},
  },
  entities,
  functions: {
    invoke: async (functionName, payload = {}) => {
      const fn = localFunctions[functionName];
      if (!fn) {
        console.warn(`[functions] Unknown function: ${functionName}`);
        return { data: null, error: `Function ${functionName} not implemented` };
      }
      console.log(`[functions] Invoking ${functionName}`, Object.keys(payload));
      return fn(payload);
    },
  },
  integrations: {
    Core: {
      InvokeLLM: invokeLLM,
    },
  },
  appLogs: {
    logUserInApp: async () => {},
  },
  asServiceRole: { entities },
};

export default incognito;
