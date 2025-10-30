
import { NextRequest, NextResponse } from 'next/server';
import { getTransactionFeeSettings } from '@/lib/server/app-settings';
import { getBankAccountSettings } from '@/lib/bank-account-settings';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');

  try {
    if (type === 'bank') {
        const settings = await getBankAccountSettings();
        return NextResponse.json(settings);
    }
    
    // Default to transaction fee settings if no type or other type is specified
    const settings = await getTransactionFeeSettings();
    return NextResponse.json(settings);

  } catch (error) {
    console.error('Error fetching app settings:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
