import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { 
  Home, Shield, FileText, Users, Menu, X, LogOut, ChevronDown, CheckCircle2, MessageCircle, Eye, XCircle 
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isREPro, setIsREPro] = useState(false);
  const [viewMode, setViewMode] = useState('my'); // 'my' or 'client'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        // Check if user has an RE Pro record
        if (currentUser) {
          const reProRecords = await base44.entities.REPro.filter({ 
            rep_email: currentUser.email 
          });
          
          console.log('🔍 RE Pro Status Check:');
          console.log('  Email:', currentUser.email);
          console.log('  Role:', currentUser.role);
          console.log('  RE Pro Records Found:', reProRecords.length);
          console.log('  Setting isREPro to:', reProRecords.length > 0);
          
          if (reProRecords.length > 0) {
            setIsREPro(true);
          }
        }
        setLoading(false);
      } catch (err) {
        console.error('Error in loadUser:', err);
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  // Sync viewMode with current page
  useEffect(() => {
    // Don't redirect until loading is complete
    if (loading) return;

    // Allow AgentView for RE Pros and admins
    if (currentPageName === 'AgentView' && (isREPro || isAdmin)) {
      setViewMode('client');
    } else if (currentPageName === 'Dashboard' || !currentPageName) {
      setViewMode('my');
    } else if (currentPageName === 'AgentView' && !isREPro && !isAdmin) {
      // Redirect non-RE Pros and non-admins away from AgentView
      window.location.href = createPageUrl('Dashboard');
    }
  }, [currentPageName, isREPro, loading]);

  const isAdmin = user?.role === 'admin';

  const customerNav = [
    { name: 'Dashboard', page: (isREPro && viewMode === 'client') ? 'AgentView' : 'Dashboard', icon: Home },
    { name: 'Policies', page: 'Policies', icon: Shield },
    { name: 'Claims', page: 'Claims', icon: FileText },
    { name: 'Inbox', page: 'Inbox', icon: MessageCircle },
  ];

  const adminNav = [
    { name: 'Dashboard', page: 'Dashboard', icon: Home },
    { name: 'Customers', page: 'AdminCustomers', icon: Users },
    { name: 'Policies', page: 'AdminPolicies', icon: Shield },
    { name: 'Claims', page: 'AdminClaims', icon: FileText },
    { name: 'Inbox', page: 'Inbox', icon: MessageCircle },
    { name: 'Users', page: 'AdminUsers', icon: Users },
    { name: 'RE Pros', page: 'AdminREPros', icon: Users },
    { name: 'Email Templates', page: 'AdminEmailTemplates', icon: MessageCircle },
    { name: 'Zoho Sync', page: 'AdminZoho', icon: Shield },
  ];

  const navigation = isAdmin ? adminNav : customerNav;

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
            <div className="h-9 w-9 bg-gradient-to-br from-slate-800 to-slate-600 rounded-lg flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-base font-semibold text-slate-900">
              SilverBack
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {/* View Toggle for RE Pros and Admins */}
            {!loading && (isREPro || isAdmin) && (
              <div className="mb-4 bg-slate-100 rounded-lg p-1 flex gap-1">
                <button
                  onClick={() => {
                    setViewMode('my');
                    window.location.href = createPageUrl('Dashboard');
                  }}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'my' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  My Properties
                </button>
                <button
                  onClick={() => {
                    setViewMode('client');
                    window.location.href = createPageUrl('AgentView');
                  }}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'client' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Client Properties
                </button>
              </div>
            )}

            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = currentPageName === item.page;

              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-slate-900 text-white' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}

            <div className="pt-3 pb-2 px-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Actions</p>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                window.open('https://silverbackhw.com/order-policy', '_blank');
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors text-left"
            >
              <Shield className="h-5 w-5" />
              Order New Policy
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                if (currentPageName === 'Dashboard') {
                  window.dispatchEvent(new CustomEvent('openSubmitClaim'));
                } else {
                  window.location.href = createPageUrl('Dashboard');
                  setTimeout(() => window.dispatchEvent(new CustomEvent('openSubmitClaim')), 100);
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors text-left"
            >
              <FileText className="h-5 w-5" />
              Submit New Claim
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                if (currentPageName === 'Dashboard') {
                  window.dispatchEvent(new CustomEvent('openCoverageChecker'));
                } else {
                  window.location.href = createPageUrl('Dashboard');
                  setTimeout(() => window.dispatchEvent(new CustomEvent('openCoverageChecker')), 100);
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors text-left"
            >
              <CheckCircle2 className="h-5 w-5" />
              Check Coverage
            </button>
            <Link
              to={createPageUrl('Inbox')}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors text-left"
            >
              <MessageCircle className="h-5 w-5" />
              Contact SilverBack
            </Link>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                window.open('https://silverbackhw.com', '_blank');
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors text-left"
            >
              <Home className="h-5 w-5" />
              Add Home Services
            </button>
            <a
              href="https://workdrive.zohoexternal.com/external/9aebbd4d42bb52ecbe0f404bb482dd2532d647030075bb3872824f52ced98b51"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors text-left"
            >
              <FileText className="h-5 w-5" />
              View Contract
            </a>
          </nav>

          {/* User Profile */}
          <div className="border-t border-slate-200 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-100">
                  <div className="h-8 w-8 bg-slate-200 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-slate-600">
                      {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-slate-900">{user?.full_name || 'User'}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-gradient-to-br from-slate-800 to-slate-600 rounded-lg flex items-center justify-center">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-semibold text-slate-900">
                SilverBack
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 text-center space-y-2">
            <p className="text-sm text-slate-600">
              "SilverBack we've got your back" • Call us at <a href="tel:8016868927" className="font-semibold text-slate-900 hover:text-slate-700 underline">(801)686-8927</a> if you have any questions.
            </p>
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} SilverBack Home Warranty. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}