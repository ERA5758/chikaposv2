'use client';

import { doc, getDoc, runTransaction, increment } from 'firebase/firestore';
import { db } from './firebase';
import type { Toast, useToast } from '@/hooks/use-toast';
import { FirebaseError } from 'firebase/app';

// Default settings, useful as a fallback.
export const defaultFeeSettings: TransactionFeeSettings = {
  tokenValueRp: 1000,
  feePercentage: 0.005,
  minFeeRp: 500,
  maxFeeRp: 2500,
  aiUsageFee: 1,
  newStoreBonusTokens: 50,
  aiBusinessPlanFee: 25,
  aiSessionFee: 5,
  aiSessionDurationMinutes: 30,
};

export type TransactionFeeSettings = typeof defaultFeeSettings;

/**
 * Deducts a specified fee from the store's Pradana Token balance in a secure transaction.
 * This function is intended to be called from client components.
 * @param currentBalance The current token balance from the client state.
 * @param feeToDeduct The number of tokens to deduct.
 * @param storeId The ID of the active store.
 * @param toast A toast function instance for showing notifications.
 * @param featureName The name of the AI feature being used, for display in toasts.
 * @throws An error if the token balance is insufficient.
 */
export async function deductAiUsageFee(
  currentBalance: number,
  feeToDeduct: number,
  storeId: string,
  toast: ReturnType<typeof useToast>['toast'],
  featureName: string = 'Fitur AI'
) {
  if (currentBalance < feeToDeduct) {
    toast({
      variant: 'destructive',
      title: 'Saldo Token Tidak Cukup',
      description: `Penggunaan ${featureName} memerlukan ${feeToDeduct} token, tetapi saldo Anda hanya ${currentBalance.toFixed(2)}. Silakan top up.`,
    });
    throw new Error('Insufficient token balance');
  }

  const storeRef = doc(db, 'stores', storeId);

  try {
    await runTransaction(db, async (transaction) => {
      const storeDoc = await transaction.get(storeRef);
      if (!storeDoc.exists()) {
        throw new Error("Toko tidak ditemukan.");
      }
      const serverBalance = storeDoc.data().pradanaTokenBalance || 0;
      if (serverBalance < feeToDeduct) {
        throw new Error(`Saldo token di server tidak cukup. Saldo saat ini: ${serverBalance.toFixed(2)}.`);
      }
      transaction.update(storeRef, { pradanaTokenBalance: increment(-feeToDeduct) });
    });
  } catch (error) {
    console.error("Error deducting AI usage fee:", error);
    let errorMessage = "Gagal memotong saldo token. Silakan coba lagi.";
    if (error instanceof FirebaseError) {
        errorMessage = error.message;
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    toast({
        variant: 'destructive',
        title: 'Gagal Memproses Biaya',
        description: errorMessage,
    });
    throw error; // Re-throw the error to stop the process in the calling component.
  }
}
