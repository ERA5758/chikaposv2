'use client';

import * as React from 'react';
import { useAuth } from './auth-context';
import { tourSteps } from '@/lib/tour-steps';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';

interface TourGuideContextType {
  startTour: () => void;
  isTourActive: boolean;
  isTourCompleted: boolean;
}

const TourGuideContext = React.createContext<TourGuideContextType | undefined>(undefined);

export function TourGuideProvider({ children }: { children: React.ReactNode }) {
  const { activeStore } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tourStorageKey = activeStore ? `chika_tour_completed_${activeStore.id}` : '';
  
  const [run, setRun] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [isTourCompleted, setIsTourCompleted] = React.useState(true); // Default to true

  React.useEffect(() => {
    if (tourStorageKey) {
        const completed = localStorage.getItem(tourStorageKey) === 'true';
        setIsTourCompleted(completed);
        if (!completed) {
          // If tour hasn't been completed, we can potentially auto-start or show a prompt
        }
    }
  }, [tourStorageKey]);

  const startTour = () => {
    setStepIndex(0);
    setRun(true);
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, step, index, type } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      setRun(false);
      setIsTourCompleted(true);
      if(tourStorageKey) localStorage.setItem(tourStorageKey, 'true');
    } else if (type === 'step:after') {
      const nextIndex = index + 1;
      const nextStep = tourSteps[nextIndex];
      if (nextStep) {
        const currentView = searchParams.get('view') || 'overview';
        if (nextStep.target && typeof nextStep.target === 'string') {
          const targetView = nextStep.target.split('-')[1]; // e.g., from 'sidebar-pos' to 'pos'
           if (targetView && targetView !== currentView) {
             const newParams = new URLSearchParams(searchParams.toString());
             newParams.set('view', targetView);
             router.push(`${pathname}?${newParams.toString()}`);
           }
        }
      }
    }
  };

  const value: TourGuideContextType = {
    startTour,
    isTourActive: run,
    isTourCompleted,
  };

  return (
    <TourGuideContext.Provider value={value}>
      {children}
      <Joyride
        run={run}
        stepIndex={stepIndex}
        steps={tourSteps}
        continuous
        showProgress
        showSkipButton
        callback={handleJoyrideCallback}
        styles={{
          options: {
            zIndex: 10000,
            primaryColor: 'hsl(var(--primary))',
          },
          buttonClose: {
            display: 'none',
          },
        }}
        locale={{
          last: 'Selesai',
          next: 'Lanjutkan',
          skip: 'Lewati',
        }}
      />
    </TourGuideContext.Provider>
  );
}

export function useTourGuide() {
  const context = React.useContext(TourGuideContext);
  if (context === undefined) {
    throw new Error('useTourGuide must be used within a TourGuideProvider');
  }
  return context;
}
