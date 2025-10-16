
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';
import { getOrderReadyFollowUp } from '@/ai/flows/order-ready-follow-up';

// --- Start of Inlined WhatsApp Logic ---

type WhatsappSettings = {
    deviceId: string;
    adminGroup: string;
};

const defaultWhatsappSettings: WhatsappSettings = {
    deviceId: 'fa254b2588ad7626d647da23be4d6a08',
    adminGroup: 'SPV ERA MMBP',
};

async function getWhatsappSettingsForApi(): Promise<WhatsappSettings> {
    const { db: adminDb } = getFirebaseAdmin();
    const settingsDocRef = adminDb.collection('appSettings').doc('whatsappConfig');
    try {
        const docSnap = await settingsDocRef.get();
        if (docSnap.exists()) {
            return { ...defaultWhatsappSettings, ...(docSnap.data() as WhatsappSettings) };
        } else {
            await settingsDocRef.set(defaultWhatsappSettings);
            return defaultWhatsappSettings;
        }
    } catch (error) {
        console.error("Error fetching WhatsApp settings:", error);
        return defaultWhatsappSettings;
    }
}

async function internalSendWhatsapp(deviceId: string, target: string, message: string, isGroup: boolean = false) {
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

    if (!response.ok) {
        const responseJson = await response.json();
        console.error('WhaCenter API HTTP Error:', { status: response.status, body: responseJson });
        throw new Error(`WhaCenter API responded with status ${response.status}`);
    }

    const responseJson = await response.json();
    if (responseJson.status === 'error') {
        console.error('WhaCenter API Error:', responseJson.reason);
        throw new Error(responseJson.reason || 'An error occurred with the WhatsApp service.');
    }

    return responseJson;
}

function formatWhatsappNumber(nomor: string | number): string {
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

// --- End of Inlined WhatsApp Logic ---


export async function POST(req: NextRequest) {
    const { auth } = getFirebaseAdmin();
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    
    try {
        await auth.verifyIdToken(idToken);
        const { transaction, customer, store } = await req.json();

        if (!transaction || !store) {
            return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
        }

        if (!customer?.phone) {
            return NextResponse.json({ error: `Pelanggan "${transaction.customerName}" tidak memiliki nomor WhatsApp.` }, { status: 412 });
        }

        const nameToAnnounce = customer?.name || transaction.customerName;
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const { followUpMessage: text } = await getOrderReadyFollowUp({
            customerName: nameToAnnounce,
            storeName: store.name,
            itemsOrdered: transaction.items.map((item: any) => item.productName),
            currentTime: currentTime,
            notificationStyle: store.receiptSettings?.notificationStyle || 'fakta',
        });

        
        const { deviceId } = await getWhatsappSettingsForApi();
        if (!deviceId) {
            return NextResponse.json({ error: 'WhatsApp Device ID tidak dikonfigurasi untuk toko ini.' }, { status: 412 });
        }
        const formattedPhone = formatWhatsappNumber(customer.phone);
        await internalSendWhatsapp(deviceId, formattedPhone, text);
        return NextResponse.json({ success: true, message: 'Pesan WhatsApp terkirim.' });

    } catch (error) {
        console.error('Error in sendOrderReadyNotification:', error);
        return NextResponse.json({ error: (error as Error).message || 'An unknown error occurred.' }, { status: 500 });
    }
}
