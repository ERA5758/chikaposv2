
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';
import type { OrderPayload, PendingOrder } from '@/lib/types';

export async function POST(req: NextRequest) {
    const { db } = getFirebaseAdmin();
    try {
        const payload: OrderPayload = await req.json();
        const { storeId, customer, cart, subtotal, taxAmount, serviceFeeAmount, totalAmount, deliveryMethod, paymentMethod, notes } = payload;

        if (!storeId || !customer || !cart || !cart.length || !deliveryMethod || !paymentMethod) {
            return NextResponse.json({ error: 'Data pesanan tidak lengkap.' }, { status: 400 });
        }
        
        if (deliveryMethod === 'Dikirim Toko' && !customer.address) {
             return NextResponse.json({ error: 'Alamat pengiriman harus diisi untuk metode "Dikirim Toko".' }, { status: 400 });
        }

        const newPendingOrder: Omit<PendingOrder, 'id'> = {
            storeId,
            customer,
            items: cart,
            subtotal,
            taxAmount,
            serviceFeeAmount,
            totalAmount,
            deliveryMethod,
            paymentMethod,
            notes: notes || '',
            status: 'Baru', // Initial status
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
