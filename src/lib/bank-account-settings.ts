'use server';

import { getFirebaseAdmin } from './server/firebase-admin';
import type { BankAccountSettings } from './types';
import { defaultBankAccountSettings } from './types';

/**
 * Fetches Bank Account settings from Firestore using the Admin SDK.
 * @returns The bank account settings, or default settings if not found.
 */
export async function getBankAccountSettings(): Promise<BankAccountSettings> {
    const { db } = getFirebaseAdmin();
    const settingsDocRef = db.collection('appSettings').doc('bankAccount');
    try {
        const docSnap = await settingsDocRef.get();

        if (docSnap.exists()) {
            return { ...defaultBankAccountSettings, ...docSnap.data() as BankAccountSettings };
        } else {
            console.warn(`Bank account settings not found, creating document with default values.`);
            await settingsDocRef.set(defaultBankAccountSettings);
            return defaultBankAccountSettings;
        }
    } catch (error) {
        console.error("Error fetching bank account settings:", error);
        return defaultBankAccountSettings;
    }
}
