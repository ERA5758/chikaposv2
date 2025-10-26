
import { NextRequest, NextResponse } from 'next/server';
import { searchImages } from '@/ai/flows/image-search-flow';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const result = await searchImages({ query });
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in image-search API route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to search for images';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
