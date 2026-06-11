import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { contentService } from '../services/content.service';
import PublicTopNav from '@shared/components/layout/PublicTopNav';

interface AboutContent {
  title?: string;
  opening?: string;
  content?: string[];
  closing?: string;
  author?: string;
  story?: Array<{
    type: string;
    text: string;
  }>;
  founder?: {
    name: string;
    title: string;
  };
  team?: Array<{
    name: string;
    role: string;
    bio?: string;
    image?: string;
  }>;
}

const About: React.FC = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState<AboutContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fallback content - current hardcoded version
  const fallbackContent: AboutContent = {
    title: "About Pitchey",
    opening: "Pitchey was born out of frustration. Mine, mostly.",
    content: [
      "As a producer, I was always looking for the next great idea. But there was nowhere simple, central, or sane for people to pitch their projects. Instead, I'd get pitches sent in every format under the sun: PDFs, Word docs, Google links, pitch decks that looked like they were designed in the early 2000s. Half the time I couldn't even open them properly, and the other half I'd lose them forever in the black hole that is my inbox.",
      "Meanwhile, creators had the opposite problem. No clear place to send their ideas, no way to stand out, and no guarantee their pitch wouldn't just sink to the bottom of someone's email pile.",
      "So I thought: what if there was a single place where pitches actually lived? Organized, searchable, easy to send, easy to read, and impossible to lose. A place built for creators, producers, and investors who all want the same thing: great stories.",
      "That's Pitchey.",
      "Think of it as the world's least annoying inbox, a marketplace where projects and people actually find each other."
    ],
    author: "Karl King, Founder"
  };
  
  // Load content from API with fallback
  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [aboutResult, teamResult] = await Promise.all([
          contentService.getAbout(),
          contentService.getTeam()
        ]);
        
        let mergedContent = { ...fallbackContent };
        
        if (aboutResult.success && aboutResult.data) {
          // Convert API format to component format
          const apiData = aboutResult.data;
          if (apiData.story) {
            // Extract opening from first highlight
            const opening = apiData.story.find((item: any) => item.type === 'highlight')?.text;
            // Extract content from paragraphs and highlights
            const content = apiData.story.map((item: any) => item.text);
            
            mergedContent = {
              ...mergedContent,
              title: apiData.title,
              opening: opening || mergedContent.opening,
              content: content.length > 0 ? content : mergedContent.content,
              author: apiData.founder ? `${apiData.founder.name}, ${apiData.founder.title}` : mergedContent.author
            };
          } else {
            mergedContent = { ...mergedContent, ...apiData };
          }
        }
        
        if (teamResult.success && teamResult.data) {
          mergedContent.team = teamResult.data;
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
  
  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading content...</p>
        </div>
      </div>
    );
  }
  
  // Use loaded content or fallback
  const currentContent = content || fallbackContent;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <PublicTopNav variant="solid" />

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          {error && (
            <div className="mb-6 p-4 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
              {error}
            </div>
          )}
          
          <h1 className="text-4xl font-bold text-gray-900 mb-8">{currentContent.title}</h1>
          
          <div className="prose prose-lg max-w-none text-gray-600 space-y-6">
            {currentContent.opening && (
              <p className="text-xl font-medium text-gray-800">
                {currentContent.opening}
              </p>
            )}
            
            {currentContent.content?.map((paragraph, index) => {
              const isSpecialParagraph = paragraph.includes('That\'s Pitchey') || paragraph === 'That\'s Pitchey.';
              return (
                <p key={index} className={isSpecialParagraph ? 'text-xl font-medium text-gray-800' : ''}>
                  {paragraph}
                </p>
              );
            })}
            
            {currentContent.closing && (
              <p>{currentContent.closing}</p>
            )}
            
            {currentContent.author && (
              <div className="mt-12 pt-8 border-t border-gray-200">
                <p className="text-gray-500 italic">— {currentContent.author}</p>
              </div>
            )}
          </div>
          
          {/* Team Section */}
          {currentContent.team && currentContent.team.length > 0 && (
            <div className="mt-16 pt-8 border-t border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">Our Team</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentContent.team.map((member, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-6">
                    {member.image && (
                      <img 
                        src={member.image} 
                        alt={member.name}
                        className="w-20 h-20 rounded-full mx-auto mb-4 object-cover"
                      />
                    )}
                    <h3 className="text-lg font-semibold text-gray-900 text-center mb-1">{member.name}</h3>
                    <p className="text-purple-600 text-center mb-3">{member.role}</p>
                    {member.bio && (
                      <p className="text-gray-600 text-sm text-center">{member.bio}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => navigate('/register')}
              className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
            >
              Create your account
            </button>
            <button
              onClick={() => navigate('/marketplace')}
              className="px-6 py-3 border border-purple-600 text-purple-600 font-semibold rounded-lg hover:bg-purple-50 transition"
            >
              Browse the marketplace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;