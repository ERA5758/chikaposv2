import { NextResponse } from 'next/server';
import { getTransactionFeeSettings } from '@/lib/server/app-settings';

export async function GET() {
    try {
        const settings = await getTransactionFeeSettings();
        return NextResponse.json(settings);
    } catch (error) {
        console.error("Error in app-settings API route:", error);
        return NextResponse.json({ error: 'Failed to fetch app settings' }, { status: 500 });
    }
}
