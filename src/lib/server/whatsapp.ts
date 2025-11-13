
'use server';

import { getWhatsappSettings } from './whatsapp-settings';

/**
 * Sends a WhatsApp message using the whacenter.com API.
 * It dynamically fetches the device ID for sending.
 *
 * @param target The recipient's number or group name.
 * @param message The message to send.
 * @param isGroup Whether the target is a group.
 */
export async function internalSendWhatsapp(target: string, message: string, isGroup: boolean = false) {
    try {
        const { deviceId } = await getWhatsappSettings();
        
        if (!deviceId) {
            console.error('WhatsApp Device ID is not configured in Firestore (appSettings/whatsappConfig).');
            // We don't throw an error to prevent the main operation from failing.
            return;
        }

        const formData = new FormData();
        formData.append('device_id', deviceId);
        formData.append(isGroup ? 'group' : 'number', target);
        formData.append('message', message);
        
        const endpoint = isGroup ? 'sendGroup' : 'send';
        const webhookUrl = `https://app.whacenter.com/api/${endpoint}`;

        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: formData,
        });

        const responseJson = await response.json();

        if (!response.ok || responseJson.status === 'error') {
            console.error('WhaCenter API Error:', { 
                status: response.status, 
                reason: responseJson.reason || 'Unknown error' 
            });
        }

    } catch (error) {
        console.error("Failed to execute internalSendWhatsapp:", error);
    }
}

/**
 * Formats a phone number into a valid WhatsApp number format (e.g., 62xxxx).
 * - Removes all non-digit characters.
 * - If it starts with '0', replaces it with '62'.
 * - If it starts with '8', prepends '62'.
 * @param nomor The phone number string to format.
 * @returns The formatted WhatsApp number.
 */
export function formatWhatsappNumber(nomor: string | number): string {
    if (!nomor) return '';
    let nomorStr = String(nomor).replace(/\D/g, '');
    if (nomorStr.startsWith('0')) {
        return '62' + nomorStr.substring(1);
    }
    if (nomorStr.startsWith('8')) {
        return '62' + nomorStr;
    }
    return nomorStr;
}
