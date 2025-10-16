
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';

export async function GET(req: NextRequest) {
  const { db } = getFirebaseAdmin();
  const slug = req.nextUrl.searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Parameter slug diperlukan.' }, { status: 400 });
  }

  try {
    // 1. Cari dokumen toko yang memiliki catalogSlug yang cocok.
    const storesRef = db.collection('stores');
    const querySnapshot = await storesRef.where('catalogSlug', '==', slug).limit(1).get();

    if (querySnapshot.empty) {
      return NextResponse.json({ error: 'Katalog tidak ditemukan.' }, { status: 404 });
    }
    
    // Ambil data toko dari hasil query
    const storeDocSnapshot = querySnapshot.docs[0];
    const storeId = storeDocSnapshot.id;
    const storeData = storeDocSnapshot.data();

    // Cek langganan dinonaktifkan sementara untuk debugging
    // const now = new Date();
    // const expiryDate = storeData?.catalogSubscriptionExpiry ? new Date(storeData.catalogSubscriptionExpiry) : null;
    // if (!expiryDate || expiryDate < now) {
    //     return NextResponse.json({ error: 'Katalog saat ini tidak tersedia atau langganan telah berakhir.' }, { status: 403 });
    // }

    // 2. Ambil semua produk dari subkoleksi 'products'
    const productsSnapshot = await db.collection('stores').doc(storeId).collection('products')
      .orderBy('name')
      .get();
      
    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 3. Gabungkan dan kirim data
    const catalogData = {
      store: {
        name: storeData?.name,
        description: storeData?.description,
        logoUrl: storeData?.logoUrl,
        theme: storeData?.theme,
        socialLinks: storeData?.socialLinks,
        location: storeData?.location,
      },
      products,
    };

    return NextResponse.json(catalogData);

  } catch (error) {
    console.error('Error fetching catalog data:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan internal saat memuat katalog.' }, { status: 500 });
  }
}
