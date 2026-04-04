// Local breach database — real breaches with real data.
// Used when no HIBP key is configured. Matches by email domain or service name.

export const KNOWN_BREACHES = [
  { name: 'Yahoo', domain: 'yahoo.com', date: '2013-08-01', records: 3000000000, exposed: ['Email addresses','Passwords','Security questions','Names','Phone numbers','Dates of birth'], severity: 95 },
  { name: 'Yahoo (2014)', domain: 'yahoo.com', date: '2014-01-01', records: 500000000, exposed: ['Email addresses','Passwords','Security questions','Names'], severity: 90 },
  { name: 'LinkedIn', domain: 'linkedin.com', date: '2021-06-01', records: 700000000, exposed: ['Email addresses','Names','Phone numbers','Geolocation','Job titles','Social media profiles'], severity: 80 },
  { name: 'Facebook', domain: 'facebook.com', date: '2019-04-01', records: 533000000, exposed: ['Phone numbers','Names','Email addresses','Locations','Dates of birth'], severity: 85 },
  { name: 'Adobe', domain: 'adobe.com', date: '2013-10-01', records: 153000000, exposed: ['Email addresses','Passwords','Password hints','Usernames'], severity: 85 },
  { name: 'Equifax', domain: 'equifax.com', date: '2017-07-01', records: 147000000, exposed: ['SSN','Names','Dates of birth','Addresses','Credit card numbers','Drivers license numbers'], severity: 99 },
  { name: 'eBay', domain: 'ebay.com', date: '2014-05-01', records: 145000000, exposed: ['Email addresses','Passwords','Phone numbers','Physical addresses','Names','Dates of birth'], severity: 80 },
  { name: 'Canva', domain: 'canva.com', date: '2019-05-01', records: 137000000, exposed: ['Email addresses','Names','Usernames','Passwords','Cities','Countries'], severity: 70 },
  { name: 'Heartland Payment Systems', domain: 'heartland.com', date: '2008-01-01', records: 134000000, exposed: ['Credit card numbers','Names'], severity: 95 },
  { name: 'MySpace', domain: 'myspace.com', date: '2013-01-01', records: 360000000, exposed: ['Email addresses','Passwords','Usernames'], severity: 65 },
  { name: 'Twitter/X', domain: 'twitter.com', date: '2023-01-01', records: 200000000, exposed: ['Email addresses','Names','Usernames','Phone numbers'], severity: 75 },
  { name: 'Dropbox', domain: 'dropbox.com', date: '2012-07-01', records: 68000000, exposed: ['Email addresses','Passwords'], severity: 80 },
  { name: 'Tumblr', domain: 'tumblr.com', date: '2013-02-01', records: 65000000, exposed: ['Email addresses','Passwords'], severity: 60 },
  { name: 'Zynga', domain: 'zynga.com', date: '2019-09-01', records: 173000000, exposed: ['Email addresses','Passwords','Usernames','Phone numbers'], severity: 70 },
  { name: 'T-Mobile', domain: 't-mobile.com', date: '2021-08-01', records: 77000000, exposed: ['Names','SSN','Dates of birth','Phone numbers','Drivers license numbers','IMEI numbers'], severity: 95 },
  { name: 'T-Mobile (2023)', domain: 't-mobile.com', date: '2023-01-01', records: 37000000, exposed: ['Names','Addresses','Phone numbers','Account numbers','Dates of birth'], severity: 85 },
  { name: 'Marriott', domain: 'marriott.com', date: '2018-09-01', records: 500000000, exposed: ['Names','Addresses','Phone numbers','Email addresses','Passport numbers','Dates of birth','Credit card numbers'], severity: 90 },
  { name: 'Uber', domain: 'uber.com', date: '2016-10-01', records: 57000000, exposed: ['Email addresses','Names','Phone numbers','Drivers license numbers'], severity: 80 },
  { name: 'Capital One', domain: 'capitalone.com', date: '2019-07-01', records: 106000000, exposed: ['Names','Addresses','Phone numbers','Email addresses','Dates of birth','Credit scores','SSN','Bank account numbers'], severity: 95 },
  { name: 'MGM Resorts', domain: 'mgmresorts.com', date: '2019-07-01', records: 142000000, exposed: ['Names','Addresses','Phone numbers','Email addresses','Dates of birth'], severity: 75 },
  { name: 'Exactis', domain: 'exactis.com', date: '2018-06-01', records: 340000000, exposed: ['Names','Addresses','Phone numbers','Email addresses','Personal interests','Ages','Children info'], severity: 90 },
  { name: 'Under Armour / MyFitnessPal', domain: 'myfitnesspal.com', date: '2018-02-01', records: 150000000, exposed: ['Email addresses','Usernames','Passwords'], severity: 70 },
  { name: 'Dubsmash', domain: 'dubsmash.com', date: '2018-12-01', records: 162000000, exposed: ['Email addresses','Passwords','Usernames','Names','Phone numbers'], severity: 65 },
  { name: 'Wattpad', domain: 'wattpad.com', date: '2020-06-01', records: 268000000, exposed: ['Email addresses','Passwords','Usernames','IP addresses','Names','Dates of birth'], severity: 65 },
  { name: 'Deezer', domain: 'deezer.com', date: '2019-01-01', records: 229000000, exposed: ['Email addresses','Names','Dates of birth','Genders','IP addresses'], severity: 60 },
  { name: 'Truecaller', domain: 'truecaller.com', date: '2019-05-01', records: 299000000, exposed: ['Names','Phone numbers','Email addresses','Carriers','Genders'], severity: 70 },
  { name: 'Gravatar', domain: 'gravatar.com', date: '2020-10-01', records: 167000000, exposed: ['Email addresses','Usernames','Names','Passwords'], severity: 60 },
  { name: 'Verifications.io', domain: 'verifications.io', date: '2019-02-01', records: 763000000, exposed: ['Email addresses','Names','Phone numbers','Addresses','Genders','Dates of birth','IP addresses'], severity: 80 },
  { name: 'Experian', domain: 'experian.com', date: '2020-08-01', records: 24000000, exposed: ['Names','Addresses','Phone numbers','Email addresses','Dates of birth','ID numbers'], severity: 90 },
  { name: 'SolarWinds', domain: 'solarwinds.com', date: '2020-12-01', records: 18000, exposed: ['Email addresses','Credentials','Source code','Internal network data'], severity: 95 },
  { name: 'Twitch', domain: 'twitch.tv', date: '2021-10-01', records: 0, exposed: ['Source code','Creator payouts','Internal tools','Passwords'], severity: 75 },
  { name: 'Ticketmaster', domain: 'ticketmaster.com', date: '2024-05-01', records: 560000000, exposed: ['Names','Addresses','Email addresses','Phone numbers','Credit card numbers'], severity: 90 },
  { name: 'AT&T', domain: 'att.com', date: '2024-03-01', records: 73000000, exposed: ['Names','Addresses','Phone numbers','SSN','Dates of birth','Account numbers','Passcodes'], severity: 95 },
  { name: 'MOVEit / Progress Software', domain: 'moveit.com', date: '2023-06-01', records: 77000000, exposed: ['Names','SSN','Addresses','Financial data','Medical records'], severity: 95 },
  { name: 'LastPass', domain: 'lastpass.com', date: '2022-08-01', records: 33000000, exposed: ['Email addresses','Encrypted vault data','Master password hashes','Company names','Billing addresses'], severity: 95 },
  { name: 'Anthem', domain: 'anthem.com', date: '2015-02-01', records: 78800000, exposed: ['Names','SSN','Dates of birth','Addresses','Email addresses','Employment info','Medical IDs'], severity: 95 },
  { name: 'Home Depot', domain: 'homedepot.com', date: '2014-09-01', records: 56000000, exposed: ['Credit card numbers','Email addresses'], severity: 85 },
  { name: 'Target', domain: 'target.com', date: '2013-12-01', records: 70000000, exposed: ['Credit card numbers','Names','Addresses','Phone numbers','Email addresses'], severity: 85 },
  { name: 'JPMorgan Chase', domain: 'chase.com', date: '2014-07-01', records: 83000000, exposed: ['Names','Addresses','Phone numbers','Email addresses'], severity: 80 },
  { name: 'Premera Blue Cross', domain: 'premera.com', date: '2015-01-01', records: 11000000, exposed: ['Names','SSN','Dates of birth','Bank account numbers','Claims data','Clinical information'], severity: 95 },
  { name: 'Anthem / Elevance', domain: 'elevancehealth.com', date: '2015-02-01', records: 78800000, exposed: ['Names','SSN','Dates of birth','Medical IDs'], severity: 95 },
  { name: 'Upstox', domain: 'upstox.com', date: '2021-04-01', records: 2500000, exposed: ['Names','Email addresses','Phone numbers','PAN numbers','Bank details','KYC data'], severity: 85 },
  { name: 'Spotify', domain: 'spotify.com', date: '2020-11-01', records: 350000, exposed: ['Email addresses','Passwords','Account display names','Usernames'], severity: 60 },
  { name: 'Nintendo', domain: 'nintendo.com', date: '2020-04-01', records: 300000, exposed: ['Usernames','Email addresses','Dates of birth','Countries'], severity: 60 },
  { name: 'GoDaddy', domain: 'godaddy.com', date: '2021-11-01', records: 1200000, exposed: ['Email addresses','Passwords','SSL private keys','Customer numbers'], severity: 85 },
  { name: 'Cash App', domain: 'cash.app', date: '2022-04-01', records: 8200000, exposed: ['Names','Brokerage account numbers','Portfolio values','Stock activity'], severity: 80 },
  { name: 'Neopets', domain: 'neopets.com', date: '2022-07-01', records: 69000000, exposed: ['Email addresses','Passwords','Usernames','Names','Dates of birth','Genders','IP addresses','Countries'], severity: 55 },
  { name: 'DoorDash', domain: 'doordash.com', date: '2019-05-01', records: 4900000, exposed: ['Names','Email addresses','Delivery addresses','Phone numbers','Passwords','Credit card last 4'], severity: 75 },
  { name: 'Slack', domain: 'slack.com', date: '2015-03-01', records: 500000, exposed: ['Email addresses','Usernames','Passwords','Skype IDs'], severity: 70 },
  { name: 'Zoom', domain: 'zoom.us', date: '2020-04-01', records: 500000, exposed: ['Email addresses','Passwords','Meeting URLs','Host keys'], severity: 75 },
  { name: 'Reddit', domain: 'reddit.com', date: '2018-06-01', records: 0, exposed: ['Email addresses','Passwords','Private messages','Source code'], severity: 65 },
  { name: 'Comcast/Xfinity', domain: 'xfinity.com', date: '2023-12-01', records: 35879455, exposed: ['Names','Usernames','Passwords','SSN (partial)','Dates of birth','Security questions'], severity: 85 },
  { name: 'Discord', domain: 'discord.com', date: '2023-08-01', records: 760000, exposed: ['Email addresses','Usernames','Messages'], severity: 55 },
  { name: 'ChatGPT / OpenAI', domain: 'openai.com', date: '2023-03-01', records: 101000, exposed: ['Email addresses','Payment info (partial)','Chat history titles'], severity: 70 },
  { name: 'Samsung', domain: 'samsung.com', date: '2022-07-01', records: 0, exposed: ['Names','Dates of birth','Contact info','Product registration data','Demographics'], severity: 60 },
  { name: 'Robinhood', domain: 'robinhood.com', date: '2021-11-01', records: 7000000, exposed: ['Email addresses','Names','Dates of birth','ZIP codes'], severity: 70 },
  { name: 'PayPal', domain: 'paypal.com', date: '2022-12-01', records: 35000, exposed: ['Names','Addresses','SSN','Tax IDs','Dates of birth'], severity: 90 },
  { name: 'Mailchimp', domain: 'mailchimp.com', date: '2023-01-01', records: 133, exposed: ['Email addresses','API keys','Customer data'], severity: 75 },
  { name: 'Microsoft', domain: 'microsoft.com', date: '2021-03-01', records: 30000, exposed: ['Email addresses','Passwords','Exchange server data'], severity: 80 },
  { name: 'Outlook.com', domain: 'outlook.com', date: '2019-04-01', records: 0, exposed: ['Email addresses','Email content','Folder names','Subject lines'], severity: 80 },
  { name: 'Hotmail', domain: 'hotmail.com', date: '2019-04-01', records: 0, exposed: ['Email addresses','Email content','Folder names','Subject lines'], severity: 80 },
  { name: 'Gmail (third-party)', domain: 'gmail.com', date: '2018-09-01', records: 5000000, exposed: ['Email addresses','Passwords (from third-party breaches)'], severity: 70 },
  { name: 'AOL', domain: 'aol.com', date: '2014-04-01', records: 120000000, exposed: ['Email addresses','Passwords','Security questions','Addresses','Contacts'], severity: 75 },
  { name: 'iCloud', domain: 'icloud.com', date: '2014-09-01', records: 0, exposed: ['Photos','Account credentials (targeted)'], severity: 70 },
  { name: 'Comcast', domain: 'comcast.net', date: '2015-02-01', records: 590000, exposed: ['Email addresses','Passwords'], severity: 65 },
];

// Common email providers and which breaches apply globally
export const GLOBAL_EMAIL_BREACHES = [
  { name: 'Collection #1 (mega-breach)', date: '2019-01-01', records: 773000000, exposed: ['Email addresses','Passwords'], severity: 80 },
  { name: 'Anti Public Combo List', date: '2016-12-01', records: 458000000, exposed: ['Email addresses','Passwords'], severity: 75 },
  { name: 'Exploit.In Combo List', date: '2017-01-01', records: 593000000, exposed: ['Email addresses','Passwords'], severity: 75 },
  { name: 'Onliner Spambot', date: '2017-08-01', records: 711000000, exposed: ['Email addresses','Passwords'], severity: 60 },
  { name: 'Data Enrichment Exposure (PDL)', date: '2019-10-01', records: 1200000000, exposed: ['Email addresses','Phone numbers','Social media profiles','Job titles'], severity: 70 },
];

export const DATA_BROKERS = [
  { name: 'Spokeo', url: 'https://www.spokeo.com', optOutUrl: 'https://www.spokeo.com/optout', collectsFrom: 'Public records, social media, marketing lists', dataTypes: ['name','address','phone','email','age','relatives','social profiles'], difficulty: 'easy', turnaround: '24-48 hours' },
  { name: 'WhitePages', url: 'https://www.whitepages.com', optOutUrl: 'https://www.whitepages.com/suppression-requests', collectsFrom: 'Phone directories, public records, voter registration', dataTypes: ['name','address','phone','age','relatives'], difficulty: 'medium', turnaround: '24-48 hours' },
  { name: 'BeenVerified', url: 'https://www.beenverified.com', optOutUrl: 'https://www.beenverified.com/app/optout/search', collectsFrom: 'Public records, court records, property records', dataTypes: ['name','address','phone','email','criminal records','property','vehicles'], difficulty: 'medium', turnaround: '24 hours' },
  { name: 'Intelius', url: 'https://www.intelius.com', optOutUrl: 'https://www.intelius.com/optout', collectsFrom: 'Public records, data aggregators', dataTypes: ['name','address','phone','age','relatives','criminal records'], difficulty: 'medium', turnaround: '72 hours' },
  { name: 'TruePeopleSearch', url: 'https://www.truepeoplesearch.com', optOutUrl: 'https://www.truepeoplesearch.com/removal', collectsFrom: 'Public records, phone directories', dataTypes: ['name','address','phone','email','age','relatives'], difficulty: 'easy', turnaround: '24 hours' },
  { name: 'FastPeopleSearch', url: 'https://www.fastpeoplesearch.com', optOutUrl: 'https://www.fastpeoplesearch.com/removal', collectsFrom: 'Public records, data aggregators', dataTypes: ['name','address','phone','age'], difficulty: 'easy', turnaround: '24-48 hours' },
  { name: 'ThatsThem', url: 'https://thatsthem.com', optOutUrl: 'https://thatsthem.com/optout', collectsFrom: 'Public records, voter rolls', dataTypes: ['name','address','phone','email','IP address'], difficulty: 'easy', turnaround: '24 hours' },
  { name: 'Radaris', url: 'https://radaris.com', optOutUrl: 'https://radaris.com/control/privacy', collectsFrom: 'Public records, court records, social media', dataTypes: ['name','address','phone','email','criminal records','property','court records'], difficulty: 'hard', turnaround: '2-4 weeks' },
  { name: 'MyLife', url: 'https://www.mylife.com', optOutUrl: 'https://www.mylife.com/ccpa/index.pubview', collectsFrom: 'Public records, social media, court records', dataTypes: ['name','address','phone','age','reputation score','criminal records'], difficulty: 'hard', turnaround: '10 days' },
  { name: 'PeopleFinder', url: 'https://www.peoplefinder.com', optOutUrl: 'https://www.peoplefinder.com/optout.php', collectsFrom: 'Public records, phone directories', dataTypes: ['name','address','phone','age','relatives'], difficulty: 'easy', turnaround: '24-48 hours' },
  { name: 'USPhoneBook', url: 'https://www.usphonebook.com', optOutUrl: 'https://www.usphonebook.com/opt-out', collectsFrom: 'Phone records, public data', dataTypes: ['name','phone','address'], difficulty: 'easy', turnaround: '24-48 hours' },
  { name: 'AnyWho', url: 'https://www.anywho.com', optOutUrl: 'https://www.intelius.com/optout', collectsFrom: 'Phone directories, public records', dataTypes: ['name','address','phone'], difficulty: 'medium', turnaround: '72 hours' },
  { name: 'ZabaSearch', url: 'https://www.zabasearch.com', optOutUrl: 'https://www.zabasearch.com/block_records', collectsFrom: 'Public records, phone directories', dataTypes: ['name','address','phone','age'], difficulty: 'easy', turnaround: '48 hours' },
  { name: 'PeekYou', url: 'https://www.peekyou.com', optOutUrl: 'https://www.peekyou.com/about/contact/optout/', collectsFrom: 'Social media, public records, web crawling', dataTypes: ['name','social profiles','email','phone','location'], difficulty: 'easy', turnaround: '30-60 days' },
  { name: 'Instant Checkmate', url: 'https://www.instantcheckmate.com', optOutUrl: 'https://www.instantcheckmate.com/optout/', collectsFrom: 'Public records, court records', dataTypes: ['name','address','phone','criminal records','relatives','age'], difficulty: 'medium', turnaround: '48 hours' },
  { name: 'US Search', url: 'https://www.ussearch.com', optOutUrl: 'https://www.ussearch.com/consumer/ssa/landing.do', collectsFrom: 'Public records, data aggregators', dataTypes: ['name','address','phone','criminal records'], difficulty: 'medium', turnaround: '7 days' },
  { name: 'FamilyTreeNow', url: 'https://www.familytreenow.com', optOutUrl: 'https://www.familytreenow.com/optout', collectsFrom: 'Public records, genealogy data', dataTypes: ['name','address','phone','relatives','age','birth/death records'], difficulty: 'easy', turnaround: '48 hours' },
  { name: 'Nuwber', url: 'https://nuwber.com', optOutUrl: 'https://nuwber.com/removal/link', collectsFrom: 'Public records, social media', dataTypes: ['name','address','phone','email','age','social profiles'], difficulty: 'medium', turnaround: '72 hours' },
  { name: 'CyberBackgroundChecks', url: 'https://www.cyberbackgroundchecks.com', optOutUrl: 'https://www.cyberbackgroundchecks.com/removal', collectsFrom: 'Public records, court records', dataTypes: ['name','address','phone','criminal records','court records'], difficulty: 'easy', turnaround: '48 hours' },
  { name: 'Acxiom', url: 'https://www.acxiom.com', optOutUrl: 'https://isapps.acxiom.com/optout/optout.aspx', collectsFrom: 'Purchase data, surveys, public records, social media', dataTypes: ['name','address','phone','email','purchase history','income estimates','interests'], difficulty: 'medium', turnaround: '2-4 weeks' },
  { name: 'LexisNexis', url: 'https://www.lexisnexis.com', optOutUrl: 'https://optout.lexisnexis.com/', collectsFrom: 'Public records, court records, credit data, insurance claims', dataTypes: ['name','address','phone','SSN','criminal records','insurance claims','employment'], difficulty: 'hard', turnaround: '30 days' },
  { name: 'Epsilon', url: 'https://www.epsilon.com', optOutUrl: 'https://us.epsilon.com/consumer-information-marketing-practices', collectsFrom: 'Marketing databases, purchase history, surveys', dataTypes: ['name','address','email','purchase history','interests','demographics'], difficulty: 'medium', turnaround: '2-4 weeks' },
  { name: 'Oracle Data Cloud', url: 'https://www.oracle.com/cx/advertising/', optOutUrl: 'https://datacloudoptout.oracle.com/optout', collectsFrom: 'Purchase data, browsing behavior, app usage', dataTypes: ['name','email','interests','purchase behavior','device IDs'], difficulty: 'medium', turnaround: '30 days' },
  { name: 'Equifax (consumer data)', url: 'https://www.equifax.com', optOutUrl: 'https://www.equifax.com/personal/credit-report-services/credit-freeze/', collectsFrom: 'Credit applications, public records, collections', dataTypes: ['name','SSN','address','credit history','employment','income'], difficulty: 'hard', turnaround: 'varies' },
  { name: 'Experian (marketing)', url: 'https://www.experian.com', optOutUrl: 'https://www.experian.com/privacy/opting_out_preapproved_offers', collectsFrom: 'Credit data, public records, marketing databases', dataTypes: ['name','address','credit history','demographics','income estimates'], difficulty: 'hard', turnaround: 'varies' },
  { name: 'TransUnion (marketing)', url: 'https://www.transunion.com', optOutUrl: 'https://www.transunion.com/consumer-privacy', collectsFrom: 'Credit data, public records', dataTypes: ['name','address','credit history','demographics'], difficulty: 'hard', turnaround: 'varies' },
];

// ── Live HIBP breach list (free, no key) ──
// Fetches 700+ breaches from HIBP's public /breaches endpoint, caches in localStorage.
const HIBP_CACHE_KEY = 'incognito_hibp_breaches_cache';
const HIBP_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

let _liveBreachesPromise = null;

export async function fetchLiveBreachList() {
  const cached = localStorage.getItem(HIBP_CACHE_KEY);
  if (cached) {
    try {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < HIBP_CACHE_TTL && Array.isArray(data) && data.length > 50) {
        return data;
      }
    } catch { /* stale/corrupt cache */ }
  }

  try {
    const resp = await fetch('https://haveibeenpwned.com/api/v3/breaches', {
      headers: { 'User-Agent': 'Incognito-Privacy-App' },
    });
    if (!resp.ok) throw new Error(`HIBP breaches: ${resp.status}`);
    const data = await resp.json();
    if (Array.isArray(data) && data.length > 50) {
      try {
        localStorage.setItem(HIBP_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
      } catch { /* QuotaExceeded — fine, we have it in memory */ }
      // Loaded live breaches from HIBP
      return data;
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[HIBP] Failed to fetch live breach list:', e.message);
  }
  return null;
}

function getLiveBreaches() {
  if (!_liveBreachesPromise) {
    _liveBreachesPromise = fetchLiveBreachList();
  }
  return _liveBreachesPromise;
}

// ── LeakCheck Public API (free, no key) ──
export async function leakCheckPublic(email) {
  try {
    const resp = await fetch(`https://leakcheck.io/api/public?check=${encodeURIComponent(email)}`);
    if (!resp.ok) throw new Error(`LeakCheck: ${resp.status}`);
    const data = await resp.json();
    if (data.success && data.found > 0) {
      // LeakCheck found breaches
      return {
        found: data.found,
        fields: data.fields || [],
        sources: data.sources || [],
      };
    }
    return { found: 0, fields: [], sources: [] };
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[LeakCheck Free] Error:', e.message);
    return null;
  }
}

export async function matchBreaches(email) {
  if (!email) return [];
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return [];

  const matches = [];

  // Phase 1: Try live HIBP breach list (700+ breaches, free, no key)
  const liveBreaches = await getLiveBreaches();
  if (liveBreaches) {
    for (const b of liveBreaches) {
      const bDomain = (b.Domain || '').toLowerCase();
      if (bDomain && (domain === bDomain || domain.endsWith('.' + bDomain))) {
        const hasSensitive = (b.DataClasses || []).some(d => /password|ssn|credit|financial/i.test(d));
        matches.push({
          name: b.Title || b.Name,
          domain: bDomain,
          date: b.BreachDate,
          records: b.PwnCount || 0,
          exposed: b.DataClasses || [],
          severity: hasSensitive ? 85 : (b.PwnCount > 1000000 ? 75 : 60),
          match_type: 'hibp_live_domain_match',
          confidence: 85,
          source: 'hibp_free',
          description: b.Description,
        });
      }
    }
  }

  // Phase 2: Try LeakCheck Public API (free, no key)
  const leakResult = await leakCheckPublic(email);
  if (leakResult && leakResult.found > 0) {
    for (const src of leakResult.sources) {
      const alreadyFound = matches.some(m => m.name.toLowerCase().includes((src.name || '').toLowerCase()));
      if (!alreadyFound) {
        matches.push({
          name: src.name || 'Unknown Source',
          domain: (src.name || '').toLowerCase().replace(/\.com$/, '') + '.com',
          date: src.date || 'Unknown',
          records: 0,
          exposed: leakResult.fields || ['credentials'],
          severity: 70,
          match_type: 'leakcheck_public',
          confidence: 80,
          source: 'leakcheck_free',
        });
      }
    }
  }

  // Phase 3: Fall back to local hardcoded database for anything not yet found
  for (const b of KNOWN_BREACHES) {
    if (domain === b.domain || domain.endsWith('.' + b.domain)) {
      const alreadyFound = matches.some(m =>
        m.name.toLowerCase().includes(b.name.toLowerCase()) ||
        b.name.toLowerCase().includes(m.name.toLowerCase())
      );
      if (!alreadyFound) {
        matches.push({ ...b, match_type: 'local_domain_match', confidence: 90 });
      }
    }
  }

  // Phase 4: Add mega-breach combo lists for common email providers
  const commonDomains = ['gmail.com','yahoo.com','hotmail.com','outlook.com','aol.com','icloud.com','protonmail.com','mail.com','zoho.com','yandex.com','live.com','msn.com','comcast.net','att.net','verizon.net','cox.net','sbcglobal.net','bellsouth.net','charter.net','earthlink.net'];
  if (commonDomains.includes(domain)) {
    for (const g of GLOBAL_EMAIL_BREACHES) {
      const alreadyFound = matches.some(m => m.name.toLowerCase() === g.name.toLowerCase());
      if (!alreadyFound) {
        matches.push({ ...g, match_type: 'common_email_provider', confidence: 60 });
      }
    }
  }

  return matches;
}

export function estimateBrokerExposure(profileData) {
  const hasName = profileData.some(d => d.data_type === 'full_name');
  const hasAddress = profileData.some(d => d.data_type === 'address');
  const hasPhone = profileData.some(d => d.data_type === 'phone');
  const hasEmail = profileData.some(d => d.data_type === 'email');
  const hasSSN = profileData.some(d => d.data_type === 'ssn');

  return DATA_BROKERS.map(broker => {
    let likelihood = 0;
    const matchedTypes = [];

    for (const dt of broker.dataTypes) {
      if (dt === 'name' && hasName) { likelihood += 20; matchedTypes.push('name'); }
      if (dt === 'address' && hasAddress) { likelihood += 20; matchedTypes.push('address'); }
      if (dt === 'phone' && hasPhone) { likelihood += 15; matchedTypes.push('phone'); }
      if (dt === 'email' && hasEmail) { likelihood += 15; matchedTypes.push('email'); }
      if (dt === 'SSN' && hasSSN) { likelihood += 10; matchedTypes.push('SSN'); }
    }

    if (hasName && hasAddress) likelihood = Math.min(likelihood + 20, 100);

    const riskLevel = likelihood >= 70 ? 'high' : likelihood >= 40 ? 'medium' : 'low';

    return {
      ...broker,
      likelihood: Math.min(likelihood, 100),
      matchedTypes,
      riskLevel,
    };
  }).filter(b => b.likelihood > 0).sort((a, b) => b.likelihood - a.likelihood);
}
