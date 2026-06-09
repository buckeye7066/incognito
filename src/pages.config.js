/**
 * pages.config.js - Page routing configuration
 *
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 *
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 *
 * Example file structure:
 *
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 *
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import React from 'react';
const AIDefense = React.lazy(() => import('./pages/AIDefense'));
const AIInsights = React.lazy(() => import('./pages/AIInsights'));
const AdminFunctionTester = React.lazy(() => import('./pages/AdminFunctionTester'));
const CallGuard = React.lazy(() => import('./pages/CallGuard'));
const CloakedIdentities = React.lazy(() => import('./pages/CloakedIdentities'));
const CloakedPay = React.lazy(() => import('./pages/CloakedPay'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const DataBrokerDirectory = React.lazy(() => import('./pages/DataBrokerDirectory'));
const DeletionCenter = React.lazy(() => import('./pages/DeletionCenter'));
const EmailAliases = React.lazy(() => import('./pages/EmailAliases'));
const FinancialMonitor = React.lazy(() => import('./pages/FinancialMonitor'));
const Findings = React.lazy(() => import('./pages/Findings'));
const FixExposure = React.lazy(() => import('./pages/FixExposure'));
const FreePerks = React.lazy(() => import('./pages/FreePerks'));
const FunctionReviewer = React.lazy(() => import('./pages/FunctionReviewer'));
const Home = React.lazy(() => import('./pages/Home'));
const Household = React.lazy(() => import('./pages/Household'));
const IdentityRecovery = React.lazy(() => import('./pages/IdentityRecovery'));
const IdentityScan = React.lazy(() => import('./pages/IdentityScan'));
const IdentitySharing = React.lazy(() => import('./pages/IdentitySharing'));
const LegalSupport = React.lazy(() => import('./pages/LegalSupport'));
const MonitoringHub = React.lazy(() => import('./pages/MonitoringHub'));
const Notifications = React.lazy(() => import('./pages/Notifications'));
const PasswordChecker = React.lazy(() => import('./pages/PasswordChecker'));
const PasswordManager = React.lazy(() => import('./pages/PasswordManager'));
const PhoneAliases = React.lazy(() => import('./pages/PhoneAliases'));
const Profiles = React.lazy(() => import('./pages/Profiles'));
const SSNMonitor = React.lazy(() => import('./pages/SSNMonitor'));
const Scans = React.lazy(() => import('./pages/Scans'));
const Settings = React.lazy(() => import('./pages/Settings'));
const SocialMediaHub = React.lazy(() => import('./pages/SocialMediaHub'));
const SpamTracker = React.lazy(() => import('./pages/SpamTracker'));
const SystemSelfCheck = React.lazy(() => import('./pages/SystemSelfCheck'));
const TOTPAuthenticator = React.lazy(() => import('./pages/TOTPAuthenticator'));
const ThreatIntelligence = React.lazy(() => import('./pages/ThreatIntelligence'));
const VPNManager = React.lazy(() => import('./pages/VPNManager'));
const Vault = React.lazy(() => import('./pages/Vault'));
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIDefense": AIDefense,
    "AIInsights": AIInsights,
    "AdminFunctionTester": AdminFunctionTester,
    "CallGuard": CallGuard,
    "CloakedIdentities": CloakedIdentities,
    "CloakedPay": CloakedPay,
    "Dashboard": Dashboard,
    "DataBrokerDirectory": DataBrokerDirectory,
    "DeletionCenter": DeletionCenter,
    "EmailAliases": EmailAliases,
    "FinancialMonitor": FinancialMonitor,
    "Findings": Findings,
    "FixExposure": FixExposure,
    "FreePerks": FreePerks,
    "FunctionReviewer": FunctionReviewer,
    "Home": Home,
    "Household": Household,
    "IdentityRecovery": IdentityRecovery,
    "IdentityScan": IdentityScan,
    "IdentitySharing": IdentitySharing,
    "LegalSupport": LegalSupport,
    "MonitoringHub": MonitoringHub,
    "Notifications": Notifications,
    "PasswordChecker": PasswordChecker,
    "PasswordManager": PasswordManager,
    "PhoneAliases": PhoneAliases,
    "Profiles": Profiles,
    "SSNMonitor": SSNMonitor,
    "Scans": Scans,
    "Settings": Settings,
    "SocialMediaHub": SocialMediaHub,
    "SpamTracker": SpamTracker,
    "SystemSelfCheck": SystemSelfCheck,
    "TOTPAuthenticator": TOTPAuthenticator,
    "ThreatIntelligence": ThreatIntelligence,
    "VPNManager": VPNManager,
    "Vault": Vault,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
