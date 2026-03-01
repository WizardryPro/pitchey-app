import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Home, Globe, Briefcase, Users, Settings, Bell,
  ChevronDown, CircleUser, TrendingUp, Star, Award, FileText,
  Calendar, DollarSign, Activity,
  LogOut, User, HelpCircle, BarChart3,
  PieChart, Shield, Bookmark, HandshakeIcon, TrendingDown,
  Wallet, Building2, Filter, ArrowUpRight, History, LineChart,
  Menu
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@shared/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@shared/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@shared/components/ui/accordion";

interface InvestorUser {
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface InvestorNavigationProps {
  user: InvestorUser | null;
  onLogout: () => void;
}

export function InvestorNavigation({ user, onLogout }: InvestorNavigationProps) {
  const navigate = useNavigate();
  const [notificationCount] = React.useState(3);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleNavigation = (path: string) => {
    void navigate(path);
    setIsMobileMenuOpen(false); // Close mobile menu after navigation
  };

  return (
    <div className="flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-gray-200">
      {/* Logo and Mobile Menu */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <button
              className="xl:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0 bg-white">
            <SheetHeader className="px-6 py-4 border-b bg-white">
              <SheetTitle className="text-xl font-bold text-green-600">Menu</SheetTitle>
            </SheetHeader>
            <div className="px-4 py-4 bg-white">
              <Accordion type="single" collapsible className="w-full">
                {/* Dashboard Accordion */}
                <AccordionItem value="dashboard" className="border-b bg-white">
                  <AccordionTrigger className="hover:no-underline bg-white">
                    <div className="flex items-center gap-2">
                      <Home className="w-4 h-4" />
                      <span>Dashboard</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-white">
                    <div className="flex flex-col gap-1 pl-6">
                      <button
                        onClick={() => handleNavigation('/investor/dashboard')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <Home className="w-4 h-4" />
                        Overview
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/analytics')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Investment Analytics
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/performance-tracking')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <LineChart className="w-4 h-4" />
                        Performance Tracking
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/activity')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <Calendar className="w-4 h-4" />
                        Recent Activity
                      </button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Discover Accordion */}
                <AccordionItem value="discover" className="border-b bg-white">
                  <AccordionTrigger className="hover:no-underline bg-white">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      <span>Discover</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-white">
                    <div className="flex flex-col gap-1 pl-6">
                      <button
                        onClick={() => handleNavigation('/investor/discover')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <Globe className="w-4 h-4" />
                        All Pitches
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/discover?tab=trending')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <TrendingUp className="w-4 h-4" />
                        Trending Now
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/discover?tab=new')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <Star className="w-4 h-4" />
                        New Opportunities
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/discover?tab=featured')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <Award className="w-4 h-4" />
                        Featured Projects
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/discover?tab=high-potential')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        High Potential
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/discover/genres')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <Filter className="w-4 h-4" />
                        Browse by Genre
                      </button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Portfolio Accordion */}
                <AccordionItem value="portfolio" className="border-b bg-white">
                  <AccordionTrigger className="hover:no-underline bg-white">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      <span>Portfolio</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-white">
                    <div className="flex flex-col gap-1 pl-6">
                      <button
                        onClick={() => handleNavigation('/investor/all-investments')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <Briefcase className="w-4 h-4" />
                        All Investments
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/portfolio/active')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <Activity className="w-4 h-4" />
                        Active Projects
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/pending-deals')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <History className="w-4 h-4" />
                        Pending Deals
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/completed-projects')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Completed Projects
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/saved')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <Bookmark className="w-4 h-4" />
                        Saved Pitches
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/ndas')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <Shield className="w-4 h-4" />
                        NDA Management
                      </button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Network Accordion */}
                <AccordionItem value="network" className="border-b bg-white">
                  <AccordionTrigger className="hover:no-underline bg-white">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>Network</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-white">
                    <div className="flex flex-col gap-1 pl-6">
                      <button
                        onClick={() => handleNavigation('/investor/network')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <Users className="w-4 h-4" />
                        My Network
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/creators')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <User className="w-4 h-4" />
                        Connected Creators
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/co-investors')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <HandshakeIcon className="w-4 h-4" />
                        Co-Investors
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/production-companies')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <Building2 className="w-4 h-4" />
                        Production Companies
                      </button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Analytics Accordion */}
                <AccordionItem value="analytics" className="border-b bg-white">
                  <AccordionTrigger className="hover:no-underline bg-white">
                    <div className="flex items-center gap-2">
                      <PieChart className="w-4 h-4" />
                      <span>Analytics</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-white">
                    <div className="flex flex-col gap-1 pl-6">
                      <button
                        onClick={() => handleNavigation('/investor/analytics')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Investment Overview
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/roi-analysis')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <TrendingUp className="w-4 h-4" />
                        ROI Analysis
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/market-trends')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <LineChart className="w-4 h-4" />
                        Market Trends
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/risk-assessment')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <TrendingDown className="w-4 h-4" />
                        Risk Assessment
                      </button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Financials Accordion */}
                <AccordionItem value="financials" className="border-b bg-white">
                  <AccordionTrigger className="hover:no-underline bg-white">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4" />
                      <span>Financials</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-white">
                    <div className="flex flex-col gap-1 pl-6">
                      <button
                        onClick={() => handleNavigation('/investor/financial-overview')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <Wallet className="w-4 h-4" />
                        Financial Overview
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/transaction-history')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <DollarSign className="w-4 h-4" />
                        Transaction History
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/budget-allocation')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <PieChart className="w-4 h-4" />
                        Budget Allocation
                      </button>
                      <button
                        onClick={() => handleNavigation('/investor/tax-documents')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Tax Documents
                      </button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* User Profile Section */}
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center gap-3 px-2 py-3 bg-green-50 rounded-lg">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CircleUser className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{user?.firstName ?? 'Investor'} {user?.lastName ?? ''}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  <button
                    onClick={() => handleNavigation('/investor/profile')}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  >
                    <User className="w-4 h-4" />
                    View Profile
                  </button>
                  <button
                    onClick={() => handleNavigation('/investor/settings')}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2" data-discover="true">
          <span className="text-xl sm:text-2xl font-bold text-green-600">Pitchey</span>
        </Link>
      </div>

      {/* Main Navigation - Hidden on mobile and tablet */}
      <nav className="hidden xl:flex items-center gap-1">
        {/* Dashboard Dropdown - Matches mobile menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer">
            <Home className="w-4 h-4" aria-hidden="true" />
            <span>Dashboard</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/investor/dashboard')}>
              <Home className="w-4 h-4 mr-2" />
              Overview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/analytics')}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Investment Analytics
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/performance-tracking')}>
              <LineChart className="w-4 h-4 mr-2" />
              Performance Tracking
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/activity')}>
              <Calendar className="w-4 h-4 mr-2" />
              Recent Activity
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Discover Dropdown - Matches mobile menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer">
            <Globe className="w-4 h-4" aria-hidden="true" />
            <span>Discover</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/investor/discover')}>
              <Globe className="w-4 h-4 mr-2" />
              All Pitches
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/discover?tab=trending')}>
              <TrendingUp className="w-4 h-4 mr-2" />
              Trending Now
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/discover?tab=new')}>
              <Star className="w-4 h-4 mr-2" />
              New Opportunities
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/discover?tab=featured')}>
              <Award className="w-4 h-4 mr-2" />
              Featured Projects
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/discover?tab=high-potential')}>
              <ArrowUpRight className="w-4 h-4 mr-2" />
              High Potential
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/discover/genres')}>
              <Filter className="w-4 h-4 mr-2" />
              Browse by Genre
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Portfolio Dropdown - Matches mobile menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer">
            <Briefcase className="w-4 h-4" aria-hidden="true" />
            <span>Portfolio</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/investor/all-investments')}>
              <Briefcase className="w-4 h-4 mr-2" />
              All Investments
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/portfolio/active')}>
              <Activity className="w-4 h-4 mr-2" />
              Active Projects
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/pending-deals')}>
              <History className="w-4 h-4 mr-2" />
              Pending Deals
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/completed-projects')}>
              <FileText className="w-4 h-4 mr-2" />
              Completed Projects
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/saved')}>
              <Bookmark className="w-4 h-4 mr-2" />
              Saved Pitches
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/ndas')}>
              <Shield className="w-4 h-4 mr-2" />
              NDA Management
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Network Dropdown - Matches mobile menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer">
            <Users className="w-4 h-4" aria-hidden="true" />
            <span>Network</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/investor/network')}>
              <Users className="w-4 h-4 mr-2" />
              My Network
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/creators')}>
              <User className="w-4 h-4 mr-2" />
              Connected Creators
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/co-investors')}>
              <HandshakeIcon className="w-4 h-4 mr-2" />
              Co-Investors
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/production-companies')}>
              <Building2 className="w-4 h-4 mr-2" />
              Production Companies
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Analytics Dropdown - Matches mobile menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer">
            <PieChart className="w-4 h-4" aria-hidden="true" />
            <span>Analytics</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/investor/analytics')}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Investment Overview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/roi-analysis')}>
              <TrendingUp className="w-4 h-4 mr-2" />
              ROI Analysis
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/market-trends')}>
              <LineChart className="w-4 h-4 mr-2" />
              Market Trends
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/risk-assessment')}>
              <TrendingDown className="w-4 h-4 mr-2" />
              Risk Assessment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Financials Dropdown - Matches mobile menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer">
            <Wallet className="w-4 h-4" aria-hidden="true" />
            <span>Financials</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/investor/financial-overview')}>
              <Wallet className="w-4 h-4 mr-2" />
              Financial Overview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/transaction-history')}>
              <DollarSign className="w-4 h-4 mr-2" />
              Transaction History
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/budget-allocation')}>
              <PieChart className="w-4 h-4 mr-2" />
              Budget Allocation
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/tax-documents')}>
              <FileText className="w-4 h-4 mr-2" />
              Tax Documents
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <div className="relative">
          <button 
            className="relative p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200"
            aria-label="Notifications"
            title="Notifications"
            onClick={() => handleNavigation('/investor/notifications')}
          >
            <Bell className="w-6 h-6" aria-hidden="true" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>
        </div>

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <CircleUser className="w-5 h-5 text-green-600" aria-hidden="true" />
            </div>
            <ChevronDown className="w-4 h-4 text-gray-600" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-semibold">{user?.firstName ?? 'Investor'} {user?.lastName ?? ''}</span>
                <span className="text-sm text-gray-500">{user?.email}</span>
                <span className="text-xs text-green-600 mt-1">Accredited Investor</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => handleNavigation('/investor/profile')}>
                <User className="w-4 h-4 mr-2" />
                Investment Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigation('/investor/dashboard')}>
                <Home className="w-4 h-4 mr-2" />
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigation('/investor/all-investments')}>
                <Briefcase className="w-4 h-4 mr-2" />
                Portfolio
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/investor/wallet')}>
              <Wallet className="w-4 h-4 mr-2" />
              Wallet & Funds
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/transaction-history')}>
              <History className="w-4 h-4 mr-2" />
              Transactions
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/investor/settings')}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/investor/help')}>
              <HelpCircle className="w-4 h-4 mr-2" />
              Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onLogout}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}