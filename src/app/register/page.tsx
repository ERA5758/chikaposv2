
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/dashboard/logo';
import { Loader, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

const registerSchema = z.object({
  storeName: z.string().min(3, { message: 'Nama toko minimal 3 karakter.' }),
  storeLocation: z.string().min(3, { message: 'Lokasi toko minimal 3 karakter.' }),
  adminName: z.string().min(2, { message: 'Nama Anda minimal 2 karakter.' }),
  email: z.string().email({ message: 'Format email tidak valid.' }),
  whatsapp: z.string().min(10, { message: 'Nomor WhatsApp minimal 10 digit.' }),
  password: z.string().min(6, { message: 'Password minimal 6 karakter.' }),
  referralCode: z.string().optional(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      storeName: '',
      storeLocation: '',
      adminName: '',
      email: '',
      whatsapp: '',
      password: '',
      referralCode: '',
    },
  });

  const handleRegister = async (values: RegisterFormValues) => {
    setIsLoading(true);

    const functionUrl = '/api/register';

    // Generate a unique, URL-friendly slug from the store name
    const catalogSlug = values.storeName
        .toLowerCase()
        .replace(/\s+/g, '-') // Replace spaces with -
        .replace(/[^\w\-]+/g, '') // Remove all non-word chars
        .replace(/\-\-+/g, '-') // Replace multiple - with single -
        .replace(/^-+/, '') // Trim - from start of text
        .replace(/-+$/, '') + '-' + Math.random().toString(36).substring(2, 7); // Add random suffix for uniqueness


    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({...values, catalogSlug }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) { 
        toast({
          title: 'Pendaftaran Berhasil!',
          description: 'Toko dan akun admin Anda telah dibuat. Silakan login.',
        });
        router.push('/login');
      } else {
        const errorMessage = result?.error || "Terjadi kesalahan pada server.";
        throw new Error(errorMessage);
      }

    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        variant: 'destructive',
        title: 'Pendaftaran Gagal',
        description: error.message || "Terjadi kesalahan yang tidak diketahui.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        <Card>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleRegister)}>
              <CardHeader className="text-center">
                <CardTitle className="font-headline text-2xl tracking-wider">DAFTAR TOKO BARU</CardTitle>
                <CardDescription>
                  Lengkapi detail di bawah untuk membuat toko dan akun admin pertama Anda.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <FormField
                  control={form.control}
                  name="storeName"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Nama Toko</Label>
                      <FormControl>
                        <Input placeholder="Contoh: Kopi Chika" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="storeLocation"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Lokasi Toko</Label>
                      <FormControl>
                        <Input placeholder="Contoh: Jakarta" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <hr className="my-2"/>
                <FormField
                  control={form.control}
                  name="adminName"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Nama Lengkap Admin</Label>
                      <FormControl>
                        <Input placeholder="Nama Anda" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Email Admin (untuk login)</Label>
                      <FormControl>
                        <Input type="email" placeholder="email@anda.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Nomor WhatsApp</Label>
                      <FormControl>
                        <Input type="tel" placeholder="08123666xxxx" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Password</Label>
                      <div className="relative">
                        <FormControl>
                          <Input type={showPassword ? 'text' : 'password'} {...field} />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="referralCode"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Kode Referral (Opsional)</Label>
                      <FormControl>
                        <Input placeholder="Kode dari teman Anda" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="flex-col gap-4">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                  Daftarkan Toko Saya
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Sudah punya akun? <Link href="/login" className="font-semibold text-primary hover:underline">Masuk di sini</Link>
                </p>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </main>
  );
}
