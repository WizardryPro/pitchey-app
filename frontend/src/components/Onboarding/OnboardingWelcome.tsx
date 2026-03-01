import React from 'react';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';

interface OnboardingWelcomeProps {
  userType: 'creator' | 'investor' | 'production';
  userName: string;
  onGetStarted: () => void;
  onSkip: () => void;
}

export const OnboardingWelcome: React.FC<OnboardingWelcomeProps> = ({
  userType,
  userName,
  onGetStarted,
  onSkip
}) => {
  const getWelcomeContent = () => {
    switch (userType) {
      case 'creator':
        return {
          title: 'Welcome to Your Creative Journey!',
          subtitle: `Hi ${userName}, you're all set to share your movie ideas with the world`,
          description: 'Pitchey connects creative storytellers like you with investors and production companies looking for their next big project.',
          icon: '🎬',
          color: 'blue',
          benefits: [
            { icon: '🎯', title: 'Pitch Your Projects', description: 'Create compelling pitches that attract industry attention' },
            { icon: '💼', title: 'Connect with Investors', description: 'Find funding for your creative projects' },
            { icon: '🔒', title: 'Protect Your IP', description: 'Built-in NDAs keep your ideas safe' },
            { icon: '📊', title: 'Track Performance', description: 'Monitor interest and engagement metrics' }
          ],
          nextSteps: [
            'Complete your creator profile',
            'Create your first movie pitch',
            'Set up IP protection with NDAs',
            'Explore the creator dashboard'
          ]
        };
      
      case 'investor':
        return {
          title: 'Welcome to Your Investment Hub!',
          subtitle: `Hi ${userName}, you're ready to discover amazing movie projects`,
          description: 'Pitchey gives you access to vetted movie projects and creators, with tools to evaluate and manage your entertainment investments.',
          icon: '💼',
          color: 'green',
          benefits: [
            { icon: '🔍', title: 'Discover Projects', description: 'Browse curated movie pitches and find hidden gems' },
            { icon: '📈', title: 'Smart Analytics', description: 'Data-driven insights for investment decisions' },
            { icon: '🤝', title: 'Direct Access', description: 'Connect directly with creators and production teams' },
            { icon: '📋', title: 'Portfolio Management', description: 'Track and manage your entertainment investments' }
          ],
          nextSteps: [
            'Set up your investment criteria',
            'Browse available movie projects',
            'Learn about the NDA process',
            'Set up your investment portfolio'
          ]
        };
      
      case 'production':
        return {
          title: 'Welcome to Your Production Hub!',
          subtitle: `Hi ${userName}, you're ready to discover your next production`,
          description: 'Pitchey streamlines your project discovery and development process, connecting you with talented creators and strategic investors.',
          icon: '🎭',
          color: 'purple',
          benefits: [
            { icon: '📥', title: 'Manage Submissions', description: 'Organized system for reviewing project submissions' },
            { icon: '⚡', title: 'Pipeline Management', description: 'Track projects from development to distribution' },
            { icon: '👥', title: 'Team Collaboration', description: 'Coordinate with your production team efficiently' },
            { icon: '🎯', title: 'Find Perfect Projects', description: 'Advanced filtering to match your production goals' }
          ],
          nextSteps: [
            'Set up your company profile',
            'Configure submission criteria',
            'Learn collaboration tools',
            'Explore pipeline management'
          ]
        };
      
      default:
        return null;
    }
  };

  const content = getWelcomeContent();
  if (!content) return null;

  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      icon: 'bg-blue-100',
      text: 'text-blue-900',
      button: 'bg-blue-600 hover:bg-blue-700'
    },
    green: {
      bg: 'bg-green-50',
      icon: 'bg-green-100',
      text: 'text-green-900',
      button: 'bg-green-600 hover:bg-green-700'
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'bg-purple-100',
      text: 'text-purple-900',
      button: 'bg-purple-600 hover:bg-purple-700'
    }
  };

  const colors = colorClasses[content.color as keyof typeof colorClasses] || colorClasses.blue;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className={`${colors.bg} rounded-lg p-8 mb-6`}>
        <div className="text-center">
          <div className={`w-20 h-20 ${colors.icon} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <span className="text-3xl">{content.icon}</span>
          </div>
          
          <h1 className={`text-3xl font-bold ${colors.text} mb-2`}>
            {content.title}
          </h1>
          
          <p className={`text-lg ${colors.text} opacity-80 mb-4`}>
            {content.subtitle}
          </p>
          
          <p className="text-gray-700 max-w-2xl mx-auto">
            {content.description}
          </p>
        </div>
      </div>

      {/* Benefits Grid */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {content.benefits.map((benefit, index) => (
          <Card key={index} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start space-x-3">
              <div className="text-2xl">{benefit.icon}</div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{benefit.title}</h3>
                <p className="text-sm text-gray-600">{benefit.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* What's Next Section */}
      <Card className="p-6 mb-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              What We'll Cover
            </h3>
            <ul className="space-y-2">
              {content.nextSteps.map((step, index) => (
                <li key={index} className="flex items-start text-sm text-gray-700">
                  <span className="inline-block w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="flex flex-col justify-center">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Estimated Time</h4>
              <p className="text-2xl font-bold text-blue-600 mb-1">5-10 min</p>
              <p className="text-sm text-gray-600">You can skip or pause anytime</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center">
        <Button 
          onClick={onGetStarted}
          size="lg"
          className={`px-8 ${colors.button} text-white`}
        >
          Let's Get Started!
        </Button>
        
        <Button 
          variant="outline" 
          onClick={onSkip}
          size="lg"
          className="px-8"
        >
          Skip Onboarding
        </Button>
      </div>

      {/* Additional Info */}
      <div className="text-center mt-6">
        <p className="text-sm text-gray-500">
          You can always access this tutorial later from your dashboard settings
        </p>
      </div>
    </div>
  );
};