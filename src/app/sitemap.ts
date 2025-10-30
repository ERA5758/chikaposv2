import { MetadataRoute } from 'next';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';
import type { Store } from '@/lib/types';

// This function is called at build time to generate the sitemap.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { db } = getFirebaseAdmin();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://kasir-pos-chika.web.app';

  // 1. Get all store slugs for catalog pages
  const storesSnapshot = await db.collection('stores').get();
  const stores = storesSnapshot.docs.map(doc => doc.data() as Store);

  const catalogUrls = stores
    .filter(store => store.catalogSlug && !store.catalogSubscriptionExpiry || new Date(store.catalogSubscriptionExpiry!) > new Date())
    .map(store => {
      return {
        url: `${baseUrl}/katalog/${store.catalogSlug}`,
        lastModified: store.createdAt ? new Date(store.createdAt) : new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      };
    });

  // 2. Add static pages
  const staticUrls = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
  ];

  return [...staticUrls, ...catalogUrls];
}
