import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Send, Loader2, User, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SUGGESTED_QUESTIONS = [
  "What are my biggest privacy risks?",
  "Which data should I remove first?",
  "How do I interpret my risk score?",
  "What's the status of my deletions?",
];

function Message({ msg }) {
  return (
    <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
        msg.role === 'user' ? 'bg-red-600/30' : 'bg-purple-600/30'
      }`}>
        {msg.role === 'user'
          ? <User className="w-4 h-4 text-red-300" />
          : <Brain className="w-4 h-4 text-purple-300" />
        }
      </div>
      <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
        msg.role === 'user'
          ? 'bg-red-600/20 text-white rounded-tr-sm'
          : 'bg-slate-700/60 text-gray-200 rounded-tl-sm'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

export default function PrivacyAssistant({ scanResults = [], personalData = [], deletionRequests = [], riskScore = 0 }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your Privacy AI assistant. I have access to your scan results, vault data, and deletion requests. Ask me anything about your privacy report or what steps to take next."
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const buildContext = () => {
    const highRisk = scanResults.filter(r => r.risk_score >= 70);
    const pending = deletionRequests.filter(r => r.status === 'pending' || r.status === 'in_progress');
    const completed = deletionRequests.filter(r => r.status === 'completed');
    const failed = deletionRequests.filter(r => r.status === 'failed');

    return `
USER PRIVACY REPORT SUMMARY:
- Overall Risk Score: ${riskScore}/100
- Total scan results: ${scanResults.length}
- High risk exposures (score ≥70): ${highRisk.length} — sites: ${highRisk.map(r => r.source_name).slice(0, 5).join(', ')}
- Personal data items in vault: ${personalData.length} — types: ${[...new Set(personalData.map(d => d.data_type))].join(', ')}
- Deletion requests: ${deletionRequests.length} total (${pending.length} pending, ${completed.length} completed, ${failed.length} failed)
- Top exposed sources: ${scanResults.slice(0, 5).map(r => `${r.source_name} (risk: ${r.risk_score})`).join(', ')}

Answer the user's question based on their actual privacy data above. Be concise, actionable, and specific to their situation. Do not use markdown formatting. Keep answers under 150 words.
    `.trim();
  };

  const send = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    const history = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `${buildContext()}\n\nConversation so far:\n${history}\n\nUser: ${userMsg}\n\nAssistant:`
    });

    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
  };

  return (
    <Card className="glass-card border-purple-500/20">
      <CardHeader
        className="border-b border-purple-500/20 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            Privacy AI Assistant
            <Badge className="bg-purple-500/20 text-purple-300 text-xs border-0">Beta</Badge>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </CardTitle>
      </CardHeader>

      {open && (
        <CardContent className="p-0">
          {/* Messages */}
          <div className="h-72 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-purple-300" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-slate-700/60">
                  <Loader2 className="w-4 h-4 text-purple-300 animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested Questions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-xs px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 transition-colors"
                >
                  <Sparkles className="w-3 h-3 inline mr-1" />
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-purple-500/20 flex gap-2">
            <input
              className="flex-1 bg-slate-800/60 border border-purple-500/30 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/60"
              placeholder="Ask about your privacy..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && send()}
              disabled={loading}
            />
            <Button
              size="icon"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="bg-purple-600 hover:bg-purple-700 rounded-xl"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}