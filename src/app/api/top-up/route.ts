
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';
import { URLSearchParams } from 'url';
import { formatWhatsappNumber } from '@/lib/utils';

async function internalSendWhatsapp(deviceId: string, target: string, message: string, isGroup: boolean = false) {
    const body = new URLSearchParams();
    body.append('device_id', deviceId);
    body.append(isGroup ? 'group' : 'number', target);
    body.append('message', message);
    
    const endpoint = isGroup ? 'sendGroup' : 'send';
    const webhookUrl = `https://app.whacenter.com/api/${endpoint}`;

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: body,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!response.ok) {
            const responseJson = await response.json();
            console.error('WhaCenter API HTTP Error:', { status: response.status, body: responseJson });
        } else {
            const responseJson = await response.json();
            if (responseJson.status === 'error') {
                console.error('WhaCenter API Error:', responseJson.reason);
            }
        }
    } catch (error) {
        console.error("Failed to send WhatsApp message:", error);
    }
}


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
                const deviceId = process.env.WHATSAPP_DEVICE_ID;
                const adminGroup = process.env.WHATSAPP_ADMIN_GROUP;

                if (!deviceId) {
                    console.warn('WHATSAPP_DEVICE_ID is not set. Skipping top-up notifications.');
                    return;
                }
                
                // Notify platform admin
                if (adminGroup) {
                    const adminMessage = `🔔 *Permintaan Top-up Baru*\n\nToko: *${storeName}*\nPengaju: *${name}*\nJumlah: *Rp ${totalAmount.toLocaleString('id-ID')}* (+${tokensToAdd.toLocaleString('id-ID')} Token)\nStatus: *Pending*\n\nMohon untuk segera diverifikasi melalui panel Superadmin.\nLihat bukti: ${proofUrl}`;
                    await internalSendWhatsapp(deviceId, adminGroup, adminMessage, true);
                }
                
                // Notify user
                const userDoc = await db.collection('users').doc(uid).get();
                const userWhatsapp = userDoc.data()?.whatsapp;
                if (userWhatsapp) {
                    const userMessage = `Halo *${name}*, pengajuan top up Pradana Token Anda untuk toko *${storeName}* sebesar *Rp ${totalAmount.toLocaleString('id-ID')}* telah berhasil kami terima dan sedang dalam proses verifikasi.`;
                    const formattedPhone = formatWhatsappNumber(userWhatsapp);
                    await internalSendWhatsapp(deviceId, formattedPhone, userMessage);
                }
            } catch (whatsappError) {
                console.error("Error sending top-up notifications:", whatsappError);
            }
        })();

        return NextResponse.json({ success: true, id: topUpRef.id });

    } catch (error) {
        console.error('Error in submitTopUpRequest:', error);
        return NextResponse.json({ error: (error as Error).message || 'An unknown error occurred.' }, { status: 500 });
    }
}
