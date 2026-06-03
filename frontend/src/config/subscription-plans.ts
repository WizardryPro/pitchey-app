// Subscription Plans and Credit System Configuration
// Based on client specifications from payment plan document

export interface CreditCost {
  action: string;
  credits: number;
  description: string;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  price: {
    monthly: number;
    annual: number;
  };
  credits: number; // -1 means unlimited
  analytics: 'basic' | 'enhanced' | 'customizable';
  features: string[];
  userType: 'creator' | 'production' | 'exec' | 'watcher';
}

export const CREDIT_COSTS: CreditCost[] = [
  {
    action: 'basic_upload',
    credits: 10,
    description: 'New upload (basic form and 1 picture)'
  },
  {
    action: 'word_doc',
    credits: 3,
    description: 'Word document (script, budget, treatment)'
  },
  {
    action: 'picture_doc',
    credits: 5,
    description: 'Picture document (lookbooks, mood boards)'
  },
  {
    action: 'extra_image',
    credits: 1,
    description: 'Extra image'
  },
  {
    action: 'video_link',
    credits: 1,
    description: 'Video link'
  },
  // 'promoted_pitch' and 'view_pitch' removed: both advertised mechanisms that
  // don't exist in the backend (no search-promotion purchase, no view-charge or
  // license-refund flow). Re-add only when actually implemented + charged.
  {
    action: 'send_message',
    credits: 2,
    description: 'Send message (free for investors, paid for creators)'
  },
  {
    action: 'nda_request',
    credits: 10,
    description: 'NDA request to access pitch details'
  },
  {
    action: 'contact_recipient',
    credits: 1,
    description: 'Start a conversation with a new person (1 credit per person, then free)'
  },
  {
    action: 'ai_extract',
    credits: 5,
    description: 'AI auto-fill pitch from uploaded document'
  }
];

export const CREDIT_PACKAGES = [
  { credits: 1, price: 2.99, currency: 'EUR' },
  { credits: 5, price: 8.99, currency: 'EUR' },
  { credits: 10, price: 14.99, currency: 'EUR' },
  { credits: 30, price: 29.99, currency: 'EUR', bonus: 10, description: 'Buy 20 get 10 free' }
];

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  // Creator Tiers
  {
    id: 'creator',
    name: 'Creator',
    price: { monthly: 19.99, annual: 199 },
    credits: 10,
    analytics: 'basic',
    features: [
      '10 Creator Credits per month',
      'Basic Analytics',
      'Profile views, pitch views, search appearances',
    ],
    userType: 'creator'
  },
  {
    id: 'creator_plus',
    name: 'Creator+',
    price: { monthly: 29.99, annual: 299 },
    credits: 30,
    analytics: 'enhanced',
    features: [
      '30 Creator Credits per month',
      'Enhanced Analytics',
      'Who viewed, time spent',
    ],
    userType: 'creator'
  },
  {
    id: 'creator_unlimited',
    name: 'Creator Unlimited',
    price: { monthly: 39.99, annual: 399 },
    credits: -1, // Unlimited
    analytics: 'customizable',
    features: [
      'Unlimited Creator Credits per month',
      'Enhanced Analytics',
    ],
    userType: 'creator'
  },

  // Production Company Tiers
  {
    id: 'production',
    name: 'Production Company',
    price: { monthly: 19.99, annual: 199 },
    credits: 20,
    analytics: 'basic',
    features: [
      '20 Credits per month',
      'Basic Analytics',
      'Profile views, pitch views, search appearances',
    ],
    userType: 'production'
  },
  {
    id: 'production_plus',
    name: 'Production Company+',
    price: { monthly: 29.99, annual: 299 },
    credits: 40,
    analytics: 'enhanced',
    features: [
      '40 Creator Credits per month',
      'Enhanced Analytics',
      'Who viewed, time spent',
    ],
    userType: 'production'
  },
  {
    id: 'production_unlimited',
    name: 'Production Company Unlimited',
    price: { monthly: 39.99, annual: 399 },
    credits: -1, // Unlimited
    analytics: 'customizable',
    features: [
      'Unlimited Creator Credits per month',
      'Enhanced Analytics',
    ],
    userType: 'production'
  },

  // Exec/Studio Tiers
  {
    id: 'exec',
    name: 'Exec/Studio',
    price: { monthly: 39.99, annual: 399 },
    credits: 30,
    analytics: 'basic',
    features: [
      '30 Credits per month',
      'Basic Analytics',
      'Profile views, pitch views, search appearances',
    ],
    userType: 'exec'
  },
  {
    id: 'exec_unlimited',
    name: 'Exec/Studio Unlimited',
    price: { monthly: 49.99, annual: 499 },
    credits: -1, // Unlimited
    analytics: 'customizable',
    features: [
      'Unlimited Credits per month',
      'Enhanced Analytics',
    ],
    userType: 'exec'
  }
];

export const getSubscriptionTiersByUserType = (userType: string): SubscriptionTier[] => {
  if (userType === 'creator') {
    return SUBSCRIPTION_TIERS.filter(tier => tier.userType === 'creator');
  }
  if (userType === 'production') {
    return SUBSCRIPTION_TIERS.filter(tier => tier.userType === 'production');
  }
  if (userType === 'investor') {
    return SUBSCRIPTION_TIERS.filter(tier => tier.userType === 'exec');
  }
  // Watchers have no subscription tiers (audience-only, credits-only).
  if (userType === 'watcher' || userType === 'viewer') {
    return [];
  }
  return SUBSCRIPTION_TIERS;
};

export const getCreditCost = (action: string): number => {
  const cost = CREDIT_COSTS.find(c => c.action === action);
  return cost ? cost.credits : 0;
};

export const getSubscriptionTier = (tierId: string): SubscriptionTier | null => {
  return SUBSCRIPTION_TIERS.find(tier => tier.id === tierId) || null;
};

export const calculateCreditsRemaining = (
  currentCredits: number,
  action: string,
  quantity: number = 1
): number => {
  const cost = getCreditCost(action) * quantity;
  return Math.max(0, currentCredits - cost);
};

export const canAffordAction = (
  currentCredits: number,
  action: string,
  quantity: number = 1,
  isUnlimited: boolean = false
): boolean => {
  if (isUnlimited) return true;
  const cost = getCreditCost(action) * quantity;
  return currentCredits >= cost;
};