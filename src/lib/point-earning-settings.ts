
'use client';

export type PointEarningSettings = {
    rpPerPoint: number;
};

// Static settings to avoid API calls and ensure stability.
export const pointEarningSettings: PointEarningSettings = {
    rpPerPoint: 10000, // Default: 1 point for every Rp 10.000 spent
};
