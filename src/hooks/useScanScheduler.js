import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { incognito, resolvePersonalDataValue } from '@/api/client';
import { useActiveProfile } from '@/hooks/useActiveProfile';

const FREQUENCY_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

const LAST_SCAN_KEY = 'incognito_last_auto_scan';
const LAST_BREACH_KEY = 'incognito_last_auto_breach';

function getLastRun(key) {
  const ts = localStorage.getItem(key);
  return ts ? parseInt(ts, 10) : 0;
}

function setLastRun(key) {
  localStorage.setItem(key, Date.now().toString());
}

export function useScanScheduler() {
  const queryClient = useQueryClient();
  const { activeProfileId } = useActiveProfile();
  const runningRef = useRef(false);

  const { data: prefs = [] } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: () => incognito.entities.UserPreferences.list(),
    staleTime: 60000,
  });

  const { data: personalData = [] } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => incognito.entities.PersonalData.list(),
    staleTime: 60000,
  });

  const preference = prefs[0] || {};
  const profileData = personalData.filter(d => !activeProfileId || d.profile_id === activeProfileId);

  const runAutoScan = useCallback(async () => {
    if (runningRef.current || !activeProfileId || profileData.length === 0) return;
    runningRef.current = true;

    try {
      const fullName = profileData.find(p => p.data_type === 'full_name');
      const emails = profileData.filter(d => d.data_type === 'email' && d.monitoring_enabled).map(e => e.value);

      // Data broker scan
      if (fullName || emails.length > 0) {
        try {
          await incognito.functions.invoke('detectSearchQueries', {
            profileId: activeProfileId,
            fullName: fullName ? resolvePersonalDataValue(fullName) : '',
            emails,
            phones: profileData.filter(p => p.data_type === 'phone').map(p => resolvePersonalDataValue(p)),
            addresses: profileData.filter(p => p.data_type === 'address').map(p => resolvePersonalDataValue(p)),
          });
        } catch { /* non-critical */ }
      }

      queryClient.invalidateQueries({ queryKey: ['scanResults'] });
      queryClient.invalidateQueries({ queryKey: ['searchQueryFindings'] });
      setLastRun(LAST_SCAN_KEY);

      // Create notification
      await incognito.entities.NotificationAlert.create({
        profile_id: activeProfileId,
        alert_type: 'scan_complete',
        title: 'Scheduled Scan Complete',
        message: `Auto-scan finished for your profile. Check the Dashboard for results.`,
        severity: 'info',
      });
      queryClient.invalidateQueries({ queryKey: ['notificationAlerts'] });

    } catch (e) {
      console.warn('[ScanScheduler] Auto scan failed:', e.message);
    } finally {
      runningRef.current = false;
    }
  }, [activeProfileId, profileData, queryClient]);

  const runAutoBreachCheck = useCallback(async () => {
    if (runningRef.current || !activeProfileId || profileData.length === 0) return;
    runningRef.current = true;

    try {
      const emails = profileData.filter(d => d.data_type === 'email' && d.monitoring_enabled).map(e => e.value);
      if (emails.length === 0) return;

      await incognito.functions.invoke('checkBreaches', {
        profileId: activeProfileId,
        emails,
      });

      queryClient.invalidateQueries({ queryKey: ['scanResults'] });
      setLastRun(LAST_BREACH_KEY);

    } catch (e) {
      console.warn('[ScanScheduler] Auto breach check failed:', e.message);
    } finally {
      runningRef.current = false;
    }
  }, [activeProfileId, profileData, queryClient]);

  // Check on mount and every 5 minutes whether a scheduled scan is due
  useEffect(() => {
    const checkSchedule = () => {
      if (!activeProfileId || profileData.length === 0) return;

      // Auto scan check
      if (preference.auto_scan_enabled) {
        const freq = FREQUENCY_MS[preference.scan_frequency] || FREQUENCY_MS.weekly;
        const lastScan = getLastRun(LAST_SCAN_KEY);
        if (Date.now() - lastScan >= freq) {
          console.log('[ScanScheduler] Auto scan due, running...');
          runAutoScan();
        }
      }

      // Auto breach check
      if (preference.auto_breach_check_enabled && preference.breach_monitoring_enabled !== false) {
        const freq = FREQUENCY_MS[preference.breach_check_frequency] || FREQUENCY_MS.weekly;
        const lastBreach = getLastRun(LAST_BREACH_KEY);
        if (Date.now() - lastBreach >= freq) {
          console.log('[ScanScheduler] Auto breach check due, running...');
          runAutoBreachCheck();
        }
      }
    };

    // Check immediately on mount, then every 5 minutes
    const timeout = setTimeout(checkSchedule, 3000); // 3s delay on mount to let data load
    const interval = setInterval(checkSchedule, 5 * 60 * 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [activeProfileId, profileData.length, preference.auto_scan_enabled, preference.scan_frequency,
      preference.auto_breach_check_enabled, preference.breach_monitoring_enabled,
      preference.breach_check_frequency, runAutoScan, runAutoBreachCheck]);
}
