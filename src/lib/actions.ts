
'use server';

import { internalSendWhatsapp } from './server/whatsapp';
import type { TopUpRequest } from './types';

/**
 * Sends a manual WhatsApp confirmation for a pending top-up request to the platform admin.
 * This is a Server Action and can be called directly from client components.
 * @param request The top-up request object.
 * @throws An error if sending the message fails.
 */
export async function sendWaConfirmation(request: TopUpRequest) {
    try {
        const adminMessage = `🔔 *KONFIRMASI TOP-UP MANUAL*\n\nToko: *${request.storeName}*\nPengaju: *${request.userName}*\nJumlah: *Rp ${request.totalAmount.toLocaleString('id-ID')}*\n\nMohon untuk segera dicek dan diverifikasi. Terima kasih.`;
        await internalSendWhatsapp(adminMessage, undefined, true);
    } catch (error) {
        console.error("Failed to send WA confirmation via server action:", error);
        // Re-throw to be handled by the client-side caller
        throw error;
    }
}
