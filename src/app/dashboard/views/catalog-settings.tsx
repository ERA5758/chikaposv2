
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { CheckCircle, ExternalLink, QrCode, Star, Calendar, AlertCircle } from 'lucide-react';
import { useDashboard } from '@/contexts/dashboard-context';
import { Skeleton } from '@/components/ui/skeleton';
import { AIConfirmationDialog } from '@/components/dashboard/ai-confirmation-dialog';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const features = [
  "Tampilan menu modern & profesional yang bisa diakses dari mana saja.",
  "Integrasi QR Code untuk akses cepat dari meja pelanggan.",
  "Asisten AI untuk menjawab pertanyaan dan memberikan rekomendasi menu.",
  "Update menu dan harga secara real-time, tanpa perlu cetak ulang.",
  "Meningkatkan pengalaman pelanggan dan citra modern bisnis Anda.",
];

export default function CatalogSettings() {
  const { activeStore, refreshActiveStore } = useAuth();
  const { dashboardData, isLoading } = useDashboard();
  const { feeSettings } = dashboardData;
  const { toast } = useToast();

  const handleOpenCatalog = () => {
    if (activeStore?.catalogSlug) {
      window.open(`/katalog/${activeStore.catalogSlug}`, '_blank');
    }
  };

  const handleSubscription = async (months: number) => {
    try {
        const idToken = await auth.currentUser?.getIdToken(true);
        if (!idToken || !activeStore) {
            throw new Error("Sesi tidak valid atau toko tidak aktif.");
        }
        
        const response = await fetch('/api/store/subscribe-catalog', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({ storeId: activeStore.id, months: months }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Gagal memproses langganan ${months} bulan.`);
        }
        
        // This is the crucial part: after a successful API call, refresh the store data.
        // This will update the AuthContext, which in turn re-renders this component.
        refreshActiveStore(); 
        return response.json(); // Return the success data to AIConfirmationDialog

    } catch (error) {
        console.error(`Subscription error for ${months} months:`, error);
        // Re-throw to be caught by AIConfirmationDialog's error handler
        throw error;
    }
  };


  if (isLoading || !feeSettings || !activeStore) {
      return (
          <div className="grid gap-6">
              <Skeleton className="h-64 w-full" />
              <div className="grid md:grid-cols-3 gap-6">
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-64 w-full" />
              </div>
          </div>
      )
  }
  
  const originalMonthly = feeSettings.catalogMonthlyFee * 6;
  const sixMonthSaving = originalMonthly > 0 ? originalMonthly - feeSettings.catalogSixMonthFee : 0;

  const originalYearly = feeSettings.catalogMonthlyFee * 12;
  const yearlySaving = originalYearly > 0 ? originalYearly - feeSettings.catalogYearlyFee : 0;

  const expiryDate = activeStore?.catalogSubscriptionExpiry ? new Date(activeStore.catalogSubscriptionExpiry) : null;
  const isSubscriptionActive = expiryDate ? expiryDate > new Date() : false;


  return (
    <div className="grid gap-6">
        {isSubscriptionActive && expiryDate && (
            <Alert className="border-green-500 bg-green-500/10 text-green-700">
                <Calendar className="h-4 w-4" />
                <AlertTitle className="font-semibold">Langganan Katalog Premium Aktif</AlertTitle>
                <AlertDescription>
                    Fitur katalog digital Anda aktif hingga {format(expiryDate, "d MMMM yyyy, HH:mm", { locale: id })}.
                </AlertDescription>
            </Alert>
        )}

        <Card>
            <CardHeader>
                <CardTitle className="font-headline tracking-wider">Katalog Digital Publik</CardTitle>
                <CardDescription>
                    Tingkatkan pengalaman pelanggan dengan menu digital modern, interaktif, dan cerdas yang didukung oleh Chika AI.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Keunggulan & Manfaat</h3>
                    <ul className="space-y-3">
                        {features.map((feature, index) => (
                             <li key={index} className="flex items-start gap-2">
                                <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                 <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-secondary/50 p-6 text-center">
                    <QrCode className="h-20 w-20 text-muted-foreground mb-4" />
                    <h4 className="font-semibold text-lg">Akses QR Code</h4>
                    <p className="text-muted-foreground text-sm">
                        Pelanggan cukup memindai QR Code di meja untuk langsung membuka katalog produk Anda di ponsel mereka.
                    </p>
                    <Button variant="outline" className="mt-4" onClick={handleOpenCatalog} disabled={!isSubscriptionActive}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Lihat Pratinjau Katalog
                    </Button>
                    {!isSubscriptionActive && (
                        <p className="text-xs text-muted-foreground mt-2">Aktifkan langganan untuk melihat pratinjau.</p>
                    )}
                </div>
            </CardContent>
        </Card>

        <Card>
             <CardHeader className="text-center">
                <CardTitle className="font-headline tracking-wider">Paket Langganan</CardTitle>
                <CardDescription>
                    Pilih paket yang paling sesuai dengan kebutuhan bisnis Anda untuk mengaktifkan fitur ini.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-6">
                {/* Monthly Package */}
                <Card>
                    <CardHeader className="text-center">
                        <CardTitle className="text-xl">Bulanan</CardTitle>
                        <CardDescription>Fleksibel & Terjangkau</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-4xl font-bold">{feeSettings.catalogMonthlyFee} <span className="text-base font-normal text-muted-foreground">Token/bulan</span></p>
                    </CardContent>
                    <CardFooter>
                        <AIConfirmationDialog
                          featureName="Langganan Bulanan"
                          featureDescription={`Anda akan mengaktifkan atau memperpanjang langganan Katalog Digital Premium selama 1 bulan.`}
                          feeSettings={feeSettings}
                          feeToDeduct={feeSettings.catalogMonthlyFee}
                          onConfirm={() => handleSubscription(1)}
                          skipFeeDeduction={true}
                        >
                            <Button className="w-full" variant="outline">Pilih Paket</Button>
                        </AIConfirmationDialog>
                    </CardFooter>
                </Card>

                 {/* 6-Month Package */}
                 <Card className="border-primary shadow-lg relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                            <Star className="h-3 w-3" /> Paling Populer
                        </div>
                    </div>
                    <CardHeader className="text-center">
                        <CardTitle className="text-xl">Setengah Tahun</CardTitle>
                        <CardDescription>Pilihan Terbaik</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-4xl font-bold">{feeSettings.catalogSixMonthFee} <span className="text-base font-normal text-muted-foreground">Token/6 bulan</span></p>
                        {sixMonthSaving > 0 && (
                            <p className="text-sm text-muted-foreground">Hemat {sixMonthSaving} Token!</p>
                        )}
                    </CardContent>
                    <CardFooter>
                         <AIConfirmationDialog
                          featureName="Langganan 6 Bulan"
                          featureDescription={`Anda akan mengaktifkan atau memperpanjang langganan Katalog Digital Premium selama 6 bulan.`}
                          feeSettings={feeSettings}
                          feeToDeduct={feeSettings.catalogSixMonthFee}
                          onConfirm={() => handleSubscription(6)}
                          skipFeeDeduction={true}
                        >
                           <Button className="w-full">Pilih Paket</Button>
                        </AIConfirmationDialog>
                    </CardFooter>
                </Card>

                 {/* Yearly Package */}
                 <Card>
                    <CardHeader className="text-center">
                        <CardTitle className="text-xl">Tahunan</CardTitle>
                        <CardDescription>Nilai Paling Hemat</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-4xl font-bold">{feeSettings.catalogYearlyFee} <span className="text-base font-normal text-muted-foreground">Token/tahun</span></p>
                         {yearlySaving > 0 && (
                            <p className="text-sm text-muted-foreground">Hemat {yearlySaving} Token!</p>
                        )}
                    </CardContent>
                    <CardFooter>
                         <AIConfirmationDialog
                          featureName="Langganan Tahunan"
                          featureDescription={`Anda akan mengaktifkan atau memperpanjang langganan Katalog Digital Premium selama 1 tahun.`}
                          feeSettings={feeSettings}
                          feeToDeduct={feeSettings.catalogYearlyFee}
                          onConfirm={() => handleSubscription(12)}
                          skipFeeDeduction={true}
                        >
                            <Button className="w-full" variant="outline">Pilih Paket</Button>
                        </AIConfirmationDialog>
                    </CardFooter>
                </Card>
            </CardContent>
        </Card>
    </div>
  );
}
