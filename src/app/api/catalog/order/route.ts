
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';
import type { OrderPayload } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    const { db } = getFirebaseAdmin();
    try {
        const payload: OrderPayload = await req.json();
        const { storeId, customer, cart, subtotal, taxAmount, serviceFeeAmount, totalAmount, deliveryMethod } = payload;

        if (!storeId || !customer || !cart || !cart.length || !deliveryMethod) {
            return NextResponse.json({ error: 'Data pesanan tidak lengkap.' }, { status: 400 });
        }

        const newPendingOrder = {
            storeId,
            customer,
            items: cart,
            subtotal,
            taxAmount,
            serviceFeeAmount,
            totalAmount,
            deliveryMethod,
            status: 'Baru' as const,
            createdAt: new Date().toISOString(),
        };

        const newOrderRef = await db.collection('pendingOrders').add(newPendingOrder);

        return NextResponse.json({ 
            success: true, 
            message: 'Pesanan berhasil dikirim ke kasir.', 
            orderId: newOrderRef.id 
        });

    } catch (error) {
        console.error('Error creating pending order:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
