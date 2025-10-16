
'use client';

import * as React from 'react';
import type { Store, Product, ProductCategory, ProductInfo } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Image from 'next/image';
import { UtensilsCrossed, PackageX, MessageCircle, Sparkles, Send, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ReactMarkdown from 'react-markdown';
import { CatalogAssistantInput, CatalogAssistantOutput } from '@/lib/types';
import { useParams } from 'next/navigation';


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

export default function CatalogPage() {
    const params = useParams();
    const slug = params.slug as string;
    const [store, setStore] = React.useState<Store | null>(null);
    const [products, setProducts] = React.useState<Product[]>([]);
    const [error, setError] = React.useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isChatOpen, setIsChatOpen] = React.useState(false);

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
            } catch (e) {
                setError((e as Error).message);
                setStore(null);
                setProducts([]);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [slug]);

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
    
    const groupedProducts = groupProducts(products);

    return (
        <>
        <div className="min-h-screen bg-background">
            <header className="p-4 border-b text-center sticky top-0 bg-background/80 backdrop-blur-sm z-10">
                <h1 className="text-3xl font-headline tracking-wider font-bold">{store.name}</h1>
                <p className="text-muted-foreground">{store.location}</p>
            </header>
            
            <main className="container mx-auto max-w-4xl p-4 md:p-8">
                 {products.length > 0 ? (
                    <div className="space-y-12">
                        {Object.entries(groupedProducts).map(([category, productsInCategory]) => (
                            <section key={category} id={category.replace(/\s+/g, '-')}>
                                <h2 className="text-2xl font-bold font-headline mb-6 border-b-2 border-primary pb-2">{category}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {productsInCategory.map(product => (
                                        <Card key={product.id} className="overflow-hidden group">
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
                                            <CardHeader>
                                                <CardTitle className="text-lg">{product.name}</CardTitle>
                                                <CardDescription className="text-primary font-bold text-base">
                                                    Rp {product.price.toLocaleString('id-ID')}
                                                </CardDescription>
                                            </CardHeader>
                                            {product.description && (
                                                <CardContent>
                                                    <p className="text-sm text-muted-foreground">{product.description}</p>
                                                </CardContent>
                                            )}
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                 ) : (
                    <p className="text-center text-muted-foreground py-10">Belum ada produk untuk ditampilkan di katalog ini.</p>
                 )}
            </main>
        </div>

        <div className="fixed bottom-6 right-6 z-20">
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
        </>
    );
}
