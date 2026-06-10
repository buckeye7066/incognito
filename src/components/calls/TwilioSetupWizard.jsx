import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import SetupSteps from '@/components/common/SetupSteps';
import { getBackendUrl, setBackendUrl } from '@/providers/index.js';
import { BACKEND_SECRET_KEY } from '@/lib/familyCoverage';
import { notify } from '@/lib/notify';

const Ext = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
    {children}<ExternalLink className="h-3 w-3" />
  </a>
);

/**
 * Step-by-step guide to turn on real call screening (Twilio + backend + tunnel).
 * Self-contained: the connection step writes the same backend URL / secret the
 * Family Call Coverage page reads, so Sync/Load "just work" after setup.
 */
export default function TwilioSetupWizard() {
  const [url, setUrl] = useState(() => getBackendUrl() || '');
  const [secret, setSecret] = useState(() => localStorage.getItem(BACKEND_SECRET_KEY) || '');

  const saveConn = () => {
    setBackendUrl(url.trim() || null);
    localStorage.setItem(BACKEND_SECRET_KEY, secret.trim());
    notify.success('Backend connection saved.');
  };

  const base = (url || '').trim().replace(/\/$/, '');
  const webhookUrl = base ? `${base}/webhooks/twilio/voice` : 'https://YOUR-TUNNEL-URL/webhooks/twilio/voice';

  const steps = [
    {
      title: 'Create a Twilio account and buy a number for each person',
      body: (
        <div className="space-y-1">
          <p>Sign in at <Ext href="https://www.twilio.com/console">Twilio Console</Ext> and buy one phone number <b>per person</b> you want to cover (you, your spouse, each child). This is the number they'll hand out.</p>
          <p className="text-xs">Numbers cost a small monthly fee. Voice-capable local numbers are fine.</p>
        </div>
      ),
    },
    {
      title: 'Start the backend + public tunnel (one command)',
      body: (
        <div className="space-y-1">
          <p>Twilio needs to reach your computer. Double-click <b>start-backend-tunnel.bat</b> in the project folder (or run the command below). It starts the backend and prints a public <span className="font-mono">https://…trycloudflare.com</span> address — copy that address.</p>
          <p className="text-xs">Requires cloudflared (already installed on this PC). Keep that window open while you want screening active.</p>
        </div>
      ),
      copy: { label: 'Copy command', value: 'start-backend-tunnel.bat' },
    },
    {
      title: 'Connect Incognito to your backend',
      body: (
        <div className="space-y-2">
          <p>Paste the tunnel address as the Backend URL, and set a Shared secret. The secret must match <span className="font-mono">WEBHOOK_SHARED_SECRET</span> in <span className="font-mono">server/.env</span>.</p>
          <div>
            <Label className="text-xs">Backend URL</Label>
            <Input placeholder="https://something.trycloudflare.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Shared secret</Label>
            <Input type="password" placeholder="the same value as server/.env WEBHOOK_SHARED_SECRET" value={secret} onChange={(e) => setSecret(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" onClick={saveConn}>Save connection</Button>
        </div>
      ),
    },
    {
      title: "Point each Twilio number's Voice webhook here",
      body: (
        <div className="space-y-1">
          <p>In <Ext href="https://www.twilio.com/console/phone-numbers/incoming">Twilio → Phone Numbers → (your number) → Voice Configuration</Ext>, set <b>“A call comes in”</b> to <b>Webhook</b>, method <b>HTTP POST</b>, and paste the URL below. Repeat for every number.</p>
          <p className="text-xs">This URL updates automatically from the Backend URL you entered above.</p>
        </div>
      ),
      copy: { label: 'Copy webhook', value: webhookUrl },
    },
    {
      title: 'Add your people and Sync',
      body: <p>Use <b>“Add a person”</b> above to enter each person's screening number + real phone, then press <b>“Sync coverage to backend”</b> below the list. That tells the backend who to screen for.</p>,
    },
    {
      title: 'Place a test call to verify',
      body: <p>From a phone that is <i>not</i> on the allow list, call one of the covered Twilio numbers. Then press <b>“Load recent calls”</b> below — you should see the call logged as blocked, rang-through, or voicemail. That confirms it end-to-end.</p>,
    },
  ];

  return <SetupSteps id="twilio_call_routing" title="Turn on real call screening — step by step" steps={steps} />;
}
