
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';

export async function GET(req: NextRequest) {
  const { db } = getFirebaseAdmin();
  const slug = req.nextUrl.searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Parameter slug diperlukan.' }, { status: 400 });
  }

  try {
    // 1. Cari storeId berdasarkan slug (ID dokumen)
    const slugDocSnapshot = await db.collection('catalogSlugs').doc(slug).get();
    if (!slugDocSnapshot.exists) {
      return NextResponse.json({ error: 'Katalog tidak ditemukan.' }, { status: 404 });
    }
    const { storeId } = slugDocSnapshot.data() as { storeId: string };

    // 2. Ambil data toko (store)
    const storeDocSnapshot = await db.collection('stores').doc(storeId).get();
    if (!storeDocSnapshot.exists) {
      return NextResponse.json({ error: 'Detail toko tidak ditemukan.' }, { status: 404 });
    }
    const storeData = storeDocSnapshot.data();

     // Cek apakah katalog aktif dan langganan valid
    const now = new Date();
    const expiryDate = storeData?.catalogSubscriptionExpiry ? new Date(storeData.catalogSubscriptionExpiry) : null;
    
    if (!storeData?.isCatalogPublished || !expiryDate || expiryDate < now) {
        return NextResponse.json({ error: 'Katalog saat ini tidak tersedia atau langganan telah berakhir.' }, { status: 403 });
    }

    // 3. Ambil produk yang dipublikasikan dari subkoleksi 'products'
    const productsSnapshot = await db.collection('stores').doc(storeId).collection('products')
      .where('isPublished', '==', true)
      .orderBy('name')
      .get();
      
    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 4. Gabungkan dan kirim data
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
