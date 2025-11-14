import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';
import type { BankAccountSettings } from '@/lib/types';
import { defaultBankAccountSettings } from '@/lib/types';

export async function GET() {
    const { db } = getFirebaseAdmin();
    const settingsDocRef = db.collection('appSettings').doc('bankAccount');
    
    try {
        const docSnap = await settingsDocRef.get();

        if (docSnap.exists()) {
            const settings = { ...defaultBankAccountSettings, ...docSnap.data() };
            return NextResponse.json(settings);
        } else {
            // If the document does not exist, create it with default values first.
            await settingsDocRef.set(defaultBankAccountSettings);
            console.log("Created default bank account settings document.");
            // Then return the default settings.
            return NextResponse.json(defaultBankAccountSettings);
        }
    } catch (error) {
        console.error("Error fetching or creating bank account settings:", error);
        // In case of an error (e.g., permissions), still return a default to avoid client-side crashes.
        return NextResponse.json(defaultBankAccountSettings, { 
            status: 500,
            statusText: "Failed to fetch settings, returning default.",
        });
    }
}
