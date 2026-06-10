import { useCapabilities } from '@/hooks/useCapabilities';
import { CAPABILITY } from '@/providers';
import { CAPABILITY_STATUS } from '@/providers/capabilities';
import SetupSteps from '@/components/common/SetupSteps';

/**
 * Step-by-step guide to load the companion browser extension (autofill).
 * Self-gating: once AUTOFILL is Ready (the extension is loaded) it disappears.
 */
export default function ExtensionSetupGuide() {
  const { capabilities } = useCapabilities();
  if (capabilities[CAPABILITY.AUTOFILL]?.status === CAPABILITY_STATUS.READY) return null;

  const steps = [
    {
      title: 'Easiest: launch with the bundled launcher',
      body: <p>Double-click <b>launch.bat</b> in the project folder (or your desktop shortcut). It opens the app in a browser with the autofill extension already loaded — nothing else to do.</p>,
      copy: { label: 'Copy', value: 'launch.bat' },
    },
    {
      title: 'Or load it manually in Chrome/Edge',
      body: (
        <ol className="list-decimal ml-4 space-y-1">
          <li>Open the extensions page (paste the address below).</li>
          <li>Turn on <b>Developer mode</b> (top-right toggle).</li>
          <li>Click <b>Load unpacked</b> and choose the <span className="font-mono">extension</span> folder inside the project.</li>
        </ol>
      ),
      copy: { label: 'Copy address', value: 'chrome://extensions' },
    },
    {
      title: 'Use it',
      body: <p>Unlock your vault, then on any sign-in page click the Incognito popup and pick a login. You approve each fill in the app, so nothing is filled silently. <span className="text-xs">(Phones can't run browser extensions — autofill is for your computer.)</span></p>,
    },
  ];

  return <SetupSteps id="browser_extension" title="Turn on password autofill — step by step" steps={steps} />;
}
