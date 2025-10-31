
'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { Loader, KeyRound, UserCircle, Building, Eye, EyeOff, Save, Play, MessageSquareQuote, Zap, Info, Newspaper, Sparkles, Percent, HandCoins } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useDashboard } from '@/contexts/dashboard-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getReceiptSettings, updateReceiptSettings } from '@/lib/receipt-settings';
import type { ReceiptSettings, NotificationSettings, FinancialSettings } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FirebaseError } from 'firebase/app';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AIConfirmationDialog } from '@/components/dashboard/ai-confirmation-dialog';
import type { TextToSpeechInput, TextToSpeechOutput } from '@/ai/flows/text-to-speech';

const PasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Password saat ini harus diisi.'),
    newPassword: z
      .string()
      .min(8, 'Password baru harus minimal 8 karakter.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Password baru tidak cocok.',
    path: ['confirmPassword'],
  });
  
const availableGenders = [
    { value: 'female', label: 'Suara Wanita' },
    { value: 'male', label: 'Suara Pria' },
];

function ProfileCardSkeleton() {
    return (
        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle className="font-headline tracking-wider">Profil Anda</CardTitle>
                <CardDescription>Informasi akun Anda yang sedang login.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-[80px]" />
                        <Skeleton className="h-5 w-[150px]" />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-[50px]" />
                        <Skeleton className="h-5 w-[80px]" />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-[60px]" />
                        <Skeleton className="h-5 w-[120px]" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export default function Settings() {
  const { currentUser, activeStore, isLoading: isAuthLoading, updateActiveStore } = useAuth();
  const { dashboardData } = useDashboard();
  const { products, feeSettings } = dashboardData;
  
  const [isPasswordChangeLoading, setIsPasswordChangeLoading] = React.useState(false);
  const [isGeneralSettingLoading, setIsGeneralSettingLoading] = React.useState(false);
  const [isSamplePlaying, setIsSamplePlaying] = React.useState(false);
  const [generalSettings, setGeneralSettings] = React.useState<Pick<ReceiptSettings, 'voiceGender' | 'notificationStyle'> | null>(null);
  const [financialSettings, setFinancialSettings] = React.useState<FinancialSettings | null>(null);
  const [businessDescription, setBusinessDescription] = React.useState('');
  
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const { toast } = useToast();
  
  React.useEffect(() => {
    if (activeStore) {
        getReceiptSettings(activeStore.id).then(settings => {
            setGeneralSettings({ 
                voiceGender: settings.voiceGender,
                notificationStyle: settings.notificationStyle
            });
        });
        setBusinessDescription(activeStore.businessDescription || '');
        setFinancialSettings(activeStore.financialSettings || { taxPercentage: 0, serviceFeePercentage: 0 });
    }
  }, [activeStore]);

  const passwordForm = useForm<z.infer<typeof PasswordFormSchema>>({
    resolver: zodResolver(PasswordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const handlePasswordChange = async (
    values: z.infer<typeof PasswordFormSchema>
  ) => {
    setIsPasswordChangeLoading(true);
    const user = auth.currentUser;

    if (!user || !user.email) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Tidak ada pengguna yang login. Silakan login ulang.',
      });
      setIsPasswordChangeLoading(false);
      return;
    }

    const credential = EmailAuthProvider.credential(
      user.email,
      values.currentPassword
    );

    try {
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, values.newPassword);
      toast({
        title: 'Berhasil!',
        description: 'Password Anda telah berhasil diubah.',
      });
      passwordForm.reset();
    } catch (error) {
      let description = 'Terjadi kesalahan. Silakan coba lagi.';
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          description = 'Password Anda saat ini salah.';
        }
      }
      toast({
        variant: 'destructive',
        title: 'Gagal Mengubah Password',
        description: description,
      });
    } finally {
      setIsPasswordChangeLoading(false);
    }
  };
  
  const handleGeneralSettingSave = async () => {
    if (!activeStore || !generalSettings || !financialSettings) return;
    setIsGeneralSettingLoading(true);
    try {
        const storeRef = doc(db, 'stores', activeStore.id);
        const updates = {
            businessDescription: businessDescription,
            financialSettings: financialSettings,
        };
        await setDoc(storeRef, updates, { merge: true });
  
      await updateReceiptSettings(activeStore.id, {
        voiceGender: generalSettings.voiceGender,
        notificationStyle: generalSettings.notificationStyle,
      });
  
      toast({ title: 'Pengaturan Umum Disimpan!' });
      updateActiveStore(updates);

    } catch (error) {
      console.error("Error saving general settings:", error);
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: (error as Error).message });
    } finally {
      setIsGeneralSettingLoading(false);
    }
  };
  
  const handlePlaySample = async () => {
    if (!generalSettings?.voiceGender) return;
    setIsSamplePlaying(true);
    try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Authentication token not available.");

        const response = await fetch('/api/ai/text-to-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ text: "Ini adalah contoh suara saya. Terima kasih.", gender: generalSettings.voiceGender }),
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to generate audio.');
        }

        const result: TextToSpeechOutput = await response.json();
        const audio = new Audio(result.audioDataUri);
        audio.play();

    } catch (error) {
        console.error("Error playing voice sample:", error);
        toast({ variant: 'destructive', title: 'Gagal Memutar Suara', description: 'Tidak dapat menghasilkan sampel suara saat ini.' });
    } finally {
        setIsSamplePlaying(false);
    }
  };
  
  const handleGenerateDescription = async (): Promise<{ description: string }> => {
    if (!activeStore) throw new Error("Toko tidak aktif");
    const topProducts = (products || []).slice(0, 5).map(p => p.name);
    
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error("Authentication token not available.");

    const response = await fetch('/api/ai/description-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ storeName: activeStore.name, productList: topProducts }),
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate description.');
    }
    
    return response.json();
  };

  return (
    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
      {isAuthLoading ? (
        <ProfileCardSkeleton />
      ) : (
        <Card className="lg:col-span-1">
            <CardHeader>
            <CardTitle className="font-headline tracking-wider">
                Profil Anda
            </CardTitle>
            <CardDescription>
                Informasi akun Anda yang sedang login.
            </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
                <UserCircle className="h-6 w-6 text-muted-foreground" />
                <div>
                    <p className='text-sm text-muted-foreground'>Nama</p>
                    <p className="font-semibold">{currentUser?.name}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <KeyRound className="h-6 w-6 text-muted-foreground" />
                <div>
                    <p className='text-sm text-muted-foreground'>Jabatan</p>
                    <p className="font-semibold capitalize">{currentUser?.role}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <Building className="h-6 w-6 text-muted-foreground" />
                <div>
                    <p className='text-sm text-muted-foreground'>Toko Utama</p>
                    <p className="font-semibold">{activeStore?.name || (currentUser?.role === 'admin' ? 'Global' : '-')}</p>
                </div>
            </div>
            </CardContent>
        </Card>
      )}

      <div className="lg:col-span-2 grid gap-6">
        {currentUser?.role === 'admin' && (
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline tracking-wider">Pengaturan Umum</CardTitle>
                    <CardDescription>Pengaturan ini akan memengaruhi cara kerja fitur AI di toko Anda.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor='business-description' className='flex items-center gap-2'><Info className='h-4 w-4' /> Deskripsi Singkat Bisnis</Label>
                        <div className="flex items-start gap-2">
                            <Textarea 
                                id='business-description'
                                placeholder='Contoh: Kafe modern dengan kopi spesialti dan kue buatan sendiri.'
                                value={businessDescription}
                                onChange={(e) => setBusinessDescription(e.target.value)}
                                className="flex-grow"
                            />
                             <AIConfirmationDialog
                                featureName="Deskripsi Bisnis"
                                featureDescription="Chika AI akan membuat deskripsi singkat untuk bisnis Anda berdasarkan nama dan produk terlaris."
                                feeSettings={feeSettings}
                                onConfirm={handleGenerateDescription}
                                onSuccess={(result) => setBusinessDescription(result.description)}
                              >
                                <Button variant="outline" size="icon">
                                  <Sparkles className="h-4 w-4" />
                                </Button>
                              </AIConfirmationDialog>
                        </div>
                        <p className="text-xs text-muted-foreground">Berikan AI konteks tentang jenis bisnis Anda untuk rekomendasi yang lebih relevan.</p>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor='tax-percentage' className='flex items-center gap-2'><Percent className='h-4 w-4' /> Pajak (Tax %)</Label>
                          <Input
                            id='tax-percentage'
                            type='number'
                            step="0.1"
                            value={financialSettings?.taxPercentage ?? 0}
                            onChange={(e) => setFinancialSettings(s => s ? { ...s, taxPercentage: parseFloat(e.target.value) || 0 } : null)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor='service-fee' className='flex items-center gap-2'><HandCoins className='h-4 w-4' /> Biaya Layanan (%)</Label>
                          <Input
                            id='service-fee'
                            type='number'
                            step="0.1"
                            value={financialSettings?.serviceFeePercentage ?? 0}
                            onChange={(e) => setFinancialSettings(s => s ? { ...s, serviceFeePercentage: parseFloat(e.target.value) || 0 } : null)}
                          />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Gender Suara Panggilan</Label>
                        {generalSettings ? (
                            <div className="flex items-center gap-2">
                                 <Select
                                    value={generalSettings.voiceGender}
                                    onValueChange={(value: 'male' | 'female') => setGeneralSettings(s => s ? {...s, voiceGender: value} : null)}
                                 >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih gender..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableGenders.map(gender => (
                                            <SelectItem key={gender.value} value={gender.value}>
                                                {gender.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handlePlaySample}
                                    disabled={isSamplePlaying}
                                    aria-label="Play voice sample"
                                >
                                    {isSamplePlaying ? <Loader className="h-4 w-4 animate-spin"/> : <Play className="h-4 w-4" />}
                                </Button>
                            </div>
                        ) : <Skeleton className="h-10 w-full" />}
                       
                    </div>
                     <div className="space-y-2">
                        <Label>Gaya Pesan Notifikasi</Label>
                        {generalSettings ? (
                           <RadioGroup
                                value={generalSettings.notificationStyle}
                                onValueChange={(value: 'fakta' | 'pantun') => setGeneralSettings(s => s ? {...s, notificationStyle: value} : null)}
                                className="flex gap-4 pt-2"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="fakta" id="fakta" />
                                    <Label htmlFor="fakta" className="flex items-center gap-2 font-normal"><Zap/> Fakta Menarik</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="pantun" id="pantun" />
                                    <Label htmlFor="pantun" className="flex items-center gap-2 font-normal"><MessageSquareQuote /> Pantun Unik</Label>
                                </div>
                            </RadioGroup>
                        ) : <Skeleton className="h-10 w-full" />}
                    </div>
                     <Button onClick={handleGeneralSettingSave} disabled={isGeneralSettingLoading}>
                        {isGeneralSettingLoading && <Loader className="mr-2 h-4 w-4 animate-spin"/>}
                        <Save className="mr-2 h-4 w-4" />
                        Simpan Pengaturan
                    </Button>
                </CardContent>
            </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="font-headline tracking-wider">
              Ubah Password
            </CardTitle>
            <CardDescription>
              Untuk keamanan, masukkan password Anda saat ini sebelum membuat
              yang baru.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form
                onSubmit={passwordForm.handleSubmit(handlePasswordChange)}
                className="space-y-6 max-w-md"
              >
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password Saat Ini</FormLabel>
                      <div className="relative">
                          <FormControl>
                          <Input type={showCurrentPassword ? 'text' : 'password'} {...field} />
                          </FormControl>
                          <Button 
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          >
                              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password Baru</FormLabel>
                       <div className="relative">
                          <FormControl>
                          <Input type={showNewPassword ? 'text' : 'password'} {...field} />
                          </FormControl>
                          <Button 
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                          >
                              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Konfirmasi Password Baru</FormLabel>
                      <div className="relative">
                          <FormControl>
                          <Input type={showConfirmPassword ? 'text' : 'password'} {...field} />
                          </FormControl>
                          <Button 
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isPasswordChangeLoading}>
                  {isPasswordChangeLoading && (
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Simpan Password Baru
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
