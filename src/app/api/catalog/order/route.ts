
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';
import type { OrderPayload } from '@/lib/types';
import { getPointEarningSettings } from '@/lib/server/point-earning-settings';

export async function POST(req: NextRequest) {
    const { db } = getFirebaseAdmin();
    try {
        const payload: OrderPayload = await req.json();
        const { storeId, customer, cart, subtotal, totalAmount } = payload;

        if (!storeId || !customer || !cart || cart.length === 0) {
            return NextResponse.json({ error: 'Data pesanan tidak lengkap.' }, { status: 400 });
        }
        
        const pointSettings = await getPointEarningSettings(storeId);

        await db.runTransaction(async (transaction) => {
            const storeRef = db.collection('stores').doc(storeId);
            const customerRef = db.collection('stores').doc(storeId).collection('customers').doc(customer.id);
            
            const storeDoc = await transaction.get(storeRef);
            const customerDoc = await transaction.get(customerRef);
            
            if (!storeDoc.exists) throw new Error("Toko tidak ditemukan.");
            if (!customerDoc.exists) throw new Error("Pelanggan tidak ditemukan.");
            
            const productRefs = cart.map(item => db.collection('stores').doc(storeId).collection('products').doc(item.productId));
            const productDocs = await transaction.getAll(...productRefs);
            
            // 1. Verify stock and prepare updates
            for (let i = 0; i < productDocs.length; i++) {
                const productDoc = productDocs[i];
                if (!productDoc.exists) throw new Error(`Produk ${cart[i].productName} tidak ditemukan.`);
                
                const currentStock = productDoc.data()?.stock || 0;
                if (currentStock < cart[i].quantity) {
                    throw new Error(`Stok untuk ${cart[i].productName} tidak mencukupi (sisa ${currentStock}).`);
                }
                transaction.update(productDoc.ref, { stock: currentStock - cart[i].quantity });
            }

            // 2. Update customer points
            const currentPoints = customerDoc.data()?.loyaltyPoints || 0;
            const finalPointsEarned = Math.floor(totalAmount / pointSettings.rpPerPoint);
            transaction.update(customerRef, { loyaltyPoints: currentPoints + finalPointsEarned });

            // 3. Create transaction record
            const newTransactionRef = db.collection('stores').doc(storeId).collection('transactions').doc();
            transaction.set(newTransactionRef, {
                storeId: storeId,
                customerId: customer.id,
                customerName: customer.name,
                staffId: 'self-service', // Special ID for catalog orders
                createdAt: new Date().toISOString(),
                subtotal: subtotal,
                discountAmount: 0,
                totalAmount: totalAmount,
                paymentMethod: 'QRIS', // Default, to be confirmed by cashier
                pointsEarned: finalPointsEarned,
                pointsRedeemed: 0,
                items: cart,
                status: 'Diproses', // Automatically 'Processed'
            });
        });

        return NextResponse.json({ success: true, message: 'Pesanan berhasil dibuat.' });

    } catch (error) {
        console.error('Error creating order from catalog:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
