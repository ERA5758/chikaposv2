import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';
import { internalSendWhatsapp } from '@/lib/server/whatsapp';
import { formatWhatsappNumber } from '@/lib/utils';

export async function POST(req: NextRequest) {
    const { auth, db } = getFirebaseAdmin();
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    
    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const { uid, name } = decodedToken;
        const { storeId, storeName, amount, tokensToAdd, uniqueCode, totalAmount, proofUrl } = await req.json();

        if (!storeId || !storeName || !amount || !tokensToAdd || !totalAmount || !proofUrl) {
            return NextResponse.json({ error: 'Missing required top-up data.' }, { status: 400 });
        }

        const newRequestData = {
            storeId,
            storeName,
            userId: uid,
            userName: name || 'User',
            amount,
            tokensToAdd,
            uniqueCode,
            totalAmount,
            proofUrl,
            status: 'pending' as const,
            requestedAt: new Date().toISOString(),
        };

        const topUpRef = await db.collection('topUpRequests').add(newRequestData);
        // Also sync to store's subcollection for client-side history
        await db.collection('stores').doc(storeId).collection('topUpRequests').doc(topUpRef.id).set(newRequestData);

        console.info(`Top-up request submitted for store ${storeId} by user ${uid}`);

        // --- Handle WhatsApp notifications directly ---
        (async () => {
            try {
                // Notify platform admin
                const adminMessage = `🔔 *Permintaan Top-up Baru*\n\nToko: *${storeName}*\nPengaju: *${name}*\nJumlah: *Rp ${totalAmount.toLocaleString('id-ID')}* (+${tokensToAdd.toLocaleString('id-ID')} Token)\nStatus: *Pending*\n\nMohon untuk segera diverifikasi melalui panel Superadmin.\nLihat bukti: ${proofUrl}`;
                await internalSendWhatsapp(adminMessage, undefined, true);
                
                // Notify user
                const userDoc = await db.collection('users').doc(uid).get();
                const userWhatsapp = userDoc.data()?.whatsapp;
                if (userWhatsapp) {
                    const userMessage = `Halo *${name}*, pengajuan top up Pradana Token Anda untuk toko *${storeName}* sebesar *Rp ${totalAmount.toLocaleString('id-ID')}* telah berhasil kami terima dan sedang dalam proses verifikasi.`;
                    const formattedPhone = formatWhatsappNumber(userWhatsapp);
                    await internalSendWhatsapp(userMessage, formattedPhone);
                }
            } catch (whatsappError) {
                console.error("Error sending top-up notifications:", whatsappError);
                // Do not re-throw, as the main operation succeeded.
            }
        })();

        return NextResponse.json({ success: true, id: topUpRef.id });

    } catch (error) {
        console.error('Error in submitTopUpRequest:', error);
        return NextResponse.json({ error: (error as Error).message || 'An unknown error occurred.' }, { status: 500 });
    }
}
