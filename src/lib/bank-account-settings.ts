'use server';

import { getFirebaseAdmin } from './server/firebase-admin';
import type { BankAccountSettings } from './types';

/**
 * Fetches Bank Account settings from Firestore using the Admin SDK.
 * @returns The bank account settings, or an empty object if not found.
 */
export async function getBankAccountSettings(): Promise<Partial<BankAccountSettings>> {
    const { db } = getFirebaseAdmin();
    const settingsDocRef = db.collection('appSettings').doc('bankAccount');
    try {
        const docSnap = await settingsDocRef.get();

        if (docSnap.exists()) {
            return docSnap.data() as BankAccountSettings;
        } else {
            console.warn(`Bank account settings not found. No default will be created from here.`);
            return {};
        }
    } catch (error) {
        console.error("Error fetching bank account settings:", error);
        return {};
    }
}
