import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Camera, Mail, Phone, MapPin, Globe, 
  Users, Calendar, Save, X, Upload, Star,
  Twitter, Linkedin, Instagram, Youtube, Award
} from 'lucide-react';
import DashboardHeader from '../../../components/DashboardHeader';
import { useBetterAuthStore } from '../../../store/betterAuthStore';
import { getDashboardRoute } from '../../../utils/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { toast } from 'react-hot-toast';

interface CompanyProfileData {
  companyName: string;
  companyType: string;
  founded: string;
  employees: string;
  headquarters: string;
  website: string;
  description: string;
  specialties: string[];
  contactEmail: string;
  contactPhone: string;
  businessLicense: string;
  taxId: string;
  socialLinks: {
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
  };
  logo?: string;
  coverImage?: string;
  certifications: string[];
  awards: string[];
}

export default function ProductionSettingsProfile() {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<CompanyProfileData>({
    companyName: user?.companyName || '',
    companyType: 'Production Company',
    founded: '',
    employees: '',
    headquarters: '',
    website: '',
    description: user?.bio || '',
    specialties: [],
    contactEmail: user?.email || '',
    contactPhone: '',
    businessLicense: '',
    taxId: '',
    socialLinks: {},
    certifications: [],
    awards: []
  });

  const handleInputChange = (field: keyof CompanyProfileData | string, value: string | string[]) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setProfileData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof CompanyProfileData] as any),
          [child]: value
        }
      }));
    } else {
      setProfileData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleArrayChange = (field: keyof CompanyProfileData, index: number, value: string) => {
    const currentArray = profileData[field] as string[];
    const newArray = [...currentArray];
    newArray[index] = value;
    setProfileData(prev => ({
      ...prev,
      [field]: newArray
    }));
  };

  const addArrayItem = (field: keyof CompanyProfileData) => {
    const currentArray = (profileData[field] as string[]) || [];
    setProfileData(prev => ({
      ...prev,
      [field]: [...currentArray, '']
    }));
  };

  const removeArrayItem = (field: keyof CompanyProfileData, index: number) => {
    const currentArray = profileData[field] as string[];
    const newArray = currentArray.filter((_, i) => i !== index);
    setProfileData(prev => ({
      ...prev,
      [field]: newArray
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: profileData.companyName,
          bio: profileData.description,
          companyName: profileData.companyName,
          website: profileData.website,
          location: profileData.headquarters,
          phone: profileData.contactPhone
        })
      });
      if (!response.ok) throw new Error('Save failed');
      toast.success('Company profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update company profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (type: 'logo' | 'cover') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setProfileData(prev => ({
            ...prev,
            [type === 'logo' ? 'logo' : 'coverImage']: e.target?.result as string
          }));
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        user={user}
        userType="production"
        title="Company Profile Settings"
        onLogout={logout}
        useEnhancedNav={true}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Company Profile Settings</h1>
          <p className="mt-2 text-gray-600">Manage your production company's public profile and information</p>
        </div>

        <div className="space-y-6">
          {/* Company Images */}
          <Card>
            <CardHeader>
              <CardTitle>Company Branding</CardTitle>
              <CardDescription>Upload your company logo and cover image</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Cover Image */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Cover Image</label>
                <div className="relative h-32 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg overflow-hidden">
                  {profileData.coverImage && (
                    <img src={profileData.coverImage} alt="Cover" className="w-full h-full object-cover" />
                  )}
                  <button
                    onClick={() => handleImageUpload('cover')}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <Camera className="w-6 h-6 mr-2" />
                    Change Cover Image
                  </button>
                </div>
              </div>

              {/* Logo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
                <div className="flex items-center space-x-4">
                  <div className="relative w-20 h-20 rounded-lg border-2 border-gray-300 overflow-hidden">
                    {profileData.logo ? (
                      <img src={profileData.logo} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                        {profileData.companyName[0]}
                      </div>
                    )}
                    <button
                      onClick={() => handleImageUpload('logo')}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 hover:opacity-100 transition-opacity"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">Recommended size: 200x200px</p>
                    <p className="text-xs text-gray-500">JPG, PNG or GIF. Max size 2MB</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>Basic information about your production company</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                  <input
                    type="text"
                    value={profileData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Type</label>
                  <select
                    value={profileData.companyType}
                    onChange={(e) => handleInputChange('companyType', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="Production Company">Production Company</option>
                    <option value="Studio">Studio</option>
                    <option value="Independent Producer">Independent Producer</option>
                    <option value="Post-Production House">Post-Production House</option>
                    <option value="Distribution Company">Distribution Company</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Founded</label>
                  <input
                    type="text"
                    value={profileData.founded}
                    onChange={(e) => handleInputChange('founded', e.target.value)}
                    placeholder="2020"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Number of Employees</label>
                  <select
                    value={profileData.employees}
                    onChange={(e) => handleInputChange('employees', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="1-10">1-10</option>
                    <option value="11-25">11-25</option>
                    <option value="26-50">26-50</option>
                    <option value="51-100">51-100</option>
                    <option value="101-250">101-250</option>
                    <option value="250+">250+</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Headquarters</label>
                  <input
                    type="text"
                    value={profileData.headquarters}
                    onChange={(e) => handleInputChange('headquarters', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                  <input
                    type="url"
                    value={profileData.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                    placeholder="https://yourcompany.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Description</label>
                <textarea
                  value={profileData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Describe your company's mission, vision, and specialties..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Business contact details and legal information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
                  <input
                    type="email"
                    value={profileData.contactEmail}
                    onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Phone</label>
                  <input
                    type="tel"
                    value={profileData.contactPhone}
                    onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Business License</label>
                  <input
                    type="text"
                    value={profileData.businessLicense}
                    onChange={(e) => handleInputChange('businessLicense', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tax ID</label>
                  <input
                    type="text"
                    value={profileData.taxId}
                    onChange={(e) => handleInputChange('taxId', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Social Media */}
          <Card>
            <CardHeader>
              <CardTitle>Social Media</CardTitle>
              <CardDescription>Connect your social media profiles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Twitter className="inline w-4 h-4 mr-2" />
                    Twitter
                  </label>
                  <input
                    type="text"
                    value={profileData.socialLinks.twitter}
                    onChange={(e) => handleInputChange('socialLinks.twitter', e.target.value)}
                    placeholder="@yourcompany"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Linkedin className="inline w-4 h-4 mr-2" />
                    LinkedIn
                  </label>
                  <input
                    type="text"
                    value={profileData.socialLinks.linkedin}
                    onChange={(e) => handleInputChange('socialLinks.linkedin', e.target.value)}
                    placeholder="linkedin.com/company/yourcompany"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Instagram className="inline w-4 h-4 mr-2" />
                    Instagram
                  </label>
                  <input
                    type="text"
                    value={profileData.socialLinks.instagram}
                    onChange={(e) => handleInputChange('socialLinks.instagram', e.target.value)}
                    placeholder="@yourcompany"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Youtube className="inline w-4 h-4 mr-2" />
                    YouTube
                  </label>
                  <input
                    type="text"
                    value={profileData.socialLinks.youtube}
                    onChange={(e) => handleInputChange('socialLinks.youtube', e.target.value)}
                    placeholder="youtube.com/@yourcompany"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Changes
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => navigate(getDashboardRoute(user?.userType))}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}