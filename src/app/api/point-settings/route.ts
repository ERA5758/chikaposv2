
import { NextRequest, NextResponse } from 'next/server';
import { getPointEarningSettings, defaultPointEarningSettings } from '@/lib/server/point-earning-settings';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const { auth } = getFirebaseAdmin();
    const authorization = req.headers.get('Authorization');
    
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    
    // Although we might not need the user's UID for this specific action,
    // verifying the token is crucial for securing the endpoint.
    await auth.verifyIdToken(idToken);
    
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
        return NextResponse.json({ error: 'Parameter storeId diperlukan.' }, { status: 400 });
    }

    const settings = await getPointEarningSettings(storeId);
    // Ensure that even if getPointEarningSettings returns a partial object or fails,
    // we return a complete, valid object.
    return NextResponse.json({ ...defaultPointEarningSettings, ...settings });
    
  } catch (error) {
    console.error('Error fetching point earning settings via API:', error);
    const errorMessage = (error instanceof Error && (error as any).code === 'auth/id-token-expired') 
        ? 'Sesi Anda telah berakhir, silakan login kembali.'
        : 'Terjadi kesalahan internal.';
    const statusCode = (error instanceof Error && (error as any).code === 'auth/id-token-expired') ? 401 : 500;
    
    return NextResponse.json({ error: errorMessage }, { status: statusCode });
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
