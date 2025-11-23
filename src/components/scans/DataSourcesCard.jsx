import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Database, Globe, Shield, FileText, Users } from 'lucide-react';
import { motion } from 'framer-motion';

const sourceIcons = {
  people_finder: Users,
  data_broker: Database,
  public_records: FileText,
  government_db: Shield,
  legal_records: FileText,
  breach_database: Shield,
  social_media: Globe,
  osint_scraper: Globe
};

const DATA_SOURCES = [
  // People Finder Sites
  { name: 'Spokeo', type: 'people_finder', active: true, apiAvailable: false },
  { name: 'BeenVerified', type: 'people_finder', active: true, apiAvailable: false },
  { name: 'Intelius', type: 'people_finder', active: true, apiAvailable: false },
  { name: 'PeopleFinders', type: 'people_finder', active: true, apiAvailable: false },
  { name: 'WhitePages', type: 'people_finder', active: true, apiAvailable: false },
  
  // Data Brokers
  { name: 'Acxiom', type: 'data_broker', active: true, apiAvailable: false },
  { name: 'Epsilon', type: 'data_broker', active: true, apiAvailable: false },
  { name: 'Oracle Data Cloud', type: 'data_broker', active: true, apiAvailable: false },
  
  // Public Records
  { name: 'PACER (Federal Courts)', type: 'legal_records', active: true, apiAvailable: true },
  { name: 'Property Records', type: 'public_records', active: true, apiAvailable: false },
  { name: 'Business Registries', type: 'public_records', active: true, apiAvailable: false },
  { name: 'Voter Registration', type: 'public_records', active: true, apiAvailable: false },
  
  // Government Databases
  { name: 'USA.gov Public Data', type: 'government_db', active: true, apiAvailable: true },
  { name: 'State Databases', type: 'government_db', active: true, apiAvailable: false },
  { name: 'Public License Records', type: 'government_db', active: true, apiAvailable: false },
  
  // Breach Databases
  { name: 'Have I Been Pwned', type: 'breach_database', active: true, apiAvailable: true },
  { name: 'DeHashed', type: 'breach_database', active: true, apiAvailable: true },
  { name: 'LeakCheck', type: 'breach_database', active: true, apiAvailable: true },
  
  // OSINT Sources
  { name: 'Archive.org', type: 'osint_scraper', active: true, apiAvailable: true },
  { name: 'Google Dorking', type: 'osint_scraper', active: true, apiAvailable: false },
  { name: 'Social Media OSINT', type: 'osint_scraper', active: true, apiAvailable: false }
];

export default function DataSourcesCard({ expanded }) {
  const groupedSources = DATA_SOURCES.reduce((acc, source) => {
    if (!acc[source.type]) acc[source.type] = [];
    acc[source.type].push(source);
    return acc;
  }, {});

  const typeLabels = {
    people_finder: 'People Finder Sites',
    data_broker: 'Data Brokers',
    public_records: 'Public Records',
    government_db: 'Government Databases',
    legal_records: 'Legal Records',
    breach_database: 'Breach Databases',
    osint_scraper: 'OSINT Sources'
  };

  if (!expanded) {
    return (
      <Card className="glass-card border-purple-500/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white mb-1">Data Source Coverage</h3>
              <p className="text-sm text-purple-300">
                {DATA_SOURCES.filter(s => s.active).length} active sources across {Object.keys(groupedSources).length} categories
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-white">{DATA_SOURCES.length}</div>
              <p className="text-xs text-purple-400">Total Sources</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-purple-500/30">
      <CardHeader className="border-b border-purple-500/20">
        <CardTitle className="text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-purple-400" />
          Data Source Coverage
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {Object.entries(groupedSources).map(([type, sources]) => {
          const Icon = sourceIcons[type] || Globe;
          return (
            <motion.div
              key={type}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-purple-400" />
                  <h4 className="font-semibold text-white text-sm">{typeLabels[type]}</h4>
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40">
                    {sources.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {sources.map((source, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/50 border border-purple-500/10"
                    >
                      <CheckCircle className={`w-3 h-3 ${source.active ? 'text-green-400' : 'text-gray-500'}`} />
                      <span className="text-xs text-purple-200 truncate">{source.name}</span>
                      {source.apiAvailable && (
                        <Badge className="ml-auto bg-green-500/20 text-green-300 text-xs border-0">
                          API
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}

        <div className="pt-4 border-t border-purple-500/20">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-green-300 mb-1">Legal Compliance</p>
              <p className="text-xs text-purple-300">
                All sources comply with OSINT best practices, respect robots.txt, and adhere to terms of service. 
                API access used where available. No illegal scraping.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}