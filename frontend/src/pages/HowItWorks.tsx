import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Film, Users, DollarSign, Rocket, Shield, TrendingUp, CheckCircle, Star, Zap, Target, Award, Loader } from 'lucide-react';
import { contentService } from '../services/content.service';


interface ContentData {
  hero?: {
    title?: string;
    subtitle?: string;
  };
  creatorSteps?: Array<{
    title: string;
    description: string;
    icon?: string;
  }>;
  investorSteps?: Array<{
    title: string;
    description: string;
    icon?: string;
  }>;
  features?: Array<{
    title: string;
    description: string;
    icon?: string;
  }>;
  stats?: Array<{
    value: string;
    label: string;
    color?: string;
  }>;
  metrics?: Array<{
    value: string;
    label: string;
    color?: string;
    description?: string;
  }>;
}

const HowItWorks: React.FC = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState<ContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fallback content - hardcoded data
  const fallbackContent: ContentData = {
    hero: {
      title: "Transform Your Ideas Into Reality",
      subtitle: "Pitchey connects visionary creators with forward-thinking investors through a secure, transparent marketplace designed for the entertainment industry."
    },
    creatorSteps: [
      {
        title: "Create Your Pitch",
        description: "Upload your screenplay, treatment, or concept with compelling visuals and detailed project information.",
        icon: "film"
      },
      {
        title: "Protect Your Work",
        description: "Use our NDA system to protect your intellectual property while sharing with verified investors.",
        icon: "shield"
      },
      {
        title: "Connect with Investors",
        description: "Get discovered by production companies and investors actively seeking new content.",
        icon: "users"
      },
      {
        title: "Secure Funding",
        description: "Negotiate deals, receive funding, and bring your creative vision to life.",
        icon: "dollar-sign"
      }
    ],
    investorSteps: [
      {
        title: "Browse Curated Content",
        description: "Access a diverse marketplace of pre-vetted pitches across all genres and formats.",
        icon: "target"
      },
      {
        title: "Review Under NDA",
        description: "Sign NDAs digitally to access detailed materials and proprietary content securely.",
        icon: "shield"
      },
      {
        title: "Track Performance",
        description: "Monitor pitch engagement, market trends, and investment opportunities in real-time.",
        icon: "trending-up"
      },
      {
        title: "Close Deals",
        description: "Connect directly with creators, negotiate terms, and finalize investments.",
        icon: "award"
      }
    ],
    features: [
      {
        title: "AI-Powered Recommendations",
        description: "Our algorithm recommends the right projects to the right investors based on genre, budget, and track record.",
        icon: "zap"
      },
      {
        title: "Secure Platform",
        description: "Bank-level encryption and comprehensive NDA protection for all shared materials.",
        icon: "shield"
      },
      {
        title: "Quality Control",
        description: "All pitches are reviewed to ensure professional standards and market readiness.",
        icon: "star"
      },
      {
        title: "Direct Communication",
        description: "Built-in messaging and video conferencing for seamless collaboration.",
        icon: "users"
      }
    ],
    stats: [
      { value: "500+", label: "Active Projects", color: "purple" },
      { value: "$50M+", label: "Funded to Date", color: "green" },
      { value: "200+", label: "Success Stories", color: "yellow" },
      { value: "95%", label: "Satisfaction Rate", color: "pink" }
    ]
  };

  // Load content from API with fallback
  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [howItWorksResult, statsResult] = await Promise.all([
          contentService.getHowItWorks(),
          contentService.getStats()
        ]);
        
        let mergedContent = { ...fallbackContent };
        
        if (howItWorksResult.success && howItWorksResult.data) {
          mergedContent = { ...mergedContent, ...howItWorksResult.data };
        }
        
        if (statsResult.success && statsResult.data) {
          // Convert API format to component format
          if (statsResult.data.metrics) {
            mergedContent.stats = statsResult.data.metrics.map((metric: any) => ({
              value: metric.value,
              label: metric.label,
              color: metric.color
            }));
          } else {
            mergedContent.stats = statsResult.data;
          }
        }
        
        setContent(mergedContent);
      } catch (err) {
        console.warn('Error loading content:', err);
        setContent(fallbackContent);
        setError('Failed to load latest content. Showing cached version.');
      } finally {
        setLoading(false);
      }
    };
    
    loadContent();
  }, []);
  
  // Helper function to render icons
  const renderIcon = (iconName: string = 'star', className: string = 'w-8 h-8') => {
    const iconMap: { [key: string]: React.ReactElement } = {
      'film': <Film className={className} />,
      'shield': <Shield className={className} />,
      'users': <Users className={className} />,
      'dollar-sign': <DollarSign className={className} />,
      'target': <Target className={className} />,
      'trending-up': <TrendingUp className={className} />,
      'award': <Award className={className} />,
      'zap': <Zap className={className} />,
      'star': <Star className={className} />
    };
    return iconMap[iconName] || <Star className={className} />;
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-purple-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading content...</p>
        </div>
      </div>
    );
  }
  
  // Use loaded content or fallback
  const currentContent = content || fallbackContent;
  const creatorSteps = currentContent.creatorSteps || [];
  const investorSteps = currentContent.investorSteps || [];
  const features = currentContent.features || [];
  const stats = currentContent.stats || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-purple-50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <img src="/pitchey-logotype.png" alt="Pitchey" className="h-7 w-auto" />
            <h1 className="text-2xl font-bold text-gray-900">How It Works</h1>
          </div>
          <button
            onClick={() => navigate('/register')}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 text-center">
        <div className="max-w-4xl mx-auto px-4">
          {error && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
              {error}
            </div>
          )}
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            {currentContent.hero?.title || "Transform Your Ideas Into Reality"}
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            {currentContent.hero?.subtitle || "Pitchey connects visionary creators with forward-thinking investors through a secure, transparent marketplace designed for the entertainment industry."}
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 hover:shadow-lg transition"
            >
              Start Your Journey
            </button>
            <button
              onClick={() => navigate('/marketplace')}
              className="px-8 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Browse Marketplace
            </button>
          </div>
        </div>
      </section>

      {/* For Creators Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">For Creators</h3>
            <p className="text-gray-600">Turn your screenplay into your next production</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {creatorSteps.map((step, index) => (
              <div key={index} className="relative">
                {index < creatorSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-purple-300 to-transparent z-0" />
                )}
                <div className="bg-white rounded-xl p-6 border border-purple-200 shadow-sm hover:shadow-md hover:border-purple-300 transition relative z-10">
                  <div className="text-purple-600 mb-4">{renderIcon(step.icon, 'w-8 h-8')}</div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h4>
                  <p className="text-gray-500 text-sm">{step.description}</p>
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Investors Section */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">For Investors</h3>
            <p className="text-gray-600">Discover the next blockbuster before anyone else</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {investorSteps.map((step, index) => (
              <div key={index} className="relative">
                {index < investorSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-green-300 to-transparent z-0" />
                )}
                <div className="bg-white rounded-xl p-6 border border-green-200 shadow-sm hover:shadow-md hover:border-green-300 transition relative z-10">
                  <div className="text-green-600 mb-4">{renderIcon(step.icon, 'w-8 h-8')}</div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h4>
                  <p className="text-gray-500 text-sm">{step.description}</p>
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Why Choose Pitchey?</h3>
            <p className="text-gray-600">Industry-leading features for modern content creation</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bg-white rounded-xl p-6 border border-amber-200 shadow-sm hover:shadow-md hover:border-amber-300 transition">
                <div className="text-amber-600 mb-4">{renderIcon(feature.icon, 'w-6 h-6')}</div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h4>
                <p className="text-gray-500 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* CTA Section */}
      <section className="py-20 text-center bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-4xl font-bold mb-6">
            Ready to Start Your Journey?
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            Join thousands of creators and investors transforming the entertainment industry
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-3 bg-white text-purple-700 font-semibold rounded-lg hover:bg-purple-50 hover:shadow-lg transition"
            >
              <Users className="inline w-5 h-5 mr-2" />
              Create Account
            </button>
            <button
              onClick={() => navigate('/marketplace')}
              className="px-8 py-3 bg-white/10 backdrop-blur-md border border-white/30 text-white rounded-lg hover:bg-white/20 transition"
            >
              <Film className="inline w-5 h-5 mr-2" />
              Explore Marketplace
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-500">
            Have questions? Contact us at{' '}
            <a href="mailto:support@pitchey.com" className="text-purple-600 hover:text-purple-700">
              support@pitchey.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HowItWorks;