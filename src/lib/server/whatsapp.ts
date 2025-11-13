'use server';

/**
 * Sends a WhatsApp message using the whacenter.com API.
 * It reads the device ID from environment variables.
 * This function is intended for server-side use only.
 *
 * @param message The message to send.
 * @param target The recipient's number or group name. Defaults to admin group from env.
 * @param isGroup Whether the target is a group.
 */
export async function internalSendWhatsapp(message: string, target?: string, isGroup: boolean = false) {
    const deviceId = process.env.WHATSAPP_DEVICE_ID;
    const adminGroup = process.env.WHATSAPP_ADMIN_GROUP;

    if (!deviceId) {
        console.error('WhatsApp Device ID is not configured in environment variables (WHATSAPP_DEVICE_ID).');
        throw new Error('Konfigurasi WhatsApp di server belum lengkap.');
    }
    
    const finalTarget = target || adminGroup;

    if (!finalTarget) {
        console.error('WhatsApp target number or group is missing and no default admin group is set.');
        throw new Error('Target pengiriman WhatsApp tidak ditemukan.');
    }

    const formData = new FormData();
    formData.append('device_id', deviceId);
    formData.append(isGroup ? 'group' : 'number', finalTarget);
    formData.append('message', message);
    
    const endpoint = isGroup ? 'sendGroup' : 'send';
    const webhookUrl = `https://app.whacenter.com/api/${endpoint}`;

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: formData,
        });

        const responseJson = await response.json();

        if (!response.ok || responseJson.status === 'error') {
            console.error('WhaCenter API Error:', { 
                status: response.status, 
                reason: responseJson.reason || 'Unknown error from WhaCenter' 
            });
            throw new Error(responseJson.reason || `Gagal mengirim pesan ke ${finalTarget}.`);
        }
        
        console.log(`WhatsApp message sent successfully to ${finalTarget}.`);

    } catch (error) {
        console.error("Failed to send WhatsApp message via internal function:", error);
        throw error; // Re-throw to be handled by the caller
    }
}
