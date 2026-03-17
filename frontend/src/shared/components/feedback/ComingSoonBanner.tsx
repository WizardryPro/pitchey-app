import { Clock } from 'lucide-react';

interface ComingSoonBannerProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export function ComingSoonBanner({ title, description, icon }: ComingSoonBannerProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
      <div className="flex justify-center mb-3">
        {icon || <Clock className="w-8 h-8 text-blue-500" />}
      </div>
      <h3 className="text-lg font-semibold text-blue-900 mb-1">{title}</h3>
      <p className="text-sm text-blue-700">{description}</p>
    </div>
  );
}
