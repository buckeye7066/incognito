import Dashboard from './pages/Dashboard';
import Vault from './pages/Vault';
import Scans from './pages/Scans';
import Findings from './pages/Findings';
import DeletionCenter from './pages/DeletionCenter';
import Settings from './pages/Settings';
import Profiles from './pages/Profiles';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Vault": Vault,
    "Scans": Scans,
    "Findings": Findings,
    "DeletionCenter": DeletionCenter,
    "Settings": Settings,
    "Profiles": Profiles,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};