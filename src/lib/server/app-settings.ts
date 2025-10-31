'use server';

import { getFirebaseAdmin } from './firebase-admin'; // Use server-side db
import type { TransactionFeeSettings } from '../types';
import { defaultFeeSettings } from '../types';
import { doc, runTransaction, increment } from 'firebase/firestore';

export async function getTransactionFeeSettings(): Promise<TransactionFeeSettings> {
  const { db } = getFirebaseAdmin();
  const settingsDocRef = db.collection('appSettings').doc('transactionFees');
  try {
    const docSnap = await settingsDocRef.get();

    if (docSnap.exists()) {
      // Merge with defaults to ensure all properties are present
      return { ...defaultFeeSettings, ...docSnap.data() };
    } else {
      console.warn(`Transaction fee settings not found, creating document with default values.`);
      // If the document doesn't exist, create it with default values
      await settingsDocRef.set(defaultFeeSettings);
      return defaultFeeSettings;
    }
  } catch (error) {
    console.error("Error fetching transaction fee settings:", error);
    return defaultFeeSettings;
  }
}

/**
 * Deducts a specified fee from the store's Pradana Token balance in a secure transaction.
 * This function is intended to be called from SERVER-SIDE components/routes.
 * @param feeToDeduct The number of tokens to deduct.
 * @param storeId The ID of the active store.
 * @throws An error if the token balance is insufficient or transaction fails.
 */
export async function deductAiUsageFee(
  feeToDeduct: number,
  storeId: string,
) {
  const { db } = getFirebaseAdmin();
  const storeRef = doc(db, 'stores', storeId);

  try {
    await runTransaction(db, async (transaction) => {
      const storeDoc = await transaction.get(storeRef);
      if (!storeDoc.exists()) {
        throw new Error("Toko tidak ditemukan.");
      }
      const serverBalance = storeDoc.data()?.pradanaTokenBalance || 0;
      if (serverBalance < feeToDeduct) {
        throw new Error(`Saldo token di server tidak cukup. Saldo saat ini: ${serverBalance.toFixed(2)}.`);
      }
      transaction.update(storeRef, { pradanaTokenBalance: increment(-feeToDeduct) });
    });
  } catch (error) {
    console.error("Error deducting AI usage fee:", error);
    throw error; // Re-throw the error to be handled by the caller API route
  }
}
