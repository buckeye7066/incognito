import React, { useState, useMemo } from 'react';
import { Search, ExternalLink, CheckCircle, Clock, AlertTriangle, Filter, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DATA_BROKERS = [
  // People Search
  { name: 'Spokeo', type: 'people_search', difficulty: 'easy', opt_out_url: 'https://www.spokeo.com/optout', requires_id: false, notes: 'Email verification required' },
  { name: 'WhitePages', type: 'people_search', difficulty: 'easy', opt_out_url: 'https://www.whitepages.com/suppression-requests', requires_id: false, notes: 'Phone verification' },
  { name: 'BeenVerified', type: 'people_search', difficulty: 'easy', opt_out_url: 'https://www.beenverified.com/app/optout/search', requires_id: false, notes: 'Free opt-out available' },
  { name: 'TruePeopleSearch', type: 'people_search', difficulty: 'easy', opt_out_url: 'https://www.truepeoplesearch.com/removal', requires_id: false, notes: 'Instant removal' },
  { name: 'Radaris', type: 'people_search', difficulty: 'medium', opt_out_url: 'https://radaris.com/page/how-to-remove-information', requires_id: false, notes: 'Account required' },
  { name: 'Intelius', type: 'people_search', difficulty: 'medium', opt_out_url: 'https://www.intelius.com/optout', requires_id: false, notes: 'Takes 24-48 hours' },
  { name: 'PeopleFinders', type: 'people_search', difficulty: 'easy', opt_out_url: 'https://www.peoplefinders.com/manage/', requires_id: false, notes: 'Must verify by email' },
  { name: 'Pipl', type: 'people_search', difficulty: 'hard', opt_out_url: 'https://pipl.com/personal-information-removal-request/', requires_id: true, notes: 'ID required' },
  { name: 'ZabaSearch', type: 'people_search', difficulty: 'hard', opt_out_url: 'https://www.zabasearch.com/block_records/', requires_id: false, notes: 'Requires fax or mail' },
  { name: 'PeekYou', type: 'people_search', difficulty: 'medium', opt_out_url: 'https://www.peekyou.com/about/contact/optout/', requires_id: false, notes: 'Form submission' },
  { name: 'Addresses.com', type: 'people_search', difficulty: 'medium', opt_out_url: 'https://www.addresses.com/optout.php', requires_id: false, notes: 'Takes up to 72 hrs' },
  { name: 'AnyWho', type: 'people_search', difficulty: 'easy', opt_out_url: 'https://www.anywho.com/optout', requires_id: false, notes: 'Phone number opt-out' },
  { name: 'USPhoneBook', type: 'people_search', difficulty: 'easy', opt_out_url: 'https://www.usphonebook.com/opt-out', requires_id: false, notes: 'Search for your record first' },
  { name: 'FastPeopleSearch', type: 'people_search', difficulty: 'easy', opt_out_url: 'https://www.fastpeoplesearch.com/removal', requires_id: false, notes: 'Instant removal' },
  { name: 'TruthFinder', type: 'people_search', difficulty: 'easy', opt_out_url: 'https://www.truthfinder.com/opt-out/', requires_id: false, notes: 'Takes up to 48 hrs' },
  { name: 'Instant Checkmate', type: 'people_search', difficulty: 'easy', opt_out_url: 'https://www.instantcheckmate.com/opt-out/', requires_id: false, notes: 'Email verification' },
  { name: 'PublicRecordsNow', type: 'people_search', difficulty: 'medium', opt_out_url: 'https://www.publicrecordsnow.com/optout/', requires_id: false },
  { name: 'Infospace', type: 'people_search', difficulty: 'medium', opt_out_url: 'https://infospace.com/home/white-pages/privacy-policy/', requires_id: false },
  { name: 'MyLife', type: 'people_search', difficulty: 'hard', opt_out_url: 'https://www.mylife.com/privacy-policy/', requires_id: true, notes: 'Must call 1-888-704-1900' },
  { name: 'Ancestry', type: 'people_search', difficulty: 'medium', opt_out_url: 'https://www.ancestry.com/cs/legal/ccpa-personal-info', requires_id: false },

  // Data Brokers / Marketing
  { name: 'Acxiom', type: 'data_broker', difficulty: 'medium', opt_out_url: 'https://isapps.acxiom.com/optout/optout.aspx', requires_id: false, notes: 'Marketing data broker' },
  { name: 'Epsilon', type: 'data_broker', difficulty: 'hard', opt_out_url: 'https://www.epsilon.com/us/privacy-policy', requires_id: false, notes: 'Submit CCPA request' },
  { name: 'Oracle Data Cloud', type: 'data_broker', difficulty: 'hard', opt_out_url: 'https://www.oracle.com/legal/privacy/marketing-cloud-data-cloud-privacy-policy.html', requires_id: false },
  { name: 'Nielsen', type: 'data_broker', difficulty: 'hard', opt_out_url: 'https://www.nielsen.com/us/en/privacy-center/global-privacy-statement/', requires_id: false },
  { name: 'Equifax', type: 'credit_bureau', difficulty: 'medium', opt_out_url: 'https://www.equifax.com/personal/credit-report-services/', requires_id: true, notes: 'Credit bureau — freeze recommended' },
  { name: 'Experian', type: 'credit_bureau', difficulty: 'medium', opt_out_url: 'https://www.experian.com/privacy/center.html', requires_id: true, notes: 'Credit bureau — freeze recommended' },
  { name: 'TransUnion', type: 'credit_bureau', difficulty: 'medium', opt_out_url: 'https://www.transunion.com/credit-freeze', requires_id: true, notes: 'Credit bureau — freeze recommended' },
  { name: 'LexisNexis', type: 'data_broker', difficulty: 'hard', opt_out_url: 'https://optout.lexisnexis.com/', requires_id: true, notes: 'ID required, up to 30 days' },
  { name: 'CoreLogic', type: 'data_broker', difficulty: 'hard', opt_out_url: 'https://www.corelogic.com/privacy-center/', requires_id: true },
  { name: 'Neustar', type: 'data_broker', difficulty: 'hard', opt_out_url: 'https://www.home.neustar/privacy', requires_id: false },
  { name: 'Verisk', type: 'data_broker', difficulty: 'hard', opt_out_url: 'https://www.verisk.com/privacy/', requires_id: false },
  { name: 'ID Analytics', type: 'data_broker', difficulty: 'hard', opt_out_url: 'https://www.idanalytics.com/privacy-policy/', requires_id: false },
  { name: 'DataLogix', type: 'data_broker', difficulty: 'hard', opt_out_url: 'https://www.oracle.com/legal/privacy/marketing-cloud-data-cloud-privacy-policy.html', requires_id: false },
  { name: 'Harte-Hanks', type: 'data_broker', difficulty: 'hard', opt_out_url: 'https://www.harte-hanks.com/privacy-policy/', requires_id: false },
  { name: 'Experian Marketing', type: 'data_broker', difficulty: 'medium', opt_out_url: 'https://www.experian.com/privacy/opting_out_prescreen_offers.html', requires_id: false },

  // Background Check
  { name: 'US Search', type: 'background_check', difficulty: 'medium', opt_out_url: 'https://www.ussearch.com/privacylock/', requires_id: false },
  { name: 'CheckPeople', type: 'background_check', difficulty: 'easy', opt_out_url: 'https://checkpeople.com/opt-out', requires_id: false },
  { name: 'BackgroundAlert', type: 'background_check', difficulty: 'easy', opt_out_url: 'https://www.backgroundalert.com/optout/', requires_id: false },
  { name: 'PrivateEye', type: 'background_check', difficulty: 'medium', opt_out_url: 'https://www.privateeye.com/static/view/optout/', requires_id: false },
  { name: 'Veromi', type: 'background_check', difficulty: 'medium', opt_out_url: 'https://www.veromi.net/OptOut/OptOut/', requires_id: false },
  { name: 'PeopleSmart', type: 'background_check', difficulty: 'medium', opt_out_url: 'https://www.peoplesmart.com/optout-go', requires_id: false },
  { name: 'RecordsFinder', type: 'background_check', difficulty: 'medium', opt_out_url: 'https://recordsfinder.com/optout/', requires_id: false },
  { name: 'PublicRecords360', type: 'background_check', difficulty: 'easy', opt_out_url: 'https://www.publicrecords360.com/optout.html', requires_id: false },
  { name: 'CourtRecords.org', type: 'background_check', difficulty: 'medium', opt_out_url: 'https://www.courtrecords.org/ccpa.php', requires_id: false },
  { name: 'SpyFly', type: 'background_check', difficulty: 'easy', opt_out_url: 'https://www.spyfly.com/help-center/remove-information/', requires_id: false },

  // Address/Phone
  { name: 'Yellowpages', type: 'directory', difficulty: 'easy', opt_out_url: 'https://www.yellowpages.com/faq#op-how-can-i-have-a-listing-removed', requires_id: false },
  { name: 'Superpages', type: 'directory', difficulty: 'easy', opt_out_url: 'https://www.superpages.com/privacy-center', requires_id: false },
  { name: '411.com', type: 'directory', difficulty: 'medium', opt_out_url: 'https://411.com/privacy/request', requires_id: false },
  { name: 'Whitepages Premium', type: 'directory', difficulty: 'medium', opt_out_url: 'https://www.whitepages.com/suppression-requests', requires_id: false },
  { name: 'Localpeople', type: 'directory', difficulty: 'easy', opt_out_url: 'https://www.localpeople.com/optout', requires_id: false },
];

const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', icon: '✅' },
  medium: { label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: '⚠️' },
  hard: { label: 'Hard', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: '🔴' },
};

const TYPE_LABELS = {
  people_search: 'People Search',
  data_broker: 'Data Broker',
  credit_bureau: 'Credit Bureau',
  background_check: 'Background Check',
  directory: 'Directory',
};

export default function DataBrokerDirectory() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [removed, setRemoved] = useState(() => {
    try { return JSON.parse(localStorage.getItem('broker_removed') || '{}'); } catch { return {}; }
  });

  const toggleRemoved = (name) => {
    const updated = { ...removed, [name]: !removed[name] };
    setRemoved(updated);
    localStorage.setItem('broker_removed', JSON.stringify(updated));
  };

  const filtered = useMemo(() => {
    return DATA_BROKERS.filter(b => {
      const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || b.type === typeFilter;
      const matchesDiff = difficultyFilter === 'all' || b.difficulty === difficultyFilter;
      return matchesSearch && matchesType && matchesDiff;
    });
  }, [search, typeFilter, difficultyFilter]);

  const markAll = () => {
    const updated = {};
    filtered.forEach(b => { updated[b.name] = true; });
    const merged = { ...removed, ...updated };
    setRemoved(merged);
    localStorage.setItem('broker_removed', JSON.stringify(merged));
  };

  const clearAll = () => {
    setRemoved({});
    localStorage.removeItem('broker_removed');
  };

  const removedCount = Object.values(removed).filter(Boolean).length;
  const stats = {
    total: DATA_BROKERS.length,
    easy: DATA_BROKERS.filter(b => b.difficulty === 'easy').length,
    medium: DATA_BROKERS.filter(b => b.difficulty === 'medium').length,
    hard: DATA_BROKERS.filter(b => b.difficulty === 'hard').length,
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Data Broker Opt-Out Directory</h1>
        <p className="text-gray-400">Direct removal links for {stats.total}+ data broker sites — inspired by DeleteMe</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Brokers', value: stats.total, color: 'text-white' },
          { label: 'Easy Removal', value: stats.easy, color: 'text-green-400' },
          { label: 'Medium Removal', value: stats.medium, color: 'text-yellow-400' },
          { label: 'Opted Out', value: removedCount, color: 'text-purple-400' },
        ].map(s => (
          <Card key={s.label} className="glass-card border-red-500/10">
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-gray-400 text-sm">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bulk Actions */}
      <div className="flex gap-3">
        <Button size="sm" onClick={markAll} className="bg-green-600 hover:bg-green-700 text-white">
          <CheckCircle className="w-4 h-4 mr-1" /> Mark Visible as Opted Out
        </Button>
        <Button size="sm" variant="outline" onClick={clearAll} className="border-red-500/40 text-red-300 hover:bg-red-500/10">
          Clear All
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search brokers..."
            className="bg-slate-900/50 border-red-500/20 text-white pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 bg-slate-900/50 border-red-500/20 text-white">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
          <SelectTrigger className="w-44 bg-slate-900/50 border-red-500/20 text-white">
            <SelectValue placeholder="All Difficulties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Difficulties</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="glass-card border-red-500/20">
        <CardHeader className="border-b border-red-500/10 pb-3">
          <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
            <Database className="w-4 h-4 text-red-400" />
            {filtered.length} brokers — click a row to mark as opted out
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-800">
            {filtered.map((broker) => {
              const diff = DIFFICULTY_CONFIG[broker.difficulty];
              const isRemoved = removed[broker.name];
              return (
                <div
                  key={broker.name}
                  onClick={() => toggleRemoved(broker.name)}
                  className={`flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors ${
                    isRemoved ? 'bg-green-500/5 hover:bg-green-500/10' : 'hover:bg-slate-800/50'
                  }`}
                >
                  {/* Status */}
                  <div className="w-6 shrink-0">
                    {isRemoved
                      ? <CheckCircle className="w-5 h-5 text-green-400" />
                      : <div className="w-5 h-5 rounded-full border-2 border-slate-600" />}
                  </div>

                  {/* Name + Type */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${isRemoved ? 'text-gray-500 line-through' : 'text-white'}`}>
                      {broker.name}
                    </p>
                    <p className="text-xs text-gray-500">{TYPE_LABELS[broker.type]}</p>
                  </div>

                  {/* Difficulty */}
                  <Badge className={`text-xs ${diff.color} bg-transparent border ${diff.bg} hidden md:flex`}>
                    {diff.icon} {diff.label}
                  </Badge>

                  {/* Notes */}
                  {broker.notes && (
                    <p className="text-xs text-gray-500 hidden lg:block w-40 truncate">{broker.notes}</p>
                  )}

                  {/* ID required */}
                  {broker.requires_id && (
                    <Badge className="bg-orange-500/10 text-orange-400 border-0 text-xs hidden md:flex">
                      ID Required
                    </Badge>
                  )}

                  {/* Opt-Out Link */}
                  <a
                    href={broker.opt_out_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg px-3 py-1.5 hover:bg-red-500/10 transition-colors shrink-0"
                  >
                    Opt Out <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-gray-600">
        Opt-out links are maintained manually. Some sites may change their removal process. Always verify on the broker's official site.
      </p>
    </div>
  );
}