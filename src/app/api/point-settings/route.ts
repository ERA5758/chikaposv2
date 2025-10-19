import { NextRequest, NextResponse } from 'next/server';
import { getPointEarningSettings } from '@/lib/server/point-earning-settings';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('storeId');

  if (!storeId) {
    return NextResponse.json({ error: 'Parameter storeId diperlukan.' }, { status: 400 });
  }

  try {
    const settings = await getPointEarningSettings(storeId);
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching point earning settings via API:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan internal saat memuat pengaturan poin.' }, { status: 500 });
  }
}
