
'use server';

import { getFirebaseAdmin } from './firebase-admin';
import type { WhatsappSettings } from '../types';
import { defaultWhatsappSettings } from '../types';

/**
 * Fetches WhatsApp settings from Firestore using the Admin SDK.
 * This function is intended for server-side use only.
 * @returns The WhatsApp settings, or default settings if not found.
 */
export async function getWhatsappSettings(): Promise<WhatsappSettings> {
    const { db } = getFirebaseAdmin();
    const settingsDocRef = db.collection('appSettings').doc('whatsappConfig');
    try {
        const docSnap = await settingsDocRef.get();

        if (docSnap.exists()) {
            return { ...defaultWhatsappSettings, ...docSnap.data() as WhatsappSettings };
        } else {
            console.warn(`WhatsApp settings not found, creating document with default values.`);
            await settingsDocRef.set(defaultWhatsappSettings);
            return defaultWhatsappSettings;
        }
    } catch (error) {
        console.error("Error fetching WhatsApp settings:", error);
        return defaultWhatsappSettings;
    }
}
