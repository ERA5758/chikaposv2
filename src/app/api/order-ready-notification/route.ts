
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';
import { getOrderReadyFollowUp } from '@/ai/flows/order-ready-follow-up';
import { internalSendWhatsapp, formatWhatsappNumber } from '@/lib/server/whatsapp';


export async function POST(req: NextRequest) {
    const { auth, db } = getFirebaseAdmin();
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
        
        const formattedPhone = formatWhatsappNumber(customer.phone);
        await internalSendWhatsapp(formattedPhone, text);
        return NextResponse.json({ success: true, message: 'Pesan WhatsApp terkirim.' });

    } catch (error) {
        console.error('Error in sendOrderReadyNotification:', error);
        return NextResponse.json({ error: (error as Error).message || 'An unknown error occurred.' }, { status: 500 });
    }
}
