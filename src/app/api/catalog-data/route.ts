import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';
import type { Store, Product } from '@/lib/types';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

// This is a new API route to fetch data for the client-side catalog page,
// because server components can't be used on dynamic pages that also need client-side interactivity.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: "Slug toko tidak valid." }, { status: 400 });
  }

  try {
    const { db } = getFirebaseAdmin();
    const storesRef = collection(db, 'stores');
    const q = query(storesRef, where('catalogSlug', '==', slug));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json({ store: null, products: [], error: "Katalog tidak ditemukan." }, { status: 404 });
    }

    const storeDoc = querySnapshot.docs[0];
    const store = { id: storeDoc.id, ...storeDoc.data() } as Store;

    const expiryDate = store.catalogSubscriptionExpiry ? new Date(store.catalogSubscriptionExpiry) : null;
    const isSubscriptionActive = expiryDate ? expiryDate > new Date() : false;

    if (!isSubscriptionActive) {
        return NextResponse.json({ store, products: [], error: "Fitur katalog premium tidak aktif atau sudah berakhir untuk toko ini." });
    }
    
    const productsRef = collection(db, 'stores', store.id, 'products');
    const productsQuery = query(productsRef, orderBy('category'), orderBy('name'));
    const productsSnapshot = await getDocs(productsQuery);

    const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

    return NextResponse.json({ store, products, error: null });

  } catch (error) {
    console.error("Error fetching catalog data for client:", error);
    return NextResponse.json({ store: null, products: [], error: "Terjadi kesalahan saat memuat katalog." }, { status: 500 });
  }
}
