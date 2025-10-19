import { NextRequest, NextResponse } from 'next/server';
import { getPointEarningSettings, updatePointEarningSettings } from '@/lib/server/point-earning-settings';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';

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

export async function POST(req: NextRequest) {
    try {
        const { auth } = getFirebaseAdmin();
        const authorization = req.headers.get('Authorization');
        if (!authorization?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authorization.split('Bearer ')[1];
        await auth.verifyIdToken(idToken);

        const { storeId, settings } = await req.json();
        if (!storeId || !settings || typeof settings.rpPerPoint !== 'number') {
            return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
        }

        await updatePointEarningSettings(storeId, { rpPerPoint: settings.rpPerPoint });
        
        return NextResponse.json({ success: true, message: 'Pengaturan poin berhasil diperbarui.' });

    } catch (error) {
        console.error('Error updating point earning settings via API:', error);
        return NextResponse.json({ error: (error as Error).message || 'Terjadi kesalahan internal.' }, { status: 500 });
    }
}
