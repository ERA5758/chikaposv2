
'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ButtonProps } from '@/components/ui/button';
import { AILoadingOverlay } from './ai-loading-overlay';
import { useAuth } from '@/contexts/auth-context';
import type { TransactionFeeSettings } from '@/lib/app-settings';
import { deductAiUsageFee } from '@/lib/app-settings';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Coins } from 'lucide-react';

type AIConfirmationDialogProps<T> = {
  featureName: string;
  featureDescription: string;
  feeSettings: TransactionFeeSettings | null;
  feeToDeduct?: number; // Optional specific fee for the feature
  onConfirm: () => Promise<T>;
  onSuccess: (result: T) => void;
  onError?: (error: Error) => void;
  children: React.ReactNode;
  buttonProps?: ButtonProps;
  skipFeeDeduction?: boolean; // New prop to skip fee deduction
};

export function AIConfirmationDialog<T>({
  featureName,
  featureDescription,
  feeSettings,
  feeToDeduct,
  onConfirm,
  onSuccess,
  onError,
  children,
  skipFeeDeduction = false, // Default to false
}: AIConfirmationDialogProps<T>) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const { activeStore, pradanaTokenBalance, refreshPradanaTokenBalance } = useAuth();
  const { toast } = useToast();

  const actualFee = feeToDeduct ?? feeSettings?.aiUsageFee ?? 0;

  const handleConfirm = async () => {
    if (!activeStore || !feeSettings) {
      toast({ variant: 'destructive', title: 'Error', description: 'Pengaturan biaya atau toko tidak tersedia.' });
      return;
    }

    if (!skipFeeDeduction) {
        try {
            await deductAiUsageFee(pradanaTokenBalance, actualFee, activeStore.id, toast, featureName);
        } catch {
            setIsOpen(false);
            return;
        }
    }
    
    setIsOpen(false);
    setIsProcessing(true);

    try {
      const result = await onConfirm();
      if (!skipFeeDeduction) {
        refreshPradanaTokenBalance();
      }
      toast({ title: 'Sukses!', description: `${featureName} berhasil diproses.` });
      onSuccess(result);
    } catch (error) {
      console.error(`Error executing AI feature '${featureName}':`, error);
      toast({
        variant: 'destructive',
        title: `Gagal Memproses ${featureName}`,
        description: (error as Error).message || 'Terjadi kesalahan. Silakan coba lagi.',
      });
      
      if (!skipFeeDeduction) {
        try {
          await deductAiUsageFee(pradanaTokenBalance, -actualFee, activeStore.id, () => {});
          refreshPradanaTokenBalance();
          toast({
            title: 'Pengembalian Dana Token',
            description: `Biaya token sebesar ${actualFee} telah dikembalikan karena terjadi kesalahan.`,
          });
        } catch (refundError) {
          console.error("Critical: Failed to refund tokens after AI error.", refundError);
        }
      }
      if (onError && error instanceof Error) {
        onError(error);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogTrigger asChild>
          {children}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-center gap-2">
              <Sparkles className="text-primary" />
               Konfirmasi: {featureName}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {featureDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border bg-secondary/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Biaya Penggunaan</span>
              <span className="flex items-center gap-2 font-bold text-primary">
                <Coins className="h-4 w-4" />
                {actualFee} Pradana Token
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Saldo Token Toko Anda</span>
              <span className="text-sm font-semibold">{pradanaTokenBalance.toFixed(2)} Token</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={!feeSettings || !activeStore}>
              Ya, Lanjutkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isProcessing && <AILoadingOverlay featureName={featureName} />}
    </>
  );
}
