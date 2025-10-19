
'use client';

import * as React from 'react';
import type { Store, Product, ProductCategory, RedemptionOption, Customer, OrderPayload } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Image from 'next/image';
import { UtensilsCrossed, PackageX, MessageCircle, Sparkles, Send, Loader, Gift, ShoppingCart, PlusCircle, MinusCircle, XCircle, LogIn, UserCircle, LogOut, Crown, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ReactMarkdown from 'react-markdown';
import { CatalogAssistantInput, CatalogAssistantOutput } from '@/lib/types';
import { useParams } from 'next/navigation';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import Autoplay from "embla-carousel-autoplay"
import { cn } from '@/lib/utils';
import { CustomerAuthDialog } from '@/components/catalog/customer-auth-dialog';
import { useToast } from '@/hooks/use-toast';
import { getPointEarningSettings, PointEarningSettings } from '@/lib/point-earning-settings';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


type CartItem = {
    productId: string;
    name: string;
    price: number;
    quantity: number;
};

function groupProducts(products: Product[]): Record<string, Product[]> {
    return products.reduce((acc, product) => {
        const category = product.category || 'Lainnya';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(product);
        return acc;
    }, {} as Record<ProductCategory, Product[]>);
}


type ChatMessage = {
  sender: 'user' | 'ai';
  text: string;
};

function CatalogAIChat({ store, products, open, onOpenChange }: { store: Store, products: Product[], open: boolean, onOpenChange: (open: boolean) => void }) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  
  const initialMessage = `Halo! Saya asisten AI dari ${store.name}. Ada yang bisa saya bantu terkait menu kami?`;

  React.useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ sender: 'ai', text: initialMessage }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  
  React.useEffect(() => {
    if (scrollAreaRef.current) {
        setTimeout(() => {
            const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
            if (viewport) viewport.scrollTop = viewport.scrollHeight;
        }, 100);
    }
}, [messages]);

  const productContext = React.useMemo(() => {
    return products.map(p => ({
        name: p.name,
        category: p.category,
        description: p.description || '',
        price: p.price,
        stock: p.stock,
    }));
  }, [products]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const newMessages: ChatMessage[] = [...messages, { sender: 'user', text: input }];
    setMessages(newMessages);
    const question = input;
    setInput('');
    setIsLoading(true);

    try {
        const payload: CatalogAssistantInput = {
            userQuestion: question,
            productContext: productContext,
            storeName: store.name,
        };

        const response = await fetch('/api/catalog-assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Gagal mendapatkan jawaban dari AI.');
        }

        const result: CatalogAssistantOutput = await response.json();
        setMessages(prev => [...prev, { sender: 'ai', text: result.answer }]);

    } catch (error) {
        setMessages(prev => [...prev, { sender: 'ai', text: `Maaf, terjadi kesalahan: ${(error as Error).message}` }]);
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md flex flex-col h-screen sm:h-[80vh]">
        <DialogHeader>
          <DialogTitle className="font-headline tracking-wider flex items-center gap-2">
            <Sparkles className="text-primary"/> Asisten AI - {store.name}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-grow pr-4 -mr-4" ref={scrollAreaRef}>
            <div className="space-y-4">
                {messages.map((message, index) => (
                    <div key={index} className={`flex items-start gap-2 ${message.sender === 'user' ? 'justify-end' : ''}`}>
                         {message.sender === 'ai' && (
                            <Avatar className='h-8 w-8'>
                                <AvatarFallback className='bg-primary text-primary-foreground'><Sparkles className='h-5 w-5'/></AvatarFallback>
                            </Avatar>
                        )}
                        <div className={`rounded-lg p-3 max-w-[80%] ${message.sender === 'ai' ? 'bg-secondary' : 'bg-primary text-primary-foreground'}`}>
                             <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">{message.text}</ReactMarkdown>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-2">
                        <Avatar className='h-8 w-8'>
                            <AvatarFallback className='bg-primary text-primary-foreground'><Sparkles className='h-5 w-5'/></AvatarFallback>
                        </Avatar>
                         <div className="rounded-lg p-3 bg-secondary">
                            <Loader className="h-5 w-5 animate-spin" />
                        </div>
                    </div>
                )}
            </div>
        </ScrollArea>
        <DialogFooter>
            <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
                <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tanya tentang menu..." disabled={isLoading} />
                <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                    <Send className="h-4 w-4" />
                </Button>
            </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PromotionSection({ promotions }: { promotions: RedemptionOption[] }) {
    if (promotions.length === 0) return null;

    if (promotions.length === 1) {
        const promo = promotions[0];
        return (
            <section className="mb-8">
                 <Card className="bg-primary/10 border-primary/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-primary"><Gift /> Promo Spesial!</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-lg font-semibold">{promo.description}</p>
                        <p className="text-muted-foreground">Tukarkan dengan {promo.pointsRequired.toLocaleString('id-ID')} Poin</p>
                    </CardContent>
                </Card>
            </section>
        )
    }

    return (
        <section className="mb-8">
            <Carousel
                plugins={[
                    Autoplay({
                        delay: 5000,
                    }),
                ]}
                className="w-full"
            >
                <CarouselContent>
                    {promotions.map((promo) => (
                        <CarouselItem key={promo.id}>
                            <Card className="bg-primary/10 border-primary/30">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-primary"><Gift /> Promo Spesial!</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg font-semibold">{promo.description}</p>
                                    <p className="text-muted-foreground">Tukarkan dengan {promo.pointsRequired.toLocaleString('id-ID')} Poin</p>
                                </CardContent>
                            </Card>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious className="left-2" />
                <CarouselNext className="right-2" />
            </Carousel>
        </section>
    );
}

export default function CatalogPage() {
    const params = useParams();
    const slug = params?.slug as string;
    const { toast } = useToast();
    const [store, setStore] = React.useState<Store | null>(null);
    const [products, setProducts] = React.useState<Product[]>([]);
    const [promotions, setPromotions] = React.useState<RedemptionOption[]>([]);
    const [pointSettings, setPointSettings] = React.useState<PointEarningSettings | null>(null);
    const [error, setError] = React.useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isChatOpen, setIsChatOpen] = React.useState(false);
    const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
    const [cart, setCart] = React.useState<CartItem[]>([]);
    const [isSubmittingOrder, setIsSubmittingOrder] = React.useState(false);
    
    // --- Start Customer Auth State ---
    const [isAuthDialogOpen, setIsAuthDialogOpen] = React.useState(false);
    const [loggedInCustomer, setLoggedInCustomer] = React.useState<Customer | null>(null);
    const sessionKey = `chika-customer-session-${slug}`;
    // --- End Customer Auth State ---


    React.useEffect(() => {
        if (!slug) return;
        async function fetchData() {
            setIsLoading(true);
            setError(undefined); // Reset error state on new fetch
            try {
                const response = await fetch(`/api/catalog-data?slug=${slug}`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Gagal memuat data katalog.');
                }
                const data = await response.json();
                if (data.error) {
                    throw new Error(data.error);
                }

                setStore(data.store);
                setProducts(data.products);
                setPromotions(data.promotions);
                
                if (data.store?.id) {
                    const settings = await getPointEarningSettings(data.store.id);
                    setPointSettings(settings);
                }

            } catch (e) {
                setError((e as Error).message);
                setStore(null);
                setProducts([]);
                setPromotions([]);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
        
        const savedSession = localStorage.getItem(sessionKey);
        if (savedSession) {
            setLoggedInCustomer(JSON.parse(savedSession));
        }

    }, [slug, sessionKey]);
    
    const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);
    const cartSubtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
    const pointsEarned = pointSettings ? Math.floor(cartSubtotal / pointSettings.rpPerPoint) : 0;

    const handleLoginSuccess = (customer: Customer) => {
        setLoggedInCustomer(customer);
        localStorage.setItem(sessionKey, JSON.stringify(customer));
        setIsAuthDialogOpen(false);
        toast({
            title: `Selamat Datang, ${customer.name}!`,
            description: "Anda berhasil masuk. Sekarang Anda bisa memesan langsung.",
        });
    };
    
    const handleLogout = () => {
        setLoggedInCustomer(null);
        localStorage.removeItem(sessionKey);
        toast({
            title: "Anda telah keluar.",
        });
    };


    const addToCart = (product: Product) => {
        setCart(currentCart => {
            const existingItem = currentCart.find(item => item.productId === product.id);
            if (existingItem) {
                return currentCart.map(item =>
                    item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...currentCart, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
        });
    };

    const updateQuantity = (productId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            setCart(currentCart => currentCart.filter(item => item.productId !== productId));
        } else {
            setCart(currentCart =>
                currentCart.map(item =>
                    item.productId === productId ? { ...item, quantity: newQuantity } : item
                )
            );
        }
    };
    
    const handleCreateOrder = async () => {
        if (!loggedInCustomer || !store || cart.length === 0) return;
        setIsSubmittingOrder(true);
        try {
            const payload: OrderPayload = {
                storeId: store.id,
                customer: loggedInCustomer,
                cart: cart,
                subtotal: cartSubtotal,
                totalAmount: cartSubtotal,
                pointsEarned: pointsEarned,
            };
            const response = await fetch('/api/catalog/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Gagal membuat pesanan.');
            }
            toast({
                title: 'Pesanan Berhasil Dibuat!',
                description: 'Pesanan Anda sedang diproses oleh dapur. Silakan tunggu notifikasi selanjutnya.',
            });
            setCart([]);
            // Close the sheet - this requires more state management or a ref, so we'll skip for now
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Gagal Membuat Pesanan',
                description: (error as Error).message,
            });
        } finally {
            setIsSubmittingOrder(false);
        }
    };


    const categories = React.useMemo(() => {
        const uniqueCategories = new Set(products.map(p => p.category));
        return ['Semua', ...Array.from(uniqueCategories)];
    }, [products]);
    
    const filteredProducts = React.useMemo(() => {
        if (!selectedCategory || selectedCategory === 'Semua') {
            return groupProducts(products);
        }
        return {
            [selectedCategory]: products.filter(p => p.category === selectedCategory)
        };
    }, [products, selectedCategory]);

    if (isLoading) {
        return (
             <div className="flex min-h-screen items-center justify-center bg-secondary">
                 <Loader className="h-8 w-8 animate-spin text-primary"/>
            </div>
        )
    }

    if (error || !store) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
                <Alert variant="destructive" className="w-auto max-w-md">
                    <UtensilsCrossed className="h-4 w-4" />
                    <AlertTitle>Katalog Tidak Tersedia</AlertTitle>
                    <AlertDescription>{error || "Katalog yang Anda cari tidak dapat ditemukan."}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <>
        <Sheet>
        <div className="min-h-screen bg-background">
            <header className="p-4 border-b text-center sticky top-0 bg-background/80 backdrop-blur-sm z-10">
                <div className="flex justify-between items-center container mx-auto max-w-4xl">
                     <div className="w-24 text-left">
                        {loggedInCustomer && (
                            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
                                <LogOut className="mr-2 h-4 w-4" />
                                Keluar
                            </Button>
                        )}
                    </div>
                    <div className='text-center'>
                         <h1 className="text-3xl font-headline tracking-wider font-bold">{store.name}</h1>
                         <p className="text-muted-foreground">{store.location}</p>
                    </div>
                     <div className="w-24 text-right">
                        {loggedInCustomer ? (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <div className='text-sm font-semibold flex items-center justify-end gap-2 cursor-pointer' role="button">
                                        <UserCircle className="h-5 w-5" />
                                        <span className='truncate'>{loggedInCustomer.name.split(' ')[0]}</span>
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-4 mr-4 space-y-2">
                                    <h4 className="font-medium leading-none">{loggedInCustomer.name}</h4>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Coins className="h-4 w-4 text-primary" /> Poin Anda: <span className="font-bold text-primary">{loggedInCustomer.loyaltyPoints}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Crown className="h-4 w-4 text-amber-500" /> Tier: <span className="font-bold text-foreground">{loggedInCustomer.memberTier}</span>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        ) : (
                            <Button variant="outline" size="sm" onClick={() => setIsAuthDialogOpen(true)}>
                                <LogIn className="mr-2 h-4 w-4" />
                                Login
                            </Button>
                        )}
                    </div>
                </div>
            </header>
            
            <main className="container mx-auto max-w-4xl p-4 md:p-8">
                 <PromotionSection promotions={promotions} />
                 
                {products.length > 0 && (
                    <div className="mb-8">
                        <ScrollArea className="w-full whitespace-nowrap">
                             <div className="flex space-x-2 pb-4">
                                {categories.map(category => (
                                    <Button
                                        key={category}
                                        variant={(selectedCategory === category || (selectedCategory === null && category === 'Semua')) ? 'default' : 'outline'}
                                        onClick={() => setSelectedCategory(category === 'Semua' ? null : category)}
                                        className="shrink-0"
                                    >
                                        {category}
                                    </Button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                 {products.length > 0 ? (
                    <div className="space-y-12">
                        {Object.entries(filteredProducts).map(([category, productsInCategory]) => (
                            <section key={category} id={category.replace(/\s+/g, '-')}>
                                <h2 className="text-2xl font-bold font-headline mb-6 border-b-2 border-primary pb-2">{category}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {productsInCategory.map(product => {
                                        const itemInCart = cart.find(item => item.productId === product.id);
                                        return (
                                        <Card key={product.id} className="overflow-hidden group flex flex-col">
                                            <div className="relative aspect-square">
                                                <Image src={product.imageUrl} alt={product.name} fill className="object-cover transition-transform group-hover:scale-105" unoptimized/>
                                                {product.stock === 0 && (
                                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                      <div className="text-center text-white">
                                                        <PackageX className="mx-auto h-8 w-8" />
                                                        <p className="font-bold">Stok Habis</p>
                                                      </div>
                                                    </div>
                                                )}
                                            </div>
                                            <CardHeader className="flex-grow">
                                                <CardTitle className="text-lg">{product.name}</CardTitle>
                                                <CardDescription className="text-primary font-bold text-base">
                                                    Rp {product.price.toLocaleString('id-ID')}
                                                </CardDescription>
                                            </CardHeader>
                                            {product.description && (
                                                <CardContent className="flex-grow">
                                                    <p className="text-sm text-muted-foreground">{product.description}</p>
                                                </CardContent>
                                            )}
                                            <CardFooter>
                                                {product.stock > 0 ? (
                                                    itemInCart ? (
                                                        <div className="flex items-center gap-2 w-full">
                                                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(product.id, itemInCart.quantity - 1)}><MinusCircle className="h-4 w-4" /></Button>
                                                            <span className="font-bold text-center flex-grow">{itemInCart.quantity}</span>
                                                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(product.id, itemInCart.quantity + 1)}><PlusCircle className="h-4 w-4" /></Button>
                                                        </div>
                                                    ) : (
                                                        <Button variant="outline" className="w-full" onClick={() => addToCart(product)}>Tambah</Button>
                                                    )
                                                ) : (
                                                    <Button variant="outline" className="w-full" disabled>Stok Habis</Button>
                                                )}
                                            </CardFooter>
                                        </Card>
                                    )})}
                                </div>
                            </section>
                        ))}
                    </div>
                 ) : (
                    <p className="text-center text-muted-foreground py-10">Belum ada produk untuk ditampilkan di katalog ini.</p>
                 )}
            </main>
        </div>

        <div className="fixed bottom-6 right-6 z-20 flex flex-col gap-4 items-end">
            {cartItemCount > 0 && (
                <SheetTrigger asChild>
                    <Button size="lg" className="rounded-full shadow-lg h-16 w-auto pl-4 pr-6">
                        <ShoppingCart className="h-7 w-7 mr-3"/>
                        <div className="text-left">
                            <p className="font-bold">{cartItemCount} Item</p>
                            <p className="text-xs">Rp {cartSubtotal.toLocaleString('id-ID')}</p>
                        </div>
                    </Button>
                </SheetTrigger>
            )}
            <Button size="icon" className="rounded-full h-14 w-14 shadow-lg" onClick={() => setIsChatOpen(true)}>
                <MessageCircle className="h-7 w-7"/>
            </Button>
        </div>
        
        {store && products.length > 0 && (
            <CatalogAIChat 
                store={store}
                products={products}
                open={isChatOpen}
                onOpenChange={setIsChatOpen}
            />
        )}
        
        <SheetContent className="flex flex-col">
            <SheetHeader>
                <SheetTitle className="font-headline tracking-wider text-2xl">Pesanan Anda</SheetTitle>
            </SheetHeader>
            {cart.length > 0 ? (
                <>
                <ScrollArea className="flex-grow my-4 pr-4 -mr-6">
                    <div className="space-y-4">
                        {cart.map(item => (
                            <div key={item.productId} className="flex items-center gap-4">
                                <div className="flex-1">
                                    <p className="font-semibold">{item.name}</p>
                                    <p className="text-sm text-muted-foreground">Rp {item.price.toLocaleString('id-ID')}</p>
                                </div>
                                 <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.productId, item.quantity - 1)}><MinusCircle className="h-4 w-4" /></Button>
                                    <span className="font-bold text-center w-4">{item.quantity}</span>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.productId, item.quantity + 1)}><PlusCircle className="h-4 w-4" /></Button>
                                </div>
                                <p className="font-mono text-sm w-20 text-right">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</p>
                                 <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70" onClick={() => updateQuantity(item.productId, 0)}><XCircle className="h-5 w-5" /></Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <SheetFooter className="flex-col space-y-4 pt-4 border-t">
                    <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span>Rp {cartSubtotal.toLocaleString('id-ID')}</span>
                    </div>
                    {loggedInCustomer ? (
                         <Button className="w-full" onClick={handleCreateOrder} disabled={isSubmittingOrder}>
                           {isSubmittingOrder ? <Loader className="animate-spin" /> : 'Konfirmasi & Buat Pesanan'}
                         </Button>
                    ) : (
                         <Alert>
                            <UtensilsCrossed className="h-4 w-4" />
                            <AlertTitle>Langkah Berikutnya</AlertTitle>
                            <AlertDescription>
                                Tunjukkan pesanan ini di kasir, atau <Button variant="link" className="p-0 h-auto" onClick={() => setIsAuthDialogOpen(true)}>masuk/daftar</Button> untuk memesan langsung.
                            </AlertDescription>
                        </Alert>
                    )}
                </SheetFooter>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
                    <ShoppingCart className="h-16 w-16 mb-4" />
                    <p className="font-semibold">Keranjang Anda Kosong</p>
                    <p className="text-sm">Tambahkan item dari menu untuk memulai.</p>
                </div>
            )}
        </SheetContent>
        </Sheet>
        
        {store && <CustomerAuthDialog
            open={isAuthDialogOpen}
            onOpenChange={setIsAuthDialogOpen}
            storeId={store.id}
            onLoginSuccess={handleLoginSuccess}
        />}
        </>
    );
}
