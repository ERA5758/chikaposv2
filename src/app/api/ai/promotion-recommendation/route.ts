import { NextRequest, NextResponse } from 'next/server';
import { promotionRecommendationFlow } from '@/ai/flows/promotion-recommendation';
import type { PromotionRecommendationInput } from '@/ai/flows/promotion-recommendation';

export async function POST(request: NextRequest) {
  const input: PromotionRecommendationInput = await request.json();

  const { businessDescription, activeStoreName, currentRedemptionOptions, topSellingProducts, worstSellingProducts, allProductNames } = input;

  if (!businessDescription || !activeStoreName || !currentRedemptionOptions || !topSellingProducts || !worstSellingProducts || !allProductNames) {
    return NextResponse.json({ error: 'Missing required input parameters' }, { status: 400 });
  }

  try {
    const result = await promotionRecommendationFlow(input);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in promotionRecommendationFlow API route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get promotion recommendations';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
