import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Globe, Briefcase, Users, Search, Settings, Bell, 
  ChevronDown, CircleUser, Film, Plus, BarChart3, Shield,
  TrendingUp, Star, Award, FileText, MessageSquare, Calendar,
  DollarSign, Eye, Activity, FolderOpen, Upload, Target,
  LogOut, User, CreditCard, HelpCircle, Moon, Sun, Menu, X,
  ChevronRight
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

interface CreatorNavigationProps {
  user: any;
  onLogout: () => void;
}

export function CreatorNavigation({ user, onLogout }: CreatorNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [notificationCount, setNotificationCount] = React.useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleNavigation = (path: string) => {
    navigate(path);
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
              <SheetTitle className="text-xl font-bold text-purple-600">Menu</SheetTitle>
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
                    <div className="flex flex-col gap-1 pl-6 bg-white">
                      <button
                        onClick={() => handleNavigation('/creator/dashboard')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Home className="w-4 h-4" />
                        Overview
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/analytics')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Analytics
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/metrics')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Activity className="w-4 h-4" />
                        Performance Metrics
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/activity')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Calendar className="w-4 h-4" />
                        Recent Activity
                      </button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Browse Accordion */}
                <AccordionItem value="browse" className="border-b bg-white">
                  <AccordionTrigger className="hover:no-underline bg-white">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      <span>Browse</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-white">
                    <div className="flex flex-col gap-1 pl-6 bg-white">
                      <button
                        onClick={() => handleNavigation('/creator/browse')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Globe className="w-4 h-4" />
                        All Pitches
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/browse?tab=trending')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <TrendingUp className="w-4 h-4" />
                        Trending
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/browse?tab=new')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Star className="w-4 h-4" />
                        New Releases
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/browse?tab=featured')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Award className="w-4 h-4" />
                        Featured
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/browse/genres')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Film className="w-4 h-4" />
                        Browse by Genre
                      </button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Projects Accordion */}
                <AccordionItem value="projects" className="border-b bg-white">
                  <AccordionTrigger className="hover:no-underline bg-white">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      <span>Projects</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-white">
                    <div className="flex flex-col gap-1 pl-6 bg-white">
                      <button
                        onClick={() => handleNavigation('/creator/pitches')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Film className="w-4 h-4" />
                        My Pitches
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/pitch/new')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Create New Pitch
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/drafts')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <FolderOpen className="w-4 h-4" />
                        Drafts
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/pitch-analytics')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Pitch Analytics
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/ndas')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Shield className="w-4 h-4" />
                        NDA Management
                      </button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Team Accordion */}
                <AccordionItem value="team" className="border-b bg-white">
                  <AccordionTrigger className="hover:no-underline bg-white">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>Team</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-white">
                    <div className="flex flex-col gap-1 pl-6 bg-white">
                      <button
                        onClick={() => handleNavigation('/creator/team')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Users className="w-4 h-4" />
                        Team Members
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/collaborators')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Collaborators
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/investors')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <DollarSign className="w-4 h-4" />
                        Connected Investors
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/invitations')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Invite Members
                      </button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Search Accordion */}
                <AccordionItem value="search" className="border-b bg-white">
                  <AccordionTrigger className="hover:no-underline bg-white">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4" />
                      <span>Search</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-white">
                    <div className="flex flex-col gap-1 pl-6 bg-white">
                      <button
                        onClick={() => handleNavigation('/creator/search')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Search className="w-4 h-4" />
                        Search Pitches
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/search/investors')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Users className="w-4 h-4" />
                        Find Investors
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/search/companies')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Briefcase className="w-4 h-4" />
                        Production Companies
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/search/advanced')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Target className="w-4 h-4" />
                        Advanced Search
                      </button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Settings Accordion */}
                <AccordionItem value="settings" className="border-b bg-white">
                  <AccordionTrigger className="hover:no-underline bg-white">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-white">
                    <div className="flex flex-col gap-1 pl-6 bg-white">
                      <button
                        onClick={() => handleNavigation('/creator/settings')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        General Settings
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/profile')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <User className="w-4 h-4" />
                        Profile Settings
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/billing')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <CreditCard className="w-4 h-4" />
                        Billing & Subscription
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/notifications')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <Bell className="w-4 h-4" />
                        Notification Preferences
                      </button>
                      <button
                        onClick={() => handleNavigation('/creator/help')}
                        className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                      >
                        <HelpCircle className="w-4 h-4" />
                        Help & Support
                      </button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* User Profile Section */}
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center gap-3 px-2 py-3 bg-purple-50 rounded-lg">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <CircleUser className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{user?.firstName || 'Creator'} {user?.lastName || ''}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  <button
                    onClick={() => handleNavigation('/creator/profile')}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    <User className="w-4 h-4" />
                    View Profile
                  </button>
                  <button
                    onClick={() => handleNavigation('/creator/billing')}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    Billing
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
          <span className="text-xl sm:text-2xl font-bold text-purple-600">Pitchey</span>
        </Link>
      </div>

      {/* Main Navigation - Hidden on mobile and tablet */}
      <nav className="hidden xl:flex items-center gap-1">
        {/* Dashboard Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer">
            <Home className="w-4 h-4" aria-hidden="true" />
            <span>Dashboard</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/creator/dashboard')}>
              <Home className="w-4 h-4 mr-2" />
              Overview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/analytics')}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/metrics')}>
              <Activity className="w-4 h-4 mr-2" />
              Performance Metrics
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/activity')}>
              <Calendar className="w-4 h-4 mr-2" />
              Recent Activity
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Browse Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer">
            <Globe className="w-4 h-4" aria-hidden="true" />
            <span>Browse</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/creator/browse')}>
              <Globe className="w-4 h-4 mr-2" />
              All Pitches
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/browse?tab=trending')}>
              <TrendingUp className="w-4 h-4 mr-2" />
              Trending
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/browse?tab=new')}>
              <Star className="w-4 h-4 mr-2" />
              New Releases
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/browse?tab=featured')}>
              <Award className="w-4 h-4 mr-2" />
              Featured
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/creator/browse/genres')}>
              <Film className="w-4 h-4 mr-2" />
              Browse by Genre
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Projects Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer">
            <Briefcase className="w-4 h-4" aria-hidden="true" />
            <span>Projects</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/creator/pitches')}>
              <Film className="w-4 h-4 mr-2" />
              My Pitches
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/pitch/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Create New Pitch
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/creator/drafts')}>
              <FolderOpen className="w-4 h-4 mr-2" />
              Drafts
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/pitch-analytics')}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Pitch Analytics
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/ndas')}>
              <Shield className="w-4 h-4 mr-2" />
              NDA Management
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Team Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer">
            <Users className="w-4 h-4" aria-hidden="true" />
            <span>Team</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/creator/team')}>
              <Users className="w-4 h-4 mr-2" />
              Team Members
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/collaborators')}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Collaborators
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/investors')}>
              <DollarSign className="w-4 h-4 mr-2" />
              Connected Investors
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/creator/invitations')}>
              <Plus className="w-4 h-4 mr-2" />
              Invite Members
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer">
            <Search className="w-4 h-4" aria-hidden="true" />
            <span>Search</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/creator/search')}>
              <Search className="w-4 h-4 mr-2" />
              Search Pitches
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/search/investors')}>
              <Users className="w-4 h-4 mr-2" />
              Find Investors
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/search/companies')}>
              <Briefcase className="w-4 h-4 mr-2" />
              Production Companies
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/creator/search/advanced')}>
              <Target className="w-4 h-4 mr-2" />
              Advanced Search
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer">
            <Settings className="w-4 h-4" aria-hidden="true" />
            <span>Settings</span>
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-white">
            <DropdownMenuItem onClick={() => handleNavigation('/creator/settings')}>
              <Settings className="w-4 h-4 mr-2" />
              General Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/profile')}>
              <User className="w-4 h-4 mr-2" />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/billing')}>
              <CreditCard className="w-4 h-4 mr-2" />
              Billing & Subscription
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/notifications')}>
              <Bell className="w-4 h-4 mr-2" />
              Notification Preferences
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/creator/help')}>
              <HelpCircle className="w-4 h-4 mr-2" />
              Help & Support
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <div className="relative">
          <button 
            className="relative p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
            aria-label="Notifications"
            title="Notifications"
            onClick={() => handleNavigation('/creator/notifications')}
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
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <CircleUser className="w-5 h-5 text-purple-600" aria-hidden="true" />
            </div>
            <ChevronDown className="w-4 h-4 text-gray-600" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-semibold">{user?.firstName || 'Creator'} {user?.lastName || ''}</span>
                <span className="text-sm text-gray-500">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => handleNavigation('/creator/profile')}>
                <User className="w-4 h-4 mr-2" />
                View Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigation('/creator/dashboard')}>
                <Home className="w-4 h-4 mr-2" />
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigation('/creator/settings')}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavigation('/creator/billing')}>
              <CreditCard className="w-4 h-4 mr-2" />
              Billing
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/creator/help')}>
              <HelpCircle className="w-4 h-4 mr-2" />
              Help
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