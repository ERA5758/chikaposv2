
'use client';

import * as React from 'react';
import { useAuth } from './auth-context';
import { TourStep, tourSteps } from '@/lib/tour-steps';
import { useRouter, useSearchParams } from 'next/navigation';
import { TourHighlight } from '@/components/dashboard/tour-highlight';

interface TourContextType {
  isTourActive: boolean;
  isTourCompleted: boolean;
  currentStep: TourStep | null;
  tourSteps: TourStep[];
  startTour: () => void;
  nextStep: () => void;
  completeTour: () => void;
}

const TourContext = React.createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { activeStore } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isTourActive, setIsTourActive] = React.useState(false);
  const [isTourCompleted, setIsTourCompleted] = React.useState(false);
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  
  const currentStep = isTourActive ? tourSteps[currentStepIndex] : null;
  const tourStorageKey = `tour_completed_${activeStore?.id}`;

  React.useEffect(() => {
    if (activeStore) {
      const completed = localStorage.getItem(tourStorageKey) === 'true';
      setIsTourCompleted(completed);
    }
  }, [activeStore, tourStorageKey]);

  const navigateToStep = (step: TourStep) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('view', step.view);
    router.push(`/dashboard?${newParams.toString()}`);
  };

  const startTour = () => {
    setCurrentStepIndex(0);
    setIsTourActive(true);
    navigateToStep(tourSteps[0]);
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < tourSteps.length) {
      setCurrentStepIndex(nextIndex);
      navigateToStep(tourSteps[nextIndex]);
    } else {
      completeTour();
    }
  };

  const completeTour = () => {
    setIsTourActive(false);
    setIsTourCompleted(true);
    if (activeStore) {
      localStorage.setItem(tourStorageKey, 'true');
    }
  };

  const value: TourContextType = {
    isTourActive,
    isTourCompleted,
    currentStep,
    tourSteps,
    startTour,
    nextStep,
    completeTour,
  };

  return (
    <TourContext.Provider value={value}>
      {children}
      <TourHighlight />
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = React.useContext(TourContext);
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
