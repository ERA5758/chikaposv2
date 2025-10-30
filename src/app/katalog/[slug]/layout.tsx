import * as React from 'react';
import type { Metadata, ResolvingMetadata } from 'next';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';
import type { Product } from '@/lib/types';

type Props = {
  params: { slug: string };
};

async function getStoreAndProductsData(slug: string) {
  try {
    const { db } = getFirebaseAdmin();
    const storesRef = db.collection('stores');
    const querySnapshot = await storesRef.where('catalogSlug', '==', slug).limit(1).get();

    if (querySnapshot.empty) {
      return null;
    }

    const storeDocSnapshot = querySnapshot.docs[0];
    const storeId = storeDocSnapshot.id;
    const storeData = storeDocSnapshot.data();

    const productsSnapshot = await db.collection('stores').doc(storeId).collection('products').get();
    const products = productsSnapshot.docs.map(doc => doc.data() as Product);
    
    return { storeData, products };

  } catch (error) {
    console.error("Error fetching store and products data for metadata:", error);
    return null;
  }
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const slug = params.slug;
  const data = await getStoreAndProductsData(slug);

  if (!data || !data.storeData) {
    return {
      title: 'Katalog Tidak Ditemukan',
      description: 'Katalog yang Anda cari tidak tersedia saat ini.',
    };
  }

  const { storeData, products } = data;

  const title = `${storeData.name} - Lihat Menu Kami`;
  const description = storeData.description || `Jelajahi menu lengkap dari ${storeData.name}. Pesan sekarang melalui katalog digital kami.`;
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://kasir-pos-chika.web.app';
  const catalogUrl = `${siteUrl}/katalog/${slug}`;

  // --- JSON-LD Structured Data ---
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FoodEstablishment',
    name: storeData.name,
    description: description,
    url: catalogUrl,
    image: storeData.logoUrl || '',
    address: {
      '@type': 'PostalAddress',
      addressLocality: storeData.location || 'Indonesia',
      addressCountry: 'ID'
    },
    servesCuisine: storeData.businessDescription || 'Makanan & Minuman',
    hasMenu: {
      '@type': 'Menu',
      hasMenuItem: products.map((product) => ({
        '@type': 'MenuItem',
        name: product.name,
        description: product.description || product.name,
        offers: {
          '@type': 'Offer',
          price: product.price.toString(),
          priceCurrency: 'IDR'
        }
      }))
    }
  };


  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      images: storeData.logoUrl ? [storeData.logoUrl] : [],
      url: catalogUrl,
      siteName: storeData.name,
    },
    // Injects the JSON-LD script into the page head
    other: {
      'application/ld+json': JSON.stringify(jsonLd),
    }
  };
}

export default function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
