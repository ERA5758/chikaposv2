
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { productCategories } from '@/lib/types';
import type { UserRole, Store } from '@/lib/types';
import * as React from 'react';
import { Loader, ScanBarcode, Upload } from 'lucide-react';
import { BarcodeScanner } from './barcode-scanner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { db, storage } from '@/lib/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { Textarea } from '../ui/textarea';

const FormSchema = z.object({
  name: z.string().min(2, {
    message: 'Name must be at least 2 characters.',
  }),
  category: z.enum(productCategories),
  description: z.string().optional(),
  barcode: z.string().optional(),
  price: z.coerce.number().min(0, "Harga harus diisi"),
  costPrice: z.coerce.number().min(0).optional(),
  brand: z.string().min(2, {
    message: 'Brand must be at least 2 characters.',
  }),
  stock: z.coerce.number().min(0, 'Stock awal harus diisi.')
});

type AddProductFormProps = {
  setDialogOpen: (open: boolean) => void;
  userRole: UserRole;
  onProductAdded: () => void;
  activeStore: Store;
};

export function AddProductForm({ setDialogOpen, userRole, onProductAdded, activeStore }: AddProductFormProps) {
  const { toast } = useToast();
  const [isScannerOpen, setIsScannerOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isAdmin = userRole === 'admin';

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      barcode: '',
      price: 0,
      costPrice: 0,
      brand: '',
      stock: 1,
      description: '',
    },
  });

  const handleBarcodeScanned = (barcode: string) => {
    form.setValue('barcode', barcode);
    toast({
      title: 'Barcode Terbaca!',
      description: `SKU ${barcode} telah diisi.`,
    });
    setIsScannerOpen(false);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };


  async function onSubmit(data: z.infer<typeof FormSchema>) {
    if (!imageFile) {
        toast({ variant: 'destructive', title: 'Gambar Produk Wajib', description: 'Silakan pilih gambar untuk produk.'});
        return;
    }
    setIsLoading(true);

    const costPrice = !isAdmin ? data.price : data.costPrice;
    
    try {
        // Create a safe, unique filename
        const fileExtension = imageFile.name.split('.').pop();
        const safeFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;

        // Upload image to Firebase Storage with the safe filename
        const imageRef = ref(storage, `products/${activeStore.id}/${safeFileName}`);
        await uploadBytes(imageRef, imageFile);
        const imageUrl = await getDownloadURL(imageRef);

        await addDoc(collection(db, 'stores', activeStore.id, 'products'), {
            name: data.name,
            category: data.category,
            description: data.description || '',
            price: data.price,
            costPrice: costPrice,
            stock: data.stock,
            supplierId: '',
            imageUrl: imageUrl,
            imageHint: '', // Hint is not needed for user-uploaded images
            attributes: { 
                brand: data.brand,
                barcode: data.barcode || '',
            }
        });
        
        toast({
            title: 'Produk Berhasil Ditambahkan!',
            description: `${data.name} telah ditambahkan ke toko ${activeStore.name}.`,
        });

        onProductAdded();
        setDialogOpen(false);

    } catch (error) {
        console.error("Error adding product:", error);
        toast({
            variant: 'destructive',
            title: 'Gagal Menambahkan Produk',
            description: 'Terjadi kesalahan saat menyimpan produk. Silakan coba lagi.',
        });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <>
    <div className="max-h-[80vh] overflow-y-auto pr-6 pl-2 -mr-6 -ml-2">
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormItem>
            <FormLabel>Foto Produk</FormLabel>
            <div 
                className="mt-2 flex justify-center items-center w-full h-48 rounded-md border-2 border-dashed border-input cursor-pointer bg-secondary/50 hover:bg-secondary/70"
                onClick={() => fileInputRef.current?.click()}
            >
                {imagePreview ? (
                    <Image src={imagePreview} alt="Pratinjau produk" width={192} height={192} className="h-full w-full object-contain rounded-md" />
                ) : (
                    <div className="text-center text-muted-foreground">
                        <Upload className="mx-auto h-10 w-10" />
                        <p>Klik untuk memilih gambar</p>
                    </div>
                )}
            </div>
            <FormControl>
                <Input 
                    ref={fileInputRef}
                    type="file" 
                    className="hidden" 
                    onChange={handleFileChange}
                    accept="image/png, image/jpeg, image/webp"
                />
            </FormControl>
            <FormMessage />
        </FormItem>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Produk</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Kopi Susu" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="brand"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Merek</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Chika Coffee" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kategori</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {productCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Deskripsi (Opsional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Contoh: Perpaduan kopi dan susu yang nikmat..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="barcode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Barcode (SKU)</FormLabel>
                <div className="flex gap-2">
                    <FormControl>
                        <Input placeholder="e.g., 899..." {...field} />
                    </FormControl>
                    <Button variant="outline" size="icon" type="button" onClick={() => setIsScannerOpen(true)}>
                        <ScanBarcode className="h-4 w-4" />
                        <span className="sr-only">Scan Barcode</span>
                    </Button>
                </div>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {isAdmin && (
            <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Harga Pokok (Rp)</FormLabel>
                    <FormControl>
                    <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        )}
        
        <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Harga Jual (Rp)</FormLabel>
                <FormControl>
                    <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />

        <FormField
            control={form.control}
            name="stock"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Stok Awal</FormLabel>
                <FormControl>
                    <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />


        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
          Tambahkan Produk
        </Button>
      </form>
    </Form>
    </div>
    
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="sm:max-w-[425px] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline tracking-wider">Scan Barcode</DialogTitle>
            <DialogDescription>
              Arahkan kamera ke barcode produk untuk mengambil SKU.
            </DialogDescription>
          </DialogHeader>
          <BarcodeScanner onScan={handleBarcodeScanned} />
        </DialogContent>
      </Dialog>
    </>
  );
}
