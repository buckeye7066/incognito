import SetupSteps from '@/components/common/SetupSteps';
import { ExternalLink } from 'lucide-react';

const Ext = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
    {children}<ExternalLink className="h-3 w-3" />
  </a>
);

/**
 * Step-by-step guide for enabling optional, provider-backed features by adding
 * API keys. The app works offline without these; each key only unlocks the one
 * feature that needs it, and keys are encrypted in the vault.
 */
export default function ProviderSetupGuide() {
  const steps = [
    {
      title: 'Decide what you want to enable',
      body: <p>Everything works offline by default. Features that need an outside service show a <b>“Needs provider”</b> badge. The Dashboard's <b>Protection Coverage</b> panel lists exactly which ones and what they need.</p>,
    },
    {
      title: 'Get a key from that provider',
      body: (
        <ul className="space-y-1">
          <li>AI assistant — <Ext href="https://platform.openai.com/api-keys">OpenAI</Ext></li>
          <li>Breach checks — <Ext href="https://haveibeenpwned.com/API/Key">Have I Been Pwned</Ext></li>
          <li>Email discovery — <Ext href="https://hunter.io/api-keys">Hunter</Ext></li>
          <li>Virtual cards — <Ext href="https://privacy.com/account">Privacy.com</Ext></li>
          <li>Email aliases — <Ext href="https://app.simplelogin.io/dashboard/api_key">SimpleLogin</Ext> / <Ext href="https://app.addy.io/settings/api">addy.io</Ext></li>
          <li>Phone / call screening — <Ext href="https://www.twilio.com/console">Twilio</Ext></li>
        </ul>
      ),
    },
    {
      title: 'Paste the key in API Keys below and Save',
      body: <p>Scroll to <b>API Keys</b> on this page, paste the key, and press Save. Keys are <b>encrypted in your vault</b> and only ever sent to that one provider.</p>,
    },
    {
      title: 'Grant consent the first time',
      body: <p>The first real request asks permission to send the specific data type that feature needs (e.g. “email” for a breach check). You can review or revoke consent anytime.</p>,
    },
    {
      title: 'Confirm it turned on',
      body: <p>Re-open the Dashboard's <b>Protection Coverage</b> — the feature should flip from “Needs provider” to <b>Ready</b>.</p>,
    },
  ];

  return <SetupSteps id="providers" title="Connect a service to unlock a feature — step by step" steps={steps} />;
}
