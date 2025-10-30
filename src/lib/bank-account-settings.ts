
import { getFirebaseAdmin } from './server/firebase-admin';

export type BankAccountSettings = {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
};

// Default settings if the document doesn't exist in Firestore.
export const defaultBankAccountSettings: BankAccountSettings = {
    bankName: 'BANK BCA',
    accountNumber: '6225089802',
    accountHolder: 'PT. ERA MAJU MAPAN BERSAMA PRADANA',
};

/**
 * Fetches Bank Account settings from Firestore using the Admin SDK.
 * @returns The bank account settings, or default settings if not found.
 */
export async function getBankAccountSettings(): Promise<BankAccountSettings> {
    const { db } = getFirebaseAdmin();
    const settingsDocRef = db.collection('appSettings').doc('bankAccount');
    try {
        const docSnap = await settingsDocRef.get();

        if (docSnap.exists) {
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
