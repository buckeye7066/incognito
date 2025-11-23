import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { Shield, Database, Scan, FileText, Trash2, Settings, Eye } from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  const navigation = [
    { name: 'Dashboard', path: 'Dashboard', icon: Shield },
    { name: 'Vault', path: 'Vault', icon: Database },
    { name: 'Scans', path: 'Scans', icon: Scan },
    { name: 'Findings', path: 'Findings', icon: Eye },
    { name: 'Deletion Center', path: 'DeletionCenter', icon: Trash2 },
    { name: 'Settings', path: 'Settings', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      <style>{`
        :root {
          --primary: 147 51 234;
          --primary-dark: 126 34 206;
          --accent: 168 85 247;
          --danger: 239 68 68;
          --warning: 251 191 36;
          --success: 34 197 94;
          --bg-dark: 15 23 42;
          --bg-darker: 2 6 23;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .glass-card {
          background: rgba(30, 27, 75, 0.4);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(139, 92, 246, 0.2);
        }
        
        .glow-border {
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.3);
        }
      `}</style>

      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 glass-card border-r border-purple-500/20 flex flex-col">
          <div className="p-6 border-b border-purple-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Incognito</h1>
                <p className="text-xs text-purple-300">Privacy Guardian</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = currentPageName === item.path;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.path)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white glow-border'
                      : 'text-purple-200 hover:bg-purple-900/30 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-purple-500/20">
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold">
                  U
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">User</p>
                  <p className="text-xs text-purple-300">Protected</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}