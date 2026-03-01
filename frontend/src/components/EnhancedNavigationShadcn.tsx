import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Menu, X, LogOut, Plus, Eye, Coins, CreditCard, Bell,
  Users, Home, Film, Search, Shield, BarChart3, FileText,
  Settings, UserCircle, ChevronDown, Briefcase, TrendingUp,
  Calendar, MessageSquare, Star, Globe, PlayCircle, Upload,
  FolderOpen, UserPlus, Layers, Target, Activity, Award,
  DollarSign, PieChart, Clock, CheckCircle, AlertCircle,
  ChevronRight, Building, ShoppingCart
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { NDANotificationBadge } from './NDANotifications';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@shared/components/ui/tooltip";
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
import { useState, useEffect } from 'react';
import { paymentsAPI } from '@/lib/apiServices';

interface EnhancedNavigationShadcnProps {
  user: any;
  userType: 'creator' | 'investor' | 'production';
  onLogout: () => void;
}

export function EnhancedNavigationShadcn({ 
  user, 
  userType, 
  onLogout
}: EnhancedNavigationShadcnProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number>(0);

  useEffect(() => {
    if (userType === 'creator') {
      paymentsAPI.getCreditBalance().then((data: any) => {
        if (data) {
          setCreditBalance(data.balance?.credits ?? data.credits ?? 0);
        }
      }).catch(() => {});
    }
  }, [userType]);

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false); // Close mobile menu after navigation
  };

  const getThemeColor = () => {
    switch (userType) {
      case 'creator': return 'purple';
      case 'investor': return 'green';
      case 'production': return 'orange';
      default: return 'gray';
    }
  };

  const themeColor = getThemeColor();

  const getPortalPrefix = () => {
    switch (userType) {
      case 'creator': return '/creator';
      case 'investor': return '/investor';
      case 'production': return '/production';
      default: return '';
    }
  };

  const portalPrefix = getPortalPrefix();

  const dashboardMenuItems = {
    creator: [
      { label: 'Overview', href: `${portalPrefix}/dashboard`, icon: Home },
      { label: 'Analytics', href: `${portalPrefix}/analytics`, icon: BarChart3 },
      { label: 'Metrics', href: `${portalPrefix}/metrics`, icon: PieChart },
      { label: 'Activity', href: `${portalPrefix}/activity`, icon: Activity },
    ],
    investor: [
      { label: 'Overview', href: `${portalPrefix}/dashboard`, icon: Home },
      { label: 'Portfolio', href: `${portalPrefix}/portfolio`, icon: Briefcase },
      { label: 'Analytics', href: `${portalPrefix}/analytics`, icon: BarChart3 },
      { label: 'Reports', href: `${portalPrefix}/reports`, icon: FileText },
    ],
    production: [
      { label: 'Overview', href: `${portalPrefix}/dashboard`, icon: Home },
      { label: 'Analytics', href: `${portalPrefix}/analytics`, icon: BarChart3 },
      { label: 'Revenue Reports', href: `${portalPrefix}/revenue`, icon: DollarSign },
      { label: 'Activity', href: `${portalPrefix}/activity`, icon: Activity },
    ]
  };

  const browseMenuItems = {
    creator: [
      { label: 'All Pitches', href: '/browse', icon: Globe },
      { label: 'Trending', href: '/browse?tab=trending', icon: TrendingUp },
      { label: 'New Releases', href: '/browse?tab=new', icon: Star },
      { label: 'By Genre', href: '/browse/genres', icon: Film },
    ],
    investor: [
      { label: 'All Pitches', href: '/browse', icon: Globe },
      { label: 'Trending', href: '/browse?tab=trending', icon: TrendingUp },
      { label: 'New Releases', href: '/browse?tab=new', icon: Star },
      { label: 'Saved Pitches', href: `${portalPrefix}/saved`, icon: Star },
    ],
    production: [
      { label: 'All Pitches', href: '/browse', icon: Globe },
      { label: 'Trending', href: '/browse?tab=trending', icon: TrendingUp },
      { label: 'New Submissions', href: '/browse?tab=new', icon: Star },
      { label: 'Saved Pitches', href: `${portalPrefix}/saved`, icon: Star },
    ]
  };

  const projectMenuItems = {
    creator: [
      { label: 'My Pitches', href: `${portalPrefix}/pitches`, icon: Film },
      { label: 'Create New', href: `${portalPrefix}/pitch/new`, icon: Plus },
      { label: 'Analytics', href: `${portalPrefix}/pitch-analytics`, icon: BarChart3 },
      { label: 'NDAs', href: `${portalPrefix}/ndas`, icon: Shield },
    ],
    investor: [
      { label: 'Invested Projects', href: `${portalPrefix}/investments`, icon: DollarSign },
      { label: 'Saved Pitches', href: `${portalPrefix}/saved`, icon: Star },
      { label: 'NDA Requests', href: `${portalPrefix}/ndas`, icon: Shield },
      { label: 'Watchlist', href: `${portalPrefix}/watchlist`, icon: Eye },
    ],
    production: [
      { label: 'Active Projects', href: `${portalPrefix}/projects`, icon: Briefcase },
      { label: 'In Development', href: `${portalPrefix}/projects/development`, icon: Target },
      { label: 'Pipeline', href: `${portalPrefix}/pipeline`, icon: Layers },
      { label: 'Completed', href: `${portalPrefix}/projects/completed`, icon: CheckCircle },
    ]
  };

  const teamMenuItems = {
    creator: [
      { label: 'Team Overview', href: `${portalPrefix}/team`, icon: Users },
      { label: 'Members', href: `${portalPrefix}/team/members`, icon: UserPlus },
      { label: 'Collaborations', href: `${portalPrefix}/collaborations`, icon: MessageSquare },
    ],
    investor: [
      { label: 'My Network', href: `${portalPrefix}/network`, icon: Users },
      { label: 'Co-Investors', href: `${portalPrefix}/co-investors`, icon: UserPlus },
      { label: 'Production Companies', href: `${portalPrefix}/production-companies`, icon: Building },
      { label: 'Connected Creators', href: `${portalPrefix}/creators`, icon: Shield },
    ],
    production: [
      { label: 'Team Members', href: `${portalPrefix}/team/members`, icon: Users },
      { label: 'Roles', href: `${portalPrefix}/team/roles`, icon: Shield },
      { label: 'Invite Members', href: `${portalPrefix}/team/invite`, icon: UserPlus },
    ]
  };

  const searchMenuItems = [
    { label: 'Search Pitches', href: '/search?type=pitches', icon: Film },
    { label: 'Search Creators', href: '/search?type=creators', icon: Users },
    { label: 'Advanced Search', href: '/search/advanced', icon: Target },
  ];

  const settingsMenuItems = {
    creator: [
      { label: 'Profile', href: `${portalPrefix}/settings/profile`, icon: UserCircle },
      { label: 'Notifications', href: `${portalPrefix}/settings/notifications`, icon: Bell },
      { label: 'Privacy', href: `${portalPrefix}/settings/privacy`, icon: Shield },
      { label: 'Billing', href: `${portalPrefix}/settings/billing`, icon: CreditCard },
    ],
    investor: [
      { label: 'Profile', href: `${portalPrefix}/settings/profile`, icon: UserCircle },
      { label: 'Notifications', href: `${portalPrefix}/settings/notifications`, icon: Bell },
      { label: 'Privacy', href: `${portalPrefix}/settings/privacy`, icon: Shield },
      { label: 'Billing', href: `${portalPrefix}/settings/billing`, icon: CreditCard },
    ],
    production: [
      { label: 'Company Profile', href: `${portalPrefix}/settings/profile`, icon: UserCircle },
      { label: 'Notifications', href: `${portalPrefix}/settings/notifications`, icon: Bell },
      { label: 'Billing', href: `${portalPrefix}/settings/billing`, icon: CreditCard },
      { label: 'Security', href: `${portalPrefix}/settings/security`, icon: Shield },
    ]
  };

  const getNavigationItemStyle = () => {
    const baseStyle = "flex items-center gap-2 px-3 py-2 text-gray-600 rounded-lg transition-colors cursor-pointer";
    switch (themeColor as 'purple' | 'green' | 'orange' | 'gray') {
      case 'purple':
        return `${baseStyle} hover:text-purple-600 hover:bg-purple-50`;
      case 'green':
        return `${baseStyle} hover:text-green-600 hover:bg-green-50`;
      case 'orange':
        return `${baseStyle} hover:text-orange-600 hover:bg-orange-50`;
      default:
        return `${baseStyle} hover:text-gray-900 hover:bg-gray-100`;
    }
  };

  const navigationItemStyle = getNavigationItemStyle();

  return (
    <header className="bg-white border-b">
      {/* Desktop Navigation - Hidden when content doesn't fit */}
      <div className="hidden xl:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className={`text-2xl font-bold text-${themeColor}-600`}>Pitchey</span>
            </Link>

            {/* Center Navigation with Dropdowns */}
            <nav className="flex items-center gap-1">
              {/* Dashboard Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className={navigationItemStyle}>
                  <Home className="w-4 h-4" />
                  <span>Dashboard</span>
                  <ChevronDown className="w-4 h-4 ml-1" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-white border shadow-lg">
                  <DropdownMenuLabel>Dashboard</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {dashboardMenuItems[userType].map((item) => (
                      <DropdownMenuItem 
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        className="cursor-pointer"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Browse Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className={navigationItemStyle}>
                  <Globe className="w-4 h-4" />
                  <span>Browse</span>
                  <ChevronDown className="w-4 h-4 ml-1" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-white border shadow-lg">
                  <DropdownMenuLabel>Browse Content</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {browseMenuItems[userType].map((item) => (
                      <DropdownMenuItem 
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        className="cursor-pointer"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Projects/Pitches Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className={navigationItemStyle}>
                  <Briefcase className="w-4 h-4" />
                  <span>{userType === 'creator' ? 'Pitches' : 'Projects'}</span>
                  <ChevronDown className="w-4 h-4 ml-1" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-white border shadow-lg">
                  <DropdownMenuLabel>
                    {userType === 'creator' ? 'My Pitches' : 'Projects'}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {projectMenuItems[userType].map((item) => (
                      <DropdownMenuItem 
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        className="cursor-pointer"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Team Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className={navigationItemStyle}>
                  <Users className="w-4 h-4" />
                  <span>{userType === 'investor' ? 'Network' : 'Team'}</span>
                  <ChevronDown className="w-4 h-4 ml-1" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-white border shadow-lg">
                  <DropdownMenuLabel>{userType === 'investor' ? 'Network' : 'Team Management'}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {teamMenuItems[userType].map((item) => (
                      <DropdownMenuItem 
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        className="cursor-pointer"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Search Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className={navigationItemStyle}>
                  <Search className="w-4 h-4" />
                  <span>Search</span>
                  <ChevronDown className="w-4 h-4 ml-1" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-white border shadow-lg">
                  <DropdownMenuLabel>Search Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {searchMenuItems.map((item) => (
                      <DropdownMenuItem 
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        className="cursor-pointer"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Settings Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className={navigationItemStyle}>
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                  <ChevronDown className="w-4 h-4 ml-1" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-white border shadow-lg">
                  <DropdownMenuLabel>Settings</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {settingsMenuItems[userType].map((item) => (
                      <DropdownMenuItem 
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        className="cursor-pointer"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.preventDefault();
                      onLogout();
                    }}
                    className="text-red-600 hover:text-red-700 focus:text-red-600 cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>

            {/* Right Section */}
            <div className="flex items-center gap-4">
              {/* Credits (Creator only) with tooltip */}
              {userType === 'creator' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => navigate(`${portalPrefix}/billing`)}
                        className="flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm hover:bg-purple-200 transition"
                      >
                        <Coins className="w-4 h-4" />
                        <span>{creditBalance} Credits</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="max-w-xs bg-gray-900 text-white p-3 rounded-lg shadow-lg"
                    >
                      <p className="font-semibold mb-1">Pitchey Credits</p>
                      <p className="text-xs text-gray-300">
                        Use credits to boost visibility, access premium analytics,
                        and unlock advanced features. Click to manage your credits.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Shopping Cart/Basket */}
              <button 
                onClick={() => navigate('/cart')}
                className="relative p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                title="Shopping Cart"
              >
                <ShoppingCart className="w-5 h-5" />
                {/* Optional: Add a badge for cart items count */}
                {/*<span className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  3
                </span>*/}
              </button>

              {/* NDA Notifications */}
              <NDANotificationBadge />

              {/* General Notifications */}
              <NotificationBell />

              {/* User Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 cursor-pointer">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <UserCircle className="w-5 h-5 text-purple-600" />
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel>
                    <div>
                      <div className="font-medium">{user?.name || 'User'}</div>
                      <div className="text-sm text-gray-500">{user?.email || ''}</div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(`${portalPrefix}/profile`)}>
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>View Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`${portalPrefix}/settings`)}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.preventDefault();
                      onLogout();
                    }}
                    className="text-red-600 hover:text-red-700 focus:text-red-600 cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation - Shows when desktop navigation doesn't fit */}
      <div className="xl:hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 h-16">
          {/* Logo and Mobile Menu */}
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  aria-label="Open menu"
                >
                  <Menu className="w-6 h-6" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0 bg-white">
                <SheetHeader className="px-6 py-4 border-b bg-white">
                  <SheetTitle className={`text-xl font-bold text-${themeColor}-600`}>Menu</SheetTitle>
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
                          {dashboardMenuItems[userType].map((item) => (
                            <button
                              key={item.href}
                              onClick={() => handleNavigation(item.href)}
                              className={`flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-${themeColor}-600 transition-colors`}
                            >
                              <item.icon className="w-4 h-4" />
                              {item.label}
                            </button>
                          ))}
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
                        <div className="flex flex-col gap-1 pl-6">
                          {browseMenuItems[userType].map((item) => (
                            <button
                              key={item.href}
                              onClick={() => handleNavigation(item.href)}
                              className={`flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-${themeColor}-600 transition-colors`}
                            >
                              <item.icon className="w-4 h-4" />
                              {item.label}
                            </button>
                          ))}
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
                        <div className="flex flex-col gap-1 pl-6">
                          {projectMenuItems[userType].map((item) => (
                            <button
                              key={item.href}
                              onClick={() => handleNavigation(item.href)}
                              className={`flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-${themeColor}-600 transition-colors`}
                            >
                              <item.icon className="w-4 h-4" />
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Team Accordion */}
                    <AccordionItem value="team" className="border-b bg-white">
                      <AccordionTrigger className="hover:no-underline bg-white">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>{userType === 'investor' ? 'Network' : 'Team'}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="bg-white">
                        <div className="flex flex-col gap-1 pl-6">
                          {teamMenuItems[userType].map((item) => (
                            <button
                              key={item.href}
                              onClick={() => handleNavigation(item.href)}
                              className={`flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-${themeColor}-600 transition-colors`}
                            >
                              <item.icon className="w-4 h-4" />
                              {item.label}
                            </button>
                          ))}
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
                        <div className="flex flex-col gap-1 pl-6">
                          {searchMenuItems.map((item) => (
                            <button
                              key={item.href}
                              onClick={() => handleNavigation(item.href)}
                              className={`flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-${themeColor}-600 transition-colors`}
                            >
                              <item.icon className="w-4 h-4" />
                              {item.label}
                            </button>
                          ))}
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
                        <div className="flex flex-col gap-1 pl-6">
                          {settingsMenuItems[userType].map((item) => (
                            <button
                              key={item.href}
                              onClick={() => handleNavigation(item.href)}
                              className={`flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-${themeColor}-600 transition-colors`}
                            >
                              <item.icon className="w-4 h-4" />
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  {/* User Profile Section */}
                  <div className="mt-6 pt-6 border-t">
                    <div className={`flex items-center gap-3 px-2 py-3 bg-${themeColor}-50 rounded-lg`}>
                      <div className={`w-10 h-10 bg-${themeColor}-100 rounded-full flex items-center justify-center`}>
                        <UserCircle className={`w-6 h-6 text-${themeColor}-600`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{user?.name || userType.charAt(0).toUpperCase() + userType.slice(1)}</p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-col gap-1">
                      <button
                        onClick={() => handleNavigation(`${portalPrefix}/profile`)}
                        className={`flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                      >
                        <UserCircle className="w-4 h-4" />
                        View Profile
                      </button>
                      <button
                        onClick={() => handleNavigation(`${portalPrefix}/settings`)}
                        className={`flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
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
            <Link to="/" className="flex items-center gap-2">
              <span className={`text-xl sm:text-2xl font-bold text-${themeColor}-600`}>Pitchey</span>
            </Link>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {/* Shopping Cart */}
            <button 
              onClick={() => navigate('/cart')}
              className="relative p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Shopping Cart"
            >
              <ShoppingCart className="w-5 h-5" />
            </button>
            <NotificationBell />
            <NDANotificationBadge />
          </div>
        </div>
      </div>
    </header>
  );
}

export default EnhancedNavigationShadcn;