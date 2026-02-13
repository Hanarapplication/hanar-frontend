// app/business/plan/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { CheckCircle, X } from 'lucide-react';
import { isAppIOS } from '@/utils/isAppIOS';

type Plan = 'free' | 'starter' | 'growth' | 'premium';

interface BusinessPlan {
  plan: string;
  price_yearly: string;
  max_gallery_images: number;
  max_menu_items: number;
  max_retail_items: number;
  max_car_listings: number;
  max_real_estate_listings?: number;
  allow_social_links: boolean;
  allow_whatsapp: boolean;
  allow_promoted: boolean;
  allow_reviews: boolean;
  allow_qr: boolean;
  follower_notifications_enabled: boolean;
  max_follower_notifications_per_week: number;
  max_follower_notifications_per_day: number;
  min_minutes_between_notifications: number;
  max_area_blasts_per_month: number;
  area_blast_requires_admin_approval: boolean;
  max_blast_radius_miles: number;
}

function normalizePlan(value: string | null | undefined): Plan | null {
  const v = (value ?? '').trim().toLowerCase();
  if (v === 'free' || v === 'starter' || v === 'growth' || v === 'premium') return v as Plan;
  return null;
}

const WEB_ACCOUNT_URL = 'https://hanar.net/dashboard/account';

export default function BusinessPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appIOS = isAppIOS(searchParams);

  const DASHBOARD_ROUTE = '/business-dashboard'; // ✅ your real dashboard route
  const CONTACT_ROUTE = '/contact';
  const PLAN_ORDER: Plan[] = ['free', 'starter', 'growth', 'premium'];
  /** 3-month premium free trial length in days (used for trial_end and for RPC years) */
  const TRIAL_DAYS = 90;
  const TRIAL_YEARS = TRIAL_DAYS / 365;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Plan | null>(null);
  const [plans, setPlans] = useState<BusinessPlan[]>([]);

  const [biz, setBiz] = useState<{
    id: string;
    plan: Plan | null;
    plan_selected_at: string | null;
    trial_end: string | null;
  } | null>(null);

  const redirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        setLoading(true);

        const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        const userId = sessionRes.session?.user?.id;
        if (!userId) {
          router.replace('/login');
          return;
        }

        // Fetch business plans from business_plans table
        const { data: plansData, error: plansError } = await supabase
          .from('business_plans')
          .select('*')
          .order('price_yearly', { ascending: true });

        if (plansError) throw plansError;

        // Fetch current business
        const { data, error } = await supabase
          .from('businesses')
          .select('id, plan, plan_selected_at, trial_end')
          .eq('owner_id', userId)
          .maybeSingle();

        if (error) throw error;

        if (!data?.id) {
          toast.error('No business linked to your account.');
          router.replace(DASHBOARD_ROUTE);
          return;
        }

        const currentPlan = normalizePlan(data.plan);
        const selectedAt = data.plan_selected_at ? String(data.plan_selected_at) : null;
        const trialEnd = data.trial_end ? String(data.trial_end) : null;

        if (isMounted) {
          setPlans((plansData as BusinessPlan[]) || []);
          setBiz({
            id: String(data.id),
            plan: currentPlan,
            plan_selected_at: selectedAt,
            trial_end: trialEnd,
          });
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load plan page');
        router.replace(DASHBOARD_ROUTE);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [router]);

  const showDowngradeToast = () => {
    toast('Downgrading will remove features. Contact us to downgrade.');
  };

  const choosePlan = async (plan: Plan) => {
    if (appIOS) return;
    if (!biz?.id) {
      toast.error('Business not loaded yet. Refresh and try again.');
      return;
    }
    if (biz.plan && PLAN_ORDER.indexOf(plan) < PLAN_ORDER.indexOf(biz.plan)) {
      showDowngradeToast();
      return;
    }

    try {
      setSaving(plan);

      // New businesses or free/starter/growth users selecting premium get 3 months free trial
      const isEligibleForTrial = !biz.plan_selected_at || (biz.plan && ['free', 'starter', 'growth'].includes(biz.plan));
      const isPremiumTrial = isEligibleForTrial && plan === 'premium';
      const years = isPremiumTrial ? TRIAL_YEARS : 1;

      const { error } = await supabase.rpc('apply_business_plan', {
        p_business_id: biz.id,
        p_plan: plan,
        p_years: years,
      });

      if (error) throw error;

      const nowIso = new Date().toISOString();
      const trialEnd = isPremiumTrial
        ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const updatePayload: Record<string, unknown> = {
        plan,
        plan_selected_at: nowIso,
      };
      if (isPremiumTrial) {
        updatePayload.trial_start = nowIso;
        updatePayload.trial_end = trialEnd;
      }

      const { error: confirmError } = await supabase
        .from('businesses')
        .update(updatePayload)
        .eq('id', biz.id);

      if (confirmError) throw confirmError;

      toast.success(
        isPremiumTrial
          ? 'Premium plan activated! Enjoy 3 months free trial.'
          : `Plan applied: ${plan.toUpperCase()}`
      );

      setBiz((prev) =>
        prev
          ? {
              ...prev,
              plan,
              plan_selected_at: nowIso,
              ...(isPremiumTrial ? { trial_end: trialEnd } : {}),
            }
          : prev
      );

      redirectTimerRef.current = window.setTimeout(() => {
        router.replace(DASHBOARD_ROUTE);
      }, 700);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to apply plan');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-lg font-medium text-gray-600 animate-pulse">Loading plans...</div>
      </div>
    );
  }

  const hasSelected = !!biz?.plan_selected_at;
  const currentPlan = biz?.plan;
  const isOnPremiumTrial = currentPlan === 'premium' && !!biz?.trial_end;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const daysRemaining = biz?.trial_end
    ? Math.max(0, Math.ceil((new Date(biz.trial_end).getTime() - Date.now()) / MS_PER_DAY))
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/50 px-3 py-6 sm:px-4 sm:py-8 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 px-4 py-6 sm:px-6 sm:py-8 lg:py-10 text-white">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center">Choose or Upgrade Your Plan</h1>

            <p className="mt-2 sm:mt-3 text-sm sm:text-base text-indigo-100 text-center max-w-2xl mx-auto px-2">
              {!hasSelected
                ? 'Please confirm a plan to continue. (Free is available.)'
                : isOnPremiumTrial
                ? `You are on Premium Free Trial — ${daysRemaining} days remaining. Subscribe to keep your business on Premium.`
                : currentPlan === 'free'
                ? 'You are on Free. Upgrade anytime for more features.'
                : `You are on ${String(currentPlan).toUpperCase()}. You can upgrade anytime.`}
            </p>
            {isOnPremiumTrial && (
              <p className="mt-3 text-sm font-medium text-amber-200 text-center max-w-2xl mx-auto px-2">
                Want to keep your business on Premium and unlock all features? Subscribe now to continue.
              </p>
            )}
            {(!hasSelected || currentPlan === 'free' || currentPlan === 'starter' || currentPlan === 'growth') && !isOnPremiumTrial && (
              <p className="mt-3 text-sm font-medium text-amber-200 text-center max-w-2xl mx-auto px-2">
                Upgrade to Premium for a 3-month free trial!
              </p>
            )}
          </div>

          <div className="p-4 sm:p-6 md:p-8 lg:p-10">
            {appIOS ? (
              <div className="text-center py-8 sm:py-12 max-w-md mx-auto">
                <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 mb-6">
                  Plan upgrades are managed on the web.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(WEB_ACCOUNT_URL);
                      toast.success('Link copied. Open in your browser to manage your plan.');
                    } catch {
                      window.open(WEB_ACCOUNT_URL, '_blank');
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                >
                  Open in browser
                </button>
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-10 text-gray-600">Loading plans...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                {plans.map((planData) => {
                  const planName = planData.plan as Plan;
                  const isCurrentPlan = currentPlan === planName;
                  const isPopular = planName === 'growth'; // Growth is marked as popular
                  const currentPlanIndex = currentPlan ? PLAN_ORDER.indexOf(currentPlan as Plan) : -1;
                  const isDowngrade =
                    currentPlanIndex >= 0 &&
                    PLAN_ORDER.indexOf(planName) < currentPlanIndex;
                  const showPremiumTrial = planName === 'premium' && (!hasSelected || !currentPlan || currentPlan === 'free' || currentPlan === 'starter' || currentPlan === 'growth');
                  const isPremiumTrialCard = planName === 'premium' && (showPremiumTrial || isOnPremiumTrial);
                  
                  return (
                    <PlanCard
                      key={planData.plan}
                      title={planData.plan.charAt(0).toUpperCase() + planData.plan.slice(1)}
                      price={
                        showPremiumTrial
                          ? `3 months free trial, then $${planData.price_yearly}/year`
                          : isOnPremiumTrial
                          ? `${daysRemaining} days left in trial`
                          : `$${planData.price_yearly} / year`
                      }
                      trialNote={
                        showPremiumTrial
                          ? 'No automatic renewal after 3 months. You\'ll receive email and text reminders before your trial ends so you can renew to keep your business.'
                          : undefined
                      }
                      planData={planData}
                      isPopular={isPopular}
                      isCurrent={isCurrentPlan}
                      isDowngrade={isDowngrade}
                      isFreeTrial={isPremiumTrialCard}
                      disabled={saving !== null}
                      loading={saving === planName}
                      onClick={() => choosePlan(planName)}
                    />
                  );
                })}
              </div>
            )}

            <div className="mt-6 sm:mt-8 lg:mt-10 text-center">
              <button
                onClick={() => router.replace(DASHBOARD_ROUTE)}
                className="px-6 sm:px-8 py-2.5 sm:py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors duration-200 text-sm sm:text-base"
              >
                Back to Dashboard
              </button>
            </div>

            <div className="mt-4 sm:mt-6 text-center text-xs sm:text-sm text-gray-600">
              <span className="font-semibold">Current:</span>{' '}
              {hasSelected
                ? isOnPremiumTrial
                  ? 'PREMIUM FREE TRIAL'
                  : currentPlan
                  ? currentPlan.toUpperCase()
                  : 'UNKNOWN'
                : 'NOT CONFIRMED'}
            </div>
          </div>
        </div>

        <p className="mt-4 sm:mt-6 text-center text-xs sm:text-sm text-gray-500 px-4">
          You can upgrade your plan anytime from this page. Downgrades require contacting support.
        </p>
      </div>
    </div>
  );
}

function PlanCard({
  title,
  price,
  trialNote,
  planData,
  isPopular = false,
  isCurrent = false,
  isDowngrade = false,
  isFreeTrial = false,
  disabled,
  loading,
  onClick,
}: {
  title: string;
  price: string;
  trialNote?: string;
  planData: BusinessPlan;
  isPopular?: boolean;
  isCurrent?: boolean;
  isDowngrade?: boolean;
  isFreeTrial?: boolean;
  disabled: boolean;
  loading: boolean;
  onClick: () => void | Promise<void>;
}) {
  // Car and real estate: free 0, starter 5, growth 10, premium 999 (same as DB)
  const carListingsValue = planData.max_car_listings >= 9999 ? 'Unlimited' : (planData.plan.toLowerCase() === 'starter' && planData.max_car_listings < 5 ? 5 : planData.max_car_listings);
  const maxRealEstate = planData.max_real_estate_listings ?? planData.max_car_listings;
  const realEstateListingsValue = maxRealEstate >= 9999 ? 'Unlimited' : (planData.plan.toLowerCase() === 'starter' && maxRealEstate < 5 ? 5 : maxRealEstate);

  const features = [
    { label: 'Gallery Images', value: planData.max_gallery_images === 9999 ? 'Unlimited' : planData.max_gallery_images },
    { label: 'Menu Items', value: planData.max_menu_items === 9999 ? 'Unlimited' : planData.max_menu_items },
    { label: 'Retail Items', value: planData.max_retail_items === 9999 ? 'Unlimited' : planData.max_retail_items },
    { label: 'Dealership Listings', value: carListingsValue },
    { label: 'Real Estate Listings', value: realEstateListingsValue },
    {
      label: 'Follower Notifications / Week',
      value: planData.max_follower_notifications_per_week || 0,
    },
    {
      label: 'Follower Notifications / Day',
      value: planData.max_follower_notifications_per_day || 0,
    },
    {
      label: 'Min Minutes Between Notifications',
      value: planData.min_minutes_between_notifications || 0,
    },
    {
      label: 'Area Blasts / Month',
      value: planData.max_area_blasts_per_month || 0,
    },
    {
      label: 'Max Blast Radius (Miles)',
      value: planData.max_blast_radius_miles || 0,
    },
    {
      label: 'Area Blast Approval',
      value: planData.area_blast_requires_admin_approval ? 'Required' : 'Not Required',
    },
  ];

  // Determine which new features are available based on plan tier
  const planName = planData.plan.toLowerCase();
  const hasCustomWebsite = planName !== 'free';
  const hasCustomerNotifications = planData.follower_notifications_enabled;
  const hasBusinessAnalytics = planName === 'growth' || planName === 'premium';
  const hasAdvertisingPromotion = planName === 'premium';

  const featureFlags = [
    { label: 'Social Media Links', enabled: planData.allow_social_links },
    { label: 'WhatsApp', enabled: planData.allow_whatsapp },
    { label: 'Promoted Listing', enabled: planData.allow_promoted },
    { label: 'QR Code', enabled: planData.allow_qr },
    { label: 'Custom Website Link', enabled: hasCustomWebsite },
    { label: 'Follower Notifications', enabled: hasCustomerNotifications },
    { label: 'Business Analytics', enabled: hasBusinessAnalytics },
    { label: 'Advertising & Promotion', enabled: hasAdvertisingPromotion },
  ];

  return (
    <div
      className={`relative rounded-xl sm:rounded-2xl border-2 p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col h-full transition-all duration-300 ${
        isCurrent
          ? 'border-green-500 shadow-lg sm:shadow-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20'
          : isPopular
          ? 'border-indigo-500 shadow-lg sm:shadow-xl bg-white lg:scale-[1.02]'
          : 'border-gray-200 hover:border-indigo-300 hover:shadow-md bg-white/50 backdrop-blur-sm'
      }`}
    >
      {isPopular && !isFreeTrial && (
        <div className="absolute -top-2.5 sm:-top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-0.5 sm:py-1 rounded-full shadow-lg z-10">
          Most Popular
        </div>
      )}
      {isFreeTrial && (
        <div className="absolute -top-2.5 sm:-top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-0.5 sm:py-1 rounded-full shadow-lg z-10">
          Free Trial
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-2.5 sm:-top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-0.5 sm:py-1 rounded-full shadow-lg z-10">
          Current Plan
        </div>
      )}

      <div className="flex-1">
        <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mt-1 sm:mt-2">{title}</h3>
        <div className="mt-1 sm:mt-2 text-2xl sm:text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">
          {price}
        </div>
        {trialNote && (
          <p className="mt-2 text-xs sm:text-sm text-orange-600 leading-snug">
            {trialNote}
          </p>
        )}

        <div className="mt-4 sm:mt-5 lg:mt-6 space-y-3 sm:space-y-4 flex-grow">
          {/* Limits */}
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2 uppercase tracking-wide">Limits</h4>
            <ul className="space-y-1.5 sm:space-y-2">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-start text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 mr-1.5 sm:mr-2 mt-0.5 flex-shrink-0" />
                  <span className="leading-tight"><strong className="font-semibold">{feature.label}:</strong> <span className="text-gray-600">{feature.value}</span></span>
                </li>
              ))}
            </ul>
          </div>

          {/* Features */}
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2 uppercase tracking-wide">Features</h4>
            <ul className="space-y-1.5 sm:space-y-2">
              {featureFlags.map((flag, idx) => (
                <li key={idx} className="flex items-start text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                  {flag.enabled ? (
                    <>
                      <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 mr-1.5 sm:mr-2 mt-0.5 flex-shrink-0" />
                      <span className="leading-tight">{flag.label}</span>
                    </>
                  ) : (
                    <>
                      <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-300 mr-1.5 sm:mr-2 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-400 line-through leading-tight">{flag.label}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <button
        onClick={onClick}
        disabled={disabled || isCurrent}
        className={`mt-4 sm:mt-6 lg:mt-8 w-full py-2 sm:py-2.5 lg:py-3 px-4 sm:px-5 lg:px-6 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm lg:text-base transition-all duration-200 ${
          disabled || isCurrent
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : isDowngrade
            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-md hover:shadow-lg active:scale-[0.98]'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 mr-2 text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Applying...
          </span>
        ) : isCurrent ? (
          'Current Plan'
        ) : isDowngrade ? (
          'Downgrade (contact us)'
        ) : (
          'Select This Plan'
        )}
      </button>
    </div>
  );
}
