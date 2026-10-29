import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CalendarDays, 
  Activity, 
  LayoutDashboard, 
  Users, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Sparkles, 
  CheckCircle2, 
  ExternalLink 
} from 'lucide-react';

export interface WalkthroughStep {
  id: string;
  targetId: string;
  title: string;
  category: string;
  description: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tag: string;
  accentColor: string;
}

const TOUR_STEPS: WalkthroughStep[] = [
  {
    id: 'dashboard',
    targetId: 'nav-link-dashboard',
    title: 'Executive Dashboard',
    category: 'Operations Overview',
    description: 'Monitor high-level agricultural performance, view farmer registration trends, crop distributions, and real-time operational feeds.',
    path: '/',
    icon: LayoutDashboard,
    tag: 'Command Center',
    accentColor: '#3b82f6' // Blue
  },
  {
    id: 'harvest-calendar',
    targetId: 'nav-link-harvest-calendar',
    title: 'Harvest Calendar',
    category: 'Yield & Logistics Planning',
    description: 'Anticipate seasonal yields and harvest timelines across all registered farmer plots. Automatically calculates maturity dates by crop variety to coordinate off-taking and storage.',
    path: '/calendar',
    icon: CalendarDays,
    tag: 'Key Feature',
    accentColor: '#10b981' // Emerald
  },
  {
    id: 'monitoring',
    targetId: 'nav-link-monitoring',
    title: 'Monitoring & Evaluation',
    category: 'Field Interventions',
    description: 'Track agronomic field visits, log extension service activities, and evaluate programmatic impact scores across communities with live outcome metrics.',
    path: '/monitoring',
    icon: Activity,
    tag: 'Key Feature',
    accentColor: '#f59e0b' // Amber
  },
  {
    id: 'farmers',
    targetId: 'nav-link-farmers',
    title: 'Farmers Registry',
    category: 'Producer Management',
    description: 'Access complete farmer records, biometric IDs, geographic farm coordinates, and batch export official farmer documents and verification certificates.',
    path: '/farmers',
    icon: Users,
    tag: 'Core Registry',
    accentColor: '#8b5cf6' // Violet
  }
];

interface NavigationWalkthroughProps {
  userId?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function NavigationWalkthrough({
  userId,
  isOpen: controlledIsOpen,
  onClose
}: NavigationWalkthroughProps) {
  const navigate = useNavigate();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const isControlled = controlledIsOpen !== undefined;
  const isVisible = isControlled ? controlledIsOpen : internalIsOpen;

  const storageKey = useMemo(() => {
    return userId ? `agri_walkthrough_completed_${userId}` : 'agri_walkthrough_completed';
  }, [userId]);

  // First-login automated trigger
  useEffect(() => {
    // Listen for custom manual open events
    const handleManualOpen = () => {
      setCurrentStepIndex(0);
      if (isControlled) {
        // If controlled, let parent know or open internally
      } else {
        setInternalIsOpen(true);
      }
    };
    window.addEventListener('open-navigation-walkthrough', handleManualOpen);

    if (!isControlled) {
      try {
        const hasSeen = localStorage.getItem(storageKey);
        if (!hasSeen) {
          // Delay briefly to allow DOM to render and settle
          const timer = setTimeout(() => {
            setInternalIsOpen(true);
          }, 850);
          return () => {
            clearTimeout(timer);
            window.removeEventListener('open-navigation-walkthrough', handleManualOpen);
          };
        }
      } catch (err) {
        console.warn('Unable to access localStorage for walkthrough state:', err);
      }
    }

    return () => {
      window.removeEventListener('open-navigation-walkthrough', handleManualOpen);
    };
  }, [storageKey, isControlled]);

  const currentStep = TOUR_STEPS[currentStepIndex];

  // Measure and track target element position
  const updateTargetPosition = useCallback(() => {
    if (!isVisible || !currentStep) return;

    const el = document.getElementById(currentStep.targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [isVisible, currentStep]);

  useEffect(() => {
    if (isVisible) {
      updateTargetPosition();
      const handleResize = () => updateTargetPosition();
      const handleScroll = () => updateTargetPosition();

      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [isVisible, updateTargetPosition, currentStepIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, currentStepIndex]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(storageKey, new Date().toISOString());
    } catch (e) {
      console.warn('Storage save failed:', e);
    }

    if (isControlled && onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleJumpToPage = (path: string) => {
    navigate(path);
  };

  if (!isVisible) return null;

  // Calculate popover positioning relative to target
  const getPopoverStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 60
      };
    }

    const cardWidth = 380;
    const cardHeight = 280;
    const padding = 16;

    // Default: position to the right of the sidebar item
    let left = targetRect.right + padding;
    let top = targetRect.top - 12;

    // Check right edge collision
    if (left + cardWidth > window.innerWidth) {
      // If cramped, position below or center
      if (window.innerWidth < 640) {
        left = 16;
        top = Math.min(targetRect.bottom + 16, window.innerHeight - cardHeight - 16);
      } else {
        left = window.innerWidth - cardWidth - padding;
      }
    }

    // Check vertical bounds
    if (top + cardHeight > window.innerHeight) {
      top = Math.max(padding, window.innerHeight - cardHeight - padding);
    }
    if (top < padding) {
      top = padding;
    }

    return {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 60
    };
  };

  const StepIcon = currentStep.icon;

  return (
    <div id="walkthrough-overlay-container" className="fixed inset-0 z-50 pointer-events-auto">
      {/* Dimmed backdrop */}
      <motion.div
        id="walkthrough-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleDismiss}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
      />

      {/* Target Element Spotlight Highlight */}
      {targetRect && (
        <motion.div
          id="walkthrough-spotlight"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{
            opacity: 1,
            scale: 1,
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed pointer-events-none z-50 rounded-xl border-2 shadow-2xl transition-all duration-300"
          style={{
            borderColor: currentStep.accentColor,
            boxShadow: `0 0 25px ${currentStep.accentColor}55, inset 0 0 10px ${currentStep.accentColor}33`,
            backgroundColor: `${currentStep.accentColor}15`
          }}
        >
          {/* Subtle pulsating beacon */}
          <span 
            className="absolute -top-1 -right-1 flex h-3 w-3"
          >
            <span 
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: currentStep.accentColor }}
            />
            <span 
              className="relative inline-flex rounded-full h-3 w-3"
              style={{ backgroundColor: currentStep.accentColor }}
            />
          </span>
        </motion.div>
      )}

      {/* Floating Tour Popover Card */}
      <motion.div
        id="walkthrough-popover-card"
        style={getPopoverStyle()}
        initial={{ opacity: 0, y: 10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="w-[calc(100vw-32px)] max-w-[380px] bg-slate-900/95 border border-white/15 rounded-2xl shadow-2xl p-5 text-slate-100 backdrop-blur-xl pointer-events-auto"
      >
        {/* Header with Category & Step Dots */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span 
              className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
              style={{
                backgroundColor: `${currentStep.accentColor}20`,
                borderColor: `${currentStep.accentColor}40`,
                color: currentStep.accentColor
              }}
            >
              {currentStep.tag}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Step {currentStepIndex + 1} of {TOUR_STEPS.length}
            </span>
          </div>

          <button
            id="walkthrough-btn-close"
            onClick={handleDismiss}
            title="Close walkthrough"
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Title and Icon */}
        <div className="flex items-start gap-3 mb-2.5">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md border border-white/10"
            style={{ 
              backgroundColor: `${currentStep.accentColor}25`,
              color: currentStep.accentColor 
            }}
          >
            <StepIcon size={20} />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-100 leading-tight">
              {currentStep.title}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              {currentStep.category}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs leading-relaxed text-slate-300 mb-4 min-h-[50px]">
          {currentStep.description}
        </p>

        {/* Quick View Button for this specific area */}
        <div className="mb-4">
          <button
            id="walkthrough-btn-jump-page"
            type="button"
            onClick={() => handleJumpToPage(currentStep.path)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-300 hover:text-white font-medium transition-colors"
          >
            <span>Open {currentStep.title} page</span>
            <ExternalLink size={12} className="opacity-70" />
          </button>
        </div>

        {/* Step Progress Indicators */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((step, idx) => (
              <button
                key={step.id}
                id={`walkthrough-step-dot-${idx}`}
                onClick={() => setCurrentStepIndex(idx)}
                aria-label={`Go to step ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStepIndex
                    ? 'w-6'
                    : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
                style={{
                  backgroundColor: idx === currentStepIndex ? currentStep.accentColor : undefined
                }}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {currentStepIndex > 0 ? (
              <button
                id="walkthrough-btn-prev"
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 font-medium rounded-lg hover:bg-white/5 transition-colors"
              >
                <ChevronLeft size={14} />
                <span>Back</span>
              </button>
            ) : (
              <button
                id="walkthrough-btn-skip"
                type="button"
                onClick={handleDismiss}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 font-medium rounded-lg hover:bg-white/5 transition-colors"
              >
                Skip
              </button>
            )}

            <button
              id="walkthrough-btn-next"
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded-lg shadow-md transition-transform active:scale-95"
              style={{ backgroundColor: currentStep.accentColor }}
            >
              {currentStepIndex === TOUR_STEPS.length - 1 ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>Done</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
