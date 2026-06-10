import { Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ActiveProfileProvider } from '@/hooks/useActiveProfile';
import { useScanScheduler } from '@/hooks/useScanScheduler';
import AdminRoute from '@/lib/AdminRoute';
import FillApprovalGate from '@/components/common/FillApprovalGate';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const PageFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();
  useScanScheduler();

  if (isLoadingAuth) {
    return <PageFallback />;
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        } />
        {Object.entries(Pages).map(([path, Page]) => {
          const isAdmin = ['SystemSelfCheck', 'AdminFunctionTester', 'FunctionReviewer'].includes(path);
          return (
            <Route
              key={path}
              path={`/${path}`}
              element={
                <LayoutWrapper currentPageName={path}>
                  {isAdmin ? <AdminRoute><Page /></AdminRoute> : <Page />}
                </LayoutWrapper>
              }
            />
          );
        })}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ActiveProfileProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <NavigationTracker />
            <AuthenticatedApp />
          </Router>
          <FillApprovalGate />
          <Toaster />
        </ActiveProfileProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
