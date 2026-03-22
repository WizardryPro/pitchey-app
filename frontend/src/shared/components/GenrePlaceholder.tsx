import {
  Film, Sword, Laugh, Ghost, Rocket, Castle, Camera,
  Heart, Skull, Music, Crown, Globe, Zap, Mountain,
  Compass, Sparkles, Drama, Clapperboard
} from 'lucide-react';

// Genre → gradient + icon mapping
const GENRE_STYLES: Record<string, { from: string; to: string; icon: typeof Film }> = {
  'action': { from: 'from-red-600', to: 'to-orange-500', icon: Zap },
  'action-comedy': { from: 'from-orange-500', to: 'to-yellow-400', icon: Zap },
  'action-thriller': { from: 'from-red-700', to: 'to-red-500', icon: Zap },
  'adventure': { from: 'from-emerald-600', to: 'to-teal-400', icon: Compass },
  'animation': { from: 'from-pink-500', to: 'to-purple-500', icon: Sparkles },
  'comedy': { from: 'from-yellow-400', to: 'to-orange-400', icon: Laugh },
  'coming-of-age': { from: 'from-amber-400', to: 'to-orange-300', icon: Sparkles },
  'crime drama': { from: 'from-gray-700', to: 'to-gray-500', icon: Skull },
  'crime thriller': { from: 'from-gray-800', to: 'to-red-700', icon: Skull },
  'documentary': { from: 'from-blue-600', to: 'to-cyan-500', icon: Camera },
  'drama': { from: 'from-indigo-600', to: 'to-purple-500', icon: Drama },
  'dramedy': { from: 'from-violet-500', to: 'to-pink-400', icon: Drama },
  'fantasy': { from: 'from-purple-600', to: 'to-indigo-400', icon: Castle },
  'fantasy adventure': { from: 'from-purple-700', to: 'to-emerald-500', icon: Castle },
  'historical drama': { from: 'from-amber-700', to: 'to-yellow-600', icon: Crown },
  'historical fiction': { from: 'from-amber-600', to: 'to-orange-500', icon: Crown },
  'horror': { from: 'from-gray-900', to: 'to-red-800', icon: Ghost },
  'musical': { from: 'from-pink-600', to: 'to-rose-400', icon: Music },
  'musical drama': { from: 'from-rose-600', to: 'to-pink-400', icon: Music },
  'mystery thriller': { from: 'from-slate-700', to: 'to-blue-600', icon: Skull },
  'noir / neo-noir': { from: 'from-gray-900', to: 'to-slate-700', icon: Skull },
  'period piece': { from: 'from-amber-800', to: 'to-yellow-700', icon: Crown },
  'political drama': { from: 'from-slate-600', to: 'to-gray-500', icon: Globe },
  'political thriller': { from: 'from-slate-700', to: 'to-red-600', icon: Globe },
  'psychological thriller': { from: 'from-violet-800', to: 'to-indigo-600', icon: Skull },
  'romance': { from: 'from-rose-500', to: 'to-pink-400', icon: Heart },
  'romantic comedy (rom-com)': { from: 'from-pink-400', to: 'to-rose-300', icon: Heart },
  'romantic drama': { from: 'from-rose-600', to: 'to-purple-500', icon: Heart },
  'satire': { from: 'from-lime-500', to: 'to-green-400', icon: Laugh },
  'science fiction (sci-fi)': { from: 'from-cyan-600', to: 'to-blue-500', icon: Rocket },
  'sci-fi horror': { from: 'from-cyan-800', to: 'to-red-700', icon: Rocket },
  'sports drama': { from: 'from-green-600', to: 'to-emerald-400', icon: Mountain },
  'superhero': { from: 'from-blue-600', to: 'to-red-500', icon: Zap },
  'thriller': { from: 'from-gray-800', to: 'to-slate-600', icon: Skull },
  'true crime': { from: 'from-red-800', to: 'to-gray-700', icon: Camera },
  'war': { from: 'from-olive-700', to: 'to-gray-600', icon: Sword },
  'western': { from: 'from-amber-700', to: 'to-orange-600', icon: Mountain },
};

const DEFAULT_STYLE = { from: 'from-purple-600', to: 'to-indigo-500', icon: Film };

function getGenreStyle(genre?: string) {
  if (!genre) return DEFAULT_STYLE;
  const key = genre.toLowerCase().trim();
  // Try exact match first, then partial
  if (GENRE_STYLES[key]) return GENRE_STYLES[key];
  for (const [pattern, style] of Object.entries(GENRE_STYLES)) {
    if (key.includes(pattern) || pattern.includes(key)) return style;
  }
  return DEFAULT_STYLE;
}

interface GenrePlaceholderProps {
  genre?: string;
  title?: string;
  className?: string;
}

export default function GenrePlaceholder({ genre, title, className = '' }: GenrePlaceholderProps) {
  const style = getGenreStyle(genre);
  const Icon = style.icon;

  return (
    <div className={`w-full h-full bg-gradient-to-br ${style.from} ${style.to} flex flex-col items-center justify-center relative overflow-hidden ${className}`}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-4 left-4"><Clapperboard className="w-8 h-8 text-white" /></div>
        <div className="absolute bottom-6 right-6"><Film className="w-10 h-10 text-white" /></div>
        <div className="absolute top-1/3 right-1/4"><Sparkles className="w-6 h-6 text-white" /></div>
      </div>

      {/* Main icon */}
      <Icon className="w-12 h-12 text-white/80 mb-2 relative z-10" />

      {/* Genre label */}
      {genre && (
        <span className="text-white/70 text-xs font-medium uppercase tracking-wider relative z-10">
          {genre}
        </span>
      )}

      {/* Title overlay at bottom */}
      {title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent px-3 py-2">
          <p className="text-white text-sm font-medium truncate">{title}</p>
        </div>
      )}
    </div>
  );
}

// Export for use in image URL checks
export { getGenreStyle };
