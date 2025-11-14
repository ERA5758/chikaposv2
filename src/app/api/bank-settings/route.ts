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
            // If it doesn't exist, it might be the first run, return defaults.
            return NextResponse.json(defaultBankAccountSettings);
        }
    } catch (error) {
        console.error("Error fetching bank account settings:", error);
        return NextResponse.json({ error: 'Failed to fetch bank account settings' }, { status: 500 });
    }
}
