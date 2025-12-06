/**
 * List Class Actions
 * 
 * Returns a curated list of known class action lawsuits related to data breaches,
 * privacy violations, and identity theft.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Static registry of known class action lawsuits
const KNOWN_CLASS_ACTIONS = [
  {
    id: 'equifax-2017',
    company: 'Equifax',
    title: 'Equifax Data Breach Settlement',
    year: 2017,
    status: 'settled',
    settlement_amount: '$575 million',
    affected_count: '147 million',
    breach_type: 'data_breach',
    data_exposed: ['SSN', 'DOB', 'addresses', 'drivers licenses', 'credit card numbers'],
    claim_deadline: '2020-01-22',
    website: 'https://www.equifaxbreachsettlement.com/',
    eligibility: 'Anyone whose personal information was compromised in the breach',
    description: 'Major credit reporting agency breach exposing sensitive data of 147 million Americans'
  },
  {
    id: 'facebook-cambridge-2019',
    company: 'Facebook (Meta)',
    title: 'Facebook Cambridge Analytica Privacy Settlement',
    year: 2019,
    status: 'settled',
    settlement_amount: '$725 million',
    affected_count: '87 million',
    breach_type: 'privacy_violation',
    data_exposed: ['profile data', 'friend lists', 'likes', 'private messages'],
    claim_deadline: '2023-08-25',
    website: 'https://www.facebookuserprivacysettlement.com/',
    eligibility: 'US Facebook users from May 2007 to December 2022',
    description: 'Privacy violations related to Cambridge Analytica data harvesting scandal'
  },
  {
    id: 'yahoo-2016',
    company: 'Yahoo',
    title: 'Yahoo Data Breach Settlement',
    year: 2016,
    status: 'settled',
    settlement_amount: '$117.5 million',
    affected_count: '3 billion',
    breach_type: 'data_breach',
    data_exposed: ['email addresses', 'passwords', 'security questions', 'DOB'],
    claim_deadline: '2019-07-20',
    website: 'https://yahoodatabreachsettlement.com/',
    eligibility: 'Yahoo account holders affected by 2012-2016 breaches',
    description: 'Massive breach affecting all Yahoo user accounts between 2012-2016'
  },
  {
    id: 'marriott-2018',
    company: 'Marriott International',
    title: 'Marriott Starwood Data Breach Settlement',
    year: 2018,
    status: 'settled',
    settlement_amount: '$52 million',
    affected_count: '500 million',
    breach_type: 'data_breach',
    data_exposed: ['passport numbers', 'email addresses', 'phone numbers', 'payment cards'],
    claim_deadline: '2021-02-16',
    website: 'https://www.marriottdatabreachsettlement.com/',
    eligibility: 'Starwood guest reservation database users 2014-2018',
    description: 'Breach of Starwood guest reservation database affecting hundreds of millions'
  },
  {
    id: 'target-2013',
    company: 'Target',
    title: 'Target Data Breach Settlement',
    year: 2013,
    status: 'settled',
    settlement_amount: '$18.5 million',
    affected_count: '110 million',
    breach_type: 'data_breach',
    data_exposed: ['credit card numbers', 'debit card numbers', 'names', 'addresses', 'phone numbers'],
    claim_deadline: '2015-04-30',
    website: null,
    eligibility: 'Customers who shopped at US Target stores Nov 27 - Dec 18, 2013',
    description: 'Point-of-sale malware breach during holiday shopping season'
  },
  {
    id: 'tmobile-2021',
    company: 'T-Mobile',
    title: 'T-Mobile Data Breach Settlement',
    year: 2021,
    status: 'settled',
    settlement_amount: '$350 million',
    affected_count: '76.6 million',
    breach_type: 'data_breach',
    data_exposed: ['SSN', 'drivers license info', 'names', 'addresses', 'DOB'],
    claim_deadline: '2023-04-05',
    website: 'https://www.t-mobilesettlement.com/',
    eligibility: 'T-Mobile customers affected by August 2021 breach',
    description: 'Major telecommunications breach exposing customer personal information'
  },
  {
    id: 'capital-one-2019',
    company: 'Capital One',
    title: 'Capital One Data Breach Settlement',
    year: 2019,
    status: 'settled',
    settlement_amount: '$190 million',
    affected_count: '106 million',
    breach_type: 'data_breach',
    data_exposed: ['SSN', 'bank account numbers', 'credit scores', 'names', 'addresses'],
    claim_deadline: '2022-08-22',
    website: 'https://www.capitalonesettlement.com/',
    eligibility: 'Capital One customers and applicants affected by 2019 breach',
    description: 'Cloud database breach by former AWS employee affecting millions of customers'
  },
  {
    id: 'google-plus-2018',
    company: 'Google',
    title: 'Google+ Data Privacy Settlement',
    year: 2018,
    status: 'settled',
    settlement_amount: '$7.5 million',
    affected_count: '52.5 million',
    breach_type: 'privacy_violation',
    data_exposed: ['profile data', 'email addresses', 'occupation', 'gender', 'age'],
    claim_deadline: '2020-10-08',
    website: null,
    eligibility: 'US Google+ users with accounts between 2015-2019',
    description: 'API vulnerability exposing Google+ user profile data'
  },
  {
    id: 'uber-2016',
    company: 'Uber',
    title: 'Uber Data Breach Settlement',
    year: 2016,
    status: 'settled',
    settlement_amount: '$148 million',
    affected_count: '57 million',
    breach_type: 'data_breach',
    data_exposed: ['names', 'email addresses', 'phone numbers', 'drivers license numbers'],
    claim_deadline: '2019-06-03',
    website: null,
    eligibility: 'Uber drivers and riders affected by 2016 breach',
    description: 'Breach affecting Uber drivers and riders worldwide, concealed by company for a year'
  },
  {
    id: 'anthem-2015',
    company: 'Anthem',
    title: 'Anthem Data Breach Settlement',
    year: 2015,
    status: 'settled',
    settlement_amount: '$115 million',
    affected_count: '79 million',
    breach_type: 'data_breach',
    data_exposed: ['SSN', 'medical ID numbers', 'names', 'addresses', 'DOB', 'income data'],
    claim_deadline: '2018-06-15',
    website: null,
    eligibility: 'Anthem health insurance members affected by 2014-2015 breach',
    description: 'One of the largest healthcare breaches in US history'
  },
  {
    id: 'ticketmaster-2018',
    company: 'Ticketmaster',
    title: 'Ticketmaster Data Breach Settlement',
    year: 2018,
    status: 'pending',
    settlement_amount: 'TBD',
    affected_count: '40 million',
    breach_type: 'data_breach',
    data_exposed: ['payment card data', 'names', 'addresses', 'email addresses'],
    claim_deadline: null,
    website: null,
    eligibility: 'Ticketmaster customers who made purchases 2017-2018',
    description: 'Third-party chatbot malware stealing customer payment information'
  },
  {
    id: 'linkedin-2021',
    company: 'LinkedIn',
    title: 'LinkedIn Data Scraping Settlement',
    year: 2021,
    status: 'pending',
    settlement_amount: 'TBD',
    affected_count: '700 million',
    breach_type: 'data_scraping',
    data_exposed: ['profile data', 'email addresses', 'phone numbers', 'geolocation'],
    claim_deadline: null,
    website: null,
    eligibility: 'LinkedIn users whose data was scraped and sold',
    description: 'Massive data scraping incident affecting majority of LinkedIn users'
  },
  {
    id: 'credit-karma-2022',
    company: 'Credit Karma',
    title: 'Credit Karma Tax Data Breach Settlement',
    year: 2022,
    status: 'active',
    settlement_amount: '$3 million',
    affected_count: 'Unknown',
    breach_type: 'data_breach',
    data_exposed: ['tax return data', 'SSN', 'financial information'],
    claim_deadline: '2024-12-31',
    website: null,
    eligibility: 'Credit Karma Tax users affected by unauthorized access',
    description: 'Unauthorized access to Credit Karma Tax accounts'
  },
  {
    id: 'att-2024',
    company: 'AT&T',
    title: 'AT&T Data Breach Investigation',
    year: 2024,
    status: 'investigation',
    settlement_amount: null,
    affected_count: '73 million',
    breach_type: 'data_breach',
    data_exposed: ['SSN', 'passcodes', 'account numbers'],
    claim_deadline: null,
    website: null,
    eligibility: 'AT&T customers affected by March 2024 breach',
    description: 'Recent massive breach affecting current and former AT&T customers'
  },
  {
    id: 'change-healthcare-2024',
    company: 'Change Healthcare',
    title: 'Change Healthcare Ransomware Attack',
    year: 2024,
    status: 'investigation',
    settlement_amount: null,
    affected_count: '100+ million',
    breach_type: 'ransomware',
    data_exposed: ['medical records', 'SSN', 'insurance info', 'billing data'],
    claim_deadline: null,
    website: null,
    eligibility: 'Patients whose data processed by Change Healthcare',
    description: 'Major healthcare infrastructure ransomware attack affecting pharmacy and medical claims'
  }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    // Self-test mode
    if (body._selfTest === '1') {
      return Response.json({ ok: true, testMode: true, function: 'listClassActions' });
    }

    const { 
      company, 
      status, 
      breach_type, 
      year_from, 
      year_to,
      active_claims_only = false,
      limit = 50
    } = body;

    let filtered = [...KNOWN_CLASS_ACTIONS];

    // Filter by company
    if (company) {
      const companyLower = company.toLowerCase();
      filtered = filtered.filter(ca => 
        ca.company.toLowerCase().includes(companyLower)
      );
    }

    // Filter by status
    if (status) {
      filtered = filtered.filter(ca => ca.status === status);
    }

    // Filter by breach type
    if (breach_type) {
      filtered = filtered.filter(ca => ca.breach_type === breach_type);
    }

    // Filter by year range
    if (year_from) {
      filtered = filtered.filter(ca => ca.year >= parseInt(year_from));
    }
    if (year_to) {
      filtered = filtered.filter(ca => ca.year <= parseInt(year_to));
    }

    // Filter active claims only
    if (active_claims_only) {
      const today = new Date();
      filtered = filtered.filter(ca => {
        if (!ca.claim_deadline) return ca.status === 'active' || ca.status === 'pending';
        const deadline = new Date(ca.claim_deadline);
        return deadline > today;
      });
    }

    // Sort by year (most recent first)
    filtered.sort((a, b) => b.year - a.year);

    // Apply limit
    filtered = filtered.slice(0, limit);

    // Aggregate stats
    const stats = {
      total_lawsuits: KNOWN_CLASS_ACTIONS.length,
      filtered_count: filtered.length,
      total_affected: KNOWN_CLASS_ACTIONS.reduce((sum, ca) => {
        const count = ca.affected_count.replace(/[^0-9]/g, '');
        return sum + (parseInt(count) || 0);
      }, 0),
      by_status: {
        settled: KNOWN_CLASS_ACTIONS.filter(ca => ca.status === 'settled').length,
        active: KNOWN_CLASS_ACTIONS.filter(ca => ca.status === 'active').length,
        pending: KNOWN_CLASS_ACTIONS.filter(ca => ca.status === 'pending').length,
        investigation: KNOWN_CLASS_ACTIONS.filter(ca => ca.status === 'investigation').length
      },
      by_type: {
        data_breach: KNOWN_CLASS_ACTIONS.filter(ca => ca.breach_type === 'data_breach').length,
        privacy_violation: KNOWN_CLASS_ACTIONS.filter(ca => ca.breach_type === 'privacy_violation').length,
        data_scraping: KNOWN_CLASS_ACTIONS.filter(ca => ca.breach_type === 'data_scraping').length,
        ransomware: KNOWN_CLASS_ACTIONS.filter(ca => ca.breach_type === 'ransomware').length
      }
    };

    return Response.json({
      ok: true,
      data: {
        lawsuits: filtered,
        stats,
        filters_applied: {
          company: company || null,
          status: status || null,
          breach_type: breach_type || null,
          year_range: (year_from || year_to) ? [year_from || 'any', year_to || 'any'] : null,
          active_claims_only
        }
      }
    });

  } catch (error) {
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});