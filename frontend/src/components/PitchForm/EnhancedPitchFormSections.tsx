import React from 'react';
import { Textarea } from '@shared/components/ui/textarea';
import { Label } from '@shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Input } from '@shared/components/ui/input';
import { Card, CardContent } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Info, Globe, Palette, BookOpen, Clock, MapPin, Layers, Users, Lock, Plus, Trash2 } from 'lucide-react';

// Development Stage Options
export const DEVELOPMENT_STAGES = [
  { value: 'pitch', label: 'Pitch', description: 'Initial concept stage' },
  { value: 'treatment', label: 'Treatment', description: 'Detailed story outline' },
  { value: 'script', label: 'Script', description: 'Full screenplay/script written' },
  { value: 'semi_packaged', label: 'Semi Packaged', description: 'Some talent/crew attached' },
  { value: 'fully_packaged', label: 'Fully Packaged', description: 'Full creative team attached' },
  { value: 'semi_funded', label: 'Semi Funded', description: 'Partial funding secured' },
  { value: 'fully_funded', label: 'Fully Funded', description: 'Complete funding secured' },
  { value: 'other', label: 'Other', description: 'Specify in notes' },
];

interface WordCounterProps {
  text: string;
  maxWords: number;
  label?: string;
}

export const WordCounter: React.FC<WordCounterProps> = ({ text, maxWords, label }) => {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const percentage = (wordCount / maxWords) * 100;
  const isOver = wordCount > maxWords;

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label || 'Word count'}</span>
      <span className={isOver ? 'text-red-500 font-medium' : 'text-muted-foreground'}>
        {wordCount} / {maxWords} words
      </span>
    </div>
  );
};

// ============ TONE & STYLE SECTION ============
interface ToneAndStyleSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export const ToneAndStyleSection: React.FC<ToneAndStyleSectionProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="tone-and-style" className="flex items-center gap-2">
        <Palette className="w-4 h-4" />
        Tone & Style
        <span className="text-muted-foreground text-sm">(optional)</span>
      </Label>
      <Textarea
        id="tone-and-style"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe the visual style, tone, and mood of your project. How should it look and feel? Reference specific visual styles, cinematography approaches, or artistic influences..."
        className="min-h-[150px]"
      />
      <WordCounter text={value} maxWords={400} />
      <p className="text-xs text-muted-foreground">
        Help investors and producers understand the aesthetic vision of your project.
      </p>
    </div>
  );
};

// ============ COMPS SECTION ============
interface CompsSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export const CompsSection: React.FC<CompsSectionProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="comps" className="flex items-center gap-2">
        <BookOpen className="w-4 h-4" />
        Comparable Titles (Comps)
        <span className="text-muted-foreground text-sm">(optional)</span>
      </Label>
      <Textarea
        id="comps"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="List similar successful projects and explain how your project compares. For example: 'Like Stranger Things meets The Goonies, but set in...' Include box office/viewership data if relevant."
        className="min-h-[150px]"
      />
      <WordCounter text={value} maxWords={400} />
      <p className="text-xs text-muted-foreground">
        Help stakeholders understand your project's market positioning and audience appeal.
      </p>
    </div>
  );
};

// ============ STORY BREAKDOWN SECTION ============
interface StoryBreakdownSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export const StoryBreakdownSection: React.FC<StoryBreakdownSectionProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="story-breakdown" className="flex items-center gap-2">
        <BookOpen className="w-4 h-4" />
        Story Breakdown
        <span className="text-muted-foreground text-sm">(optional)</span>
      </Label>
      <Textarea
        id="story-breakdown"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Provide a detailed breakdown of your story. For series: describe the season arc and key episodes. For films: outline the three acts. Include major plot points, character arcs, and how the story resolves..."
        className="min-h-[300px]"
      />
      <WordCounter text={value} maxWords={2000} />
      <p className="text-xs text-muted-foreground">
        This is your opportunity to showcase the full narrative structure of your project.
      </p>
    </div>
  );
};

// ============ WHY NOW SECTION ============
interface WhyNowSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export const WhyNowSection: React.FC<WhyNowSectionProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="why-now" className="flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Why Now?
        <span className="text-muted-foreground text-sm">(optional)</span>
      </Label>
      <Textarea
        id="why-now"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Why is this the perfect time for this project? Consider current events, cultural trends, market gaps, or technological advances that make your project particularly relevant and timely..."
        className="min-h-[120px]"
      />
      <WordCounter text={value} maxWords={300} />
      <p className="text-xs text-muted-foreground">
        Explain the timeliness and relevance of your project in today's market.
      </p>
    </div>
  );
};

// ============ PRODUCTION LOCATION SECTION ============
interface ProductionLocationSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export const ProductionLocationSection: React.FC<ProductionLocationSectionProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="production-location" className="flex items-center gap-2">
        <MapPin className="w-4 h-4" />
        Production Location
        <span className="text-muted-foreground text-sm">(optional)</span>
      </Label>
      <Textarea
        id="production-location"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Where does this project need to be filmed? Specify locations, any tax incentives, or production benefits of chosen locations..."
        className="min-h-[80px]"
      />
      <WordCounter text={value} maxWords={100} />
    </div>
  );
};

// ============ DEVELOPMENT STAGE SELECT ============
interface DevelopmentStageSelectProps {
  value: string;
  otherValue?: string;
  onChange: (stage: string, other?: string) => void;
}

export const DevelopmentStageSelect: React.FC<DevelopmentStageSelectProps> = ({ 
  value, 
  otherValue, 
  onChange 
}) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="development-stage" className="flex items-center gap-2">
        <Layers className="w-4 h-4" />
        Development Stage
        <span className="text-red-500">*</span>
      </Label>
      <Select value={value} onValueChange={(val) => onChange(val, val === 'other' ? otherValue : undefined)}>
        <SelectTrigger id="development-stage">
          <SelectValue placeholder="Select current development stage" />
        </SelectTrigger>
        <SelectContent>
          {DEVELOPMENT_STAGES.map((stage) => (
            <SelectItem key={stage.value} value={stage.value}>
              <div className="flex flex-col">
                <span>{stage.label}</span>
                <span className="text-xs text-muted-foreground">{stage.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {value === 'other' && (
        <Input
          placeholder="Please specify development stage"
          value={otherValue || ''}
          onChange={(e) => onChange('other', e.target.value)}
          className="mt-2"
        />
      )}
    </div>
  );
};

// ============ CREATIVE ATTACHMENTS MANAGER ============
export interface CreativeAttachment {
  id: string;
  name: string;
  role: string;
  bio: string;
  imdbLink?: string;
  websiteLink?: string;
}

interface CreativeAttachmentsManagerProps {
  attachments: CreativeAttachment[];
  onChange: (attachments: CreativeAttachment[]) => void;
}

export const CreativeAttachmentsManager: React.FC<CreativeAttachmentsManagerProps> = ({ 
  attachments, 
  onChange 
}) => {
  const addAttachment = () => {
    const newAttachment: CreativeAttachment = {
      id: Date.now().toString(),
      name: '',
      role: '',
      bio: '',
    };
    onChange([...attachments, newAttachment]);
  };

  const updateAttachment = (id: string, field: keyof CreativeAttachment, value: string) => {
    onChange(attachments.map(att => 
      att.id === id ? { ...att, [field]: value } : att
    ));
  };

  const removeAttachment = (id: string) => {
    onChange(attachments.filter(att => att.id !== id));
  };

  return (
    <div className="space-y-4">
      <Label className="flex items-center gap-2">
        <Users className="w-4 h-4" />
        Creative Team Attachments
        <span className="text-muted-foreground text-sm">(optional)</span>
      </Label>
      
      {attachments.map((attachment, index) => (
        <Card key={attachment.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <h4 className="text-sm font-medium">Team Member {index + 1}</h4>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Remove
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`name-${attachment.id}`}>Name</Label>
                <Input
                  id={`name-${attachment.id}`}
                  value={attachment.name}
                  onChange={(e) => updateAttachment(attachment.id, 'name', e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              
              <div>
                <Label htmlFor={`role-${attachment.id}`}>Role</Label>
                <Input
                  id={`role-${attachment.id}`}
                  value={attachment.role}
                  onChange={(e) => updateAttachment(attachment.id, 'role', e.target.value)}
                  placeholder="Director, Writer, Producer..."
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor={`bio-${attachment.id}`}>Bio</Label>
              <Textarea
                id={`bio-${attachment.id}`}
                value={attachment.bio}
                onChange={(e) => updateAttachment(attachment.id, 'bio', e.target.value)}
                placeholder="Brief bio and relevant experience..."
                className="min-h-[100px]"
              />
              <WordCounter text={attachment.bio} maxWords={400} label="Bio" />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`imdb-${attachment.id}`}>IMDb Link (optional)</Label>
                <Input
                  id={`imdb-${attachment.id}`}
                  value={attachment.imdbLink || ''}
                  onChange={(e) => updateAttachment(attachment.id, 'imdbLink', e.target.value)}
                  placeholder="https://imdb.com/name/..."
                  type="url"
                />
              </div>
              
              <div>
                <Label htmlFor={`website-${attachment.id}`}>Website (optional)</Label>
                <Input
                  id={`website-${attachment.id}`}
                  value={attachment.websiteLink || ''}
                  onChange={(e) => updateAttachment(attachment.id, 'websiteLink', e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      <Button
        type="button"
        onClick={addAttachment}
        variant="outline"
        className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
      >
        <Plus className="h-4 w-4 mr-1" />
        Add Creative Team Member
      </Button>
    </div>
  );
};

// ============ VIDEO URL WITH PASSWORD SECTION ============
interface VideoUrlSectionProps {
  videoUrl: string;
  videoPassword?: string;
  videoPlatform?: string;
  onChange: (data: { videoUrl?: string; videoPassword?: string; videoPlatform?: string }) => void;
}

export const VideoUrlSection: React.FC<VideoUrlSectionProps> = ({ 
  videoUrl, 
  videoPassword, 
  videoPlatform, 
  onChange 
}) => {
  // Detect platform from URL
  const detectPlatform = (url: string): string => {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname === 'youtu.be') return 'youtube';
      if (hostname === 'vimeo.com' || hostname === 'www.vimeo.com') return 'vimeo';
    } catch {
      // Invalid URL, fall through
    }
    return 'other';
  };

  const handleUrlChange = (url: string) => {
    const platform = detectPlatform(url);
    onChange({ videoUrl: url, videoPlatform: platform });
  };

  return (
    <div className="space-y-3">
      <Label htmlFor="video-url" className="flex items-center gap-2">
        <Globe className="w-4 h-4" />
        Video Link
        <span className="text-muted-foreground text-sm">(optional)</span>
      </Label>
      
      <Input
        id="video-url"
        type="url"
        value={videoUrl}
        onChange={(e) => handleUrlChange(e.target.value)}
        placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
      />
      
      {videoUrl && (
        <div className="space-y-2 p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <Label htmlFor="video-password">Video Password (if protected)</Label>
          </div>
          <Input
            id="video-password"
            type="text"
            value={videoPassword || ''}
            onChange={(e) => onChange({ videoPassword: e.target.value })}
            placeholder="Enter password if video is protected"
          />
          <p className="text-xs text-muted-foreground">
            Platform detected: {videoPlatform || 'unknown'}
          </p>
        </div>
      )}
    </div>
  );
};