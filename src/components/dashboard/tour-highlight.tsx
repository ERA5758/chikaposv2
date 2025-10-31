'use client';

import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useTour } from '@/contexts/tour-context';
import { cn } from '@/lib/utils';
import { ArrowRight, X } from 'lucide-react';

export function TourHighlight() {
  const { isTourActive, currentStep, nextStep, completeTour, tourSteps } = useTour();
  const [targetElement, setTargetElement] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    if (isTourActive && currentStep) {
      const element = document.querySelector(currentStep.selector) as HTMLElement;
      setTargetElement(element);
      
      // Scroll element into view if it exists
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } else {
      setTargetElement(null);
    }
  }, [isTourActive, currentStep]);

  if (!isTourActive || !currentStep || !targetElement) {
    return null;
  }

  const { top, left, width, height } = targetElement.getBoundingClientRect();
  const isLastStep = tourSteps.length === currentStep.step;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[99] bg-black/60 backdrop-blur-sm" />

      {/* Highlight Box */}
      <div
        className="fixed z-[100] border-2 border-primary border-dashed rounded-md pointer-events-none transition-all duration-300"
        style={{
          top: top - 8,
          left: left - 8,
          width: width + 16,
          height: height + 16,
        }}
      />
      
      {/* Popover */}
      <Popover open={true}>
        <PopoverTrigger asChild>
          <div
            className="fixed z-[101]"
            style={{ top: top + height / 2, left: left + width / 2 }}
          />
        </PopoverTrigger>
        <PopoverContent side="bottom" align="center" className="w-80">
          <div className="space-y-4">
            <h3 className="font-bold font-headline">{currentStep.title}</h3>
            <p className="text-sm text-muted-foreground">{currentStep.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                Langkah {currentStep.step} dari {tourSteps.length}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={completeTour}>
                  <X className="mr-2 h-4 w-4" /> Lewati
                </Button>
                <Button onClick={isLastStep ? completeTour : nextStep}>
                    {isLastStep ? 'Selesai' : 'Lanjutkan'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
