'use client';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export type PointEarningSettings = {
    rpPerPoint: number;
};

// Default settings if a store doesn't have any defined.
export const defaultPointEarningSettings: PointEarningSettings = {
    rpPerPoint: 10000, // Default: 1 point for every Rp 10.000 spent
};

/**
 * Fetches point earning settings for a specific store from Firestore.
 * @param storeId The ID of the store.
 * @returns The store's specific point earning settings, or default settings if not found.
 */
export async function getPointEarningSettings(storeId: string): Promise<PointEarningSettings> {
    const storeDocRef = doc(db, 'stores', storeId);
    try {
        const docSnap = await getDoc(storeDocRef);

        if (docSnap.exists()) {
            const storeData = docSnap.data();
            // Merge store settings with defaults to ensure all fields are present
            return { ...defaultPointEarningSettings, ...storeData.pointEarningSettings };
        } else {
            console.warn(`Store with ID ${storeId} not found. Using default point earning settings.`);
            return defaultPointEarningSettings;
        }
    } catch (error) {
        console.error("Error fetching point earning settings:", error);
        return defaultPointEarningSettings;
    }
}

/**
 * Updates or creates point earning settings for a specific store in Firestore.
 * @param storeId The ID of the store to update.
 * @param newSettings An object containing the settings to update.
 */
export async function updatePointEarningSettings(storeId: string, newSettings: Partial<PointEarningSettings>) {
    const storeDocRef = doc(db, 'stores', storeId);
    try {
        // Use setDoc with merge: true to update the nested pointEarningSettings object
        await setDoc(storeDocRef, {
            pointEarningSettings: newSettings
        }, { merge: true });
        
        console.log(`Point earning settings updated for store ${storeId}.`);
    } catch (error) {
        console.error(`Error updating point earning settings for store ${storeId}:`, error);
        throw error; // Re-throw the error to be handled by the caller
    }
}
