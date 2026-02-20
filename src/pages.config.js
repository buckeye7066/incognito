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
import AIInsights from './pages/AIInsights';
import AdminFunctionTester from './pages/AdminFunctionTester';
import Dashboard from './pages/Dashboard';
import DeletionCenter from './pages/DeletionCenter';
import Findings from './pages/Findings';
import FixExposure from './pages/FixExposure';
import FunctionReviewer from './pages/FunctionReviewer';
import Home from './pages/Home';
import IdentityScan from './pages/IdentityScan';
import LegalSupport from './pages/LegalSupport';
import MonitoringHub from './pages/MonitoringHub';
import Notifications from './pages/Notifications';
import Profiles from './pages/Profiles';
import Scans from './pages/Scans';
import Settings from './pages/Settings';
import SocialMediaHub from './pages/SocialMediaHub';
import SpamTracker from './pages/SpamTracker';
import ThreatIntelligence from './pages/ThreatIntelligence';
import Vault from './pages/Vault';
import PasswordChecker from './pages/PasswordChecker';
import DataBrokerDirectory from './pages/DataBrokerDirectory';
import FinancialMonitor from './pages/FinancialMonitor';
import IdentityRecovery from './pages/IdentityRecovery';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIInsights": AIInsights,
    "AdminFunctionTester": AdminFunctionTester,
    "Dashboard": Dashboard,
    "DeletionCenter": DeletionCenter,
    "Findings": Findings,
    "FixExposure": FixExposure,
    "FunctionReviewer": FunctionReviewer,
    "Home": Home,
    "IdentityScan": IdentityScan,
    "LegalSupport": LegalSupport,
    "MonitoringHub": MonitoringHub,
    "Notifications": Notifications,
    "Profiles": Profiles,
    "Scans": Scans,
    "Settings": Settings,
    "SocialMediaHub": SocialMediaHub,
    "SpamTracker": SpamTracker,
    "ThreatIntelligence": ThreatIntelligence,
    "Vault": Vault,
    "PasswordChecker": PasswordChecker,
    "DataBrokerDirectory": DataBrokerDirectory,
    "FinancialMonitor": FinancialMonitor,
    "IdentityRecovery": IdentityRecovery,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};