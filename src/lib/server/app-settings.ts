

import { getFirebaseAdmin } from './firebase-admin'; // Use server-side db
import type { TransactionFeeSettings } from '../types';

// Default settings in case the document doesn't exist in Firestore
export const defaultFeeSettings: TransactionFeeSettings = {
  tokenValueRp: 1000,    // 1 token = Rp 1000
  feePercentage: 0.005,  // Biaya 0.5% per transaksi
  minFeeRp: 500,         // Biaya minimum Rp 500
  maxFeeRp: 2500,        // Biaya maksimum Rp 2500
  aiUsageFee: 1,       // Biaya 1 token per penggunaan AI tunggal
  newStoreBonusTokens: 50, // Bonus 50 token untuk toko baru
  aiBusinessPlanFee: 25, // Biaya 25 token untuk AI Business Plan
  aiSessionFee: 5,        // Biaya 5 token untuk sesi chat AI
  aiSessionDurationMinutes: 30, // Durasi sesi chat 30 menit
  catalogMonthlyFee: 250,
  catalogSixMonthFee: 1400,
  catalogYearlyFee: 2500,
};

export async function getTransactionFeeSettings(): Promise<TransactionFeeSettings> {
  const { db } = getFirebaseAdmin();
  const settingsDocRef = db.collection('appSettings').doc('transactionFees');
  try {
    const docSnap = await settingsDocRef.get();

    if (docSnap.exists) {
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
