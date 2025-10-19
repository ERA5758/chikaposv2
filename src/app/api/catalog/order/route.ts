import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';
import type { OrderPayload, Table } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    const { db } = getFirebaseAdmin();
    try {
        const payload: OrderPayload = await req.json();
        const { storeId, customer, cart, totalAmount } = payload;

        if (!storeId || !customer || !cart || cart.length === 0) {
            return NextResponse.json({ error: 'Data pesanan tidak lengkap.' }, { status: 400 });
        }
        
        const newTransactionRef = db.collection('stores').doc(storeId).collection('transactions').doc();
        const transactionData = {
            id: newTransactionRef.id,
            receiptNumber: 0, // Will be assigned by a counter later
            storeId: storeId,
            customerId: customer.id,
            customerName: customer.name,
            staffId: 'system-catalog',
            createdAt: new Date().toISOString(),
            subtotal: totalAmount,
            discountAmount: 0,
            totalAmount: totalAmount,
            paymentMethod: 'Cash',
            pointsEarned: 0,
            pointsRedeemed: 0,
            items: cart,
            status: 'Diproses' as const,
        };
        await newTransactionRef.set(transactionData);

        return NextResponse.json({ success: true, message: 'Pesanan berhasil dikirim ke kasir.', transactionId: newTransactionRef.id });

    } catch (error) {
        console.error('Error creating virtual order:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
