
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
        
        // --- NEW LOGIC: Create a Virtual Table Order ---
        await db.runTransaction(async (transaction) => {
            const storeRef = db.collection('stores').doc(storeId);
            const storeDoc = await transaction.get(storeRef);

            if (!storeDoc.exists) {
                throw new Error("Toko tidak ditemukan.");
            }
            
            const storeData = storeDoc.data();
            // Use a specific counter for virtual tables to avoid conflicts
            const lastVirtualTableNumber = storeData?.virtualTableCounter || 0;
            const newVirtualTableNumber = lastVirtualTableNumber + 1;

            const newTableRef = db.collection('stores').doc(storeId).collection('tables').doc();

            // Create a new "virtual table" for this self-service order
            const newTableData: Partial<Table> = {
                name: `Virtual ${newVirtualTableNumber}`,
                capacity: 1, // Represents a single customer/order
                status: 'Terisi', // The order is placed and waiting for cashier processing
                isVirtual: true, // Flag to identify this as a catalog order
                currentOrder: {
                    items: cart,
                    totalAmount: totalAmount,
                    orderTime: new Date().toISOString(),
                    customer: { // Embed customer info in the order
                        id: customer.id,
                        name: customer.name,
                        phone: customer.phone,
                        avatarUrl: customer.avatarUrl,
                    }
                }
            };
            
            transaction.set(newTableRef, newTableData);
            
            // Increment the specific counter on the store document
            transaction.update(storeRef, { virtualTableCounter: FieldValue.increment(1) });
        });

        return NextResponse.json({ success: true, message: 'Pesanan berhasil dikirim ke kasir.' });

    } catch (error) {
        console.error('Error creating virtual table order from catalog:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
