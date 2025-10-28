
'use client';

import * as React from 'react';
import type { PendingOrder } from '@/lib/types';
import {
  Search,
  MessageSquare,
  ClipboardCheck,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { collection, onSnapshot, query, where, Unsubscribe, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatWhatsappNumber } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';


function OrderDetailsDialog({ order, open, onOpenChange }: { order: PendingOrder, open: boolean, onOpenChange: (open: boolean) => void }) {
    const router = useRouter();
    const { activeStore } = useAuth();
    if (!order || !activeStore) return null;

    const confirmationMessage = `Halo ${order.customer.name}, pesanan Anda di ${activeStore.name} sudah kami terima dan sedang diproses. Mohon ditunggu ya. Terima kasih!`;
    const whatsappUrl = `https://wa.me/${formatWhatsappNumber(order.customer.phone)}?text=${encodeURIComponent(confirmationMessage)}`;
    
    const handleProcessToPos = () => {
        onOpenChange(false);
        const params = new URLSearchParams();
        params.set('view', 'pos');
        params.set('pendingOrderId', order.id);
        router.push(`/dashboard?${params.toString()}`);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Detail Pesanan #{order.id.substring(0, 6)}</DialogTitle>
                    <DialogDescription>
                        Pesanan dari {order.customer.name} via Katalog Publik.
                    </DialogDescription>
                </DialogHeader>
                 <div className="py-4 space-y-4">
                    {order.items.map(item => (
                        <div key={item.productId} className="flex justify-between items-start text-sm">
                            <div>
                                <p>{item.quantity}x {item.productName}</p>
                                {item.notes && <p className="text-xs italic text-gray-600 pl-2"> &#x21B3; {item.notes}</p>}
                            </div>
                            <p className="font-mono">Rp {(item.quantity * item.price).toLocaleString('id-ID')}</p>
                        </div>
                    ))}
                    <Separator className="my-2"/>
                    <div className="border-t pt-2 mt-2 space-y-1">
                        <div className="flex justify-between text-sm">
                            <span>Subtotal</span>
                            <span>Rp {order.subtotal.toLocaleString('id-ID')}</span>
                        </div>
                         {order.taxAmount > 0 && (
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Pajak</span>
                                <span>Rp {order.taxAmount.toLocaleString('id-ID')}</span>
                            </div>
                        )}
                        {order.serviceFeeAmount > 0 && (
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Biaya Layanan</span>
                                <span>Rp {order.serviceFeeAmount.toLocaleString('id-ID')}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-base">
                            <span>Total</span>
                            <span>Rp {order.totalAmount.toLocaleString('id-ID')}</span>
                        </div>
                    </div>
                 </div>
                 <DialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-2">
                    <Button onClick={handleProcessToPos} className="w-full">
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        Proses ke Kasir
                    </Button>
                    <Button variant="secondary" className="w-full" asChild>
                       <Link href={whatsappUrl} target="_blank">
                           <MessageSquare className="mr-2 h-4 w-4" />
                           Konfirmasi via WhatsApp
                       </Link>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function PendingOrders() {
  const { activeStore } = useAuth();
  const [realtimeOrders, setRealtimeOrders] = React.useState<PendingOrder[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedOrder, setSelectedOrder] = React.useState<PendingOrder | null>(null);
  const { toast } = useToast();
  
  const currentStoreId = activeStore?.id || '';

  React.useEffect(() => {
    if (!currentStoreId) {
        setIsLoading(false);
        return;
    };

    const q = query(collection(db, "pendingOrders"), where("storeId", "==", currentStoreId), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const updatedOrders: PendingOrder[] = [];
        snapshot.forEach((doc) => {
            updatedOrders.push({ id: doc.id, ...doc.data() } as PendingOrder);
        });
        setRealtimeOrders(updatedOrders);
        setIsLoading(false);
        if (snapshot.docChanges().some(change => change.type === 'added')) {
             toast({
              title: "Ada Pesanan Baru!",
              description: "Pesanan baru dari katalog publik telah masuk.",
            });
        }
    }, (error) => {
        console.error("Error listening to pending orders:", error);
        toast({
            variant: 'destructive',
            title: 'Gagal Memuat Pesanan',
            description: 'Tidak dapat memuat pesanan secara real-time.'
        });
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentStoreId, toast]);

  const handleDelete = async (orderId: string) => {
      try {
        await deleteDoc(doc(db, "pendingOrders", orderId));
        toast({ title: "Pesanan Dihapus", description: "Pesanan tertunda telah dihapus dari daftar."});
      } catch (error) {
        toast({ variant: "destructive", title: "Gagal Menghapus", description: "Terjadi kesalahan saat menghapus pesanan."});
      }
  }

  const getDeliveryBadge = (method: 'Ambil Sendiri' | 'Dikirim Toko') => {
      switch(method) {
          case 'Ambil Sendiri':
            return <Badge variant="secondary">Ambil Sendiri</Badge>;
          case 'Dikirim Toko':
            return <Badge variant="default" className="bg-blue-500/20 text-blue-800 border-blue-500/50">Dikirim Toko</Badge>;
          default:
            return <Badge variant="outline">{method}</Badge>;
      }
  }

  return (
    <>
      <Card>
          <CardHeader>
             <CardTitle className="font-headline tracking-wider">Pesanan Tertunda</CardTitle>
             <CardDescription>Daftar pesanan yang masuk dari Katalog Publik dan perlu diproses.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-220px)]">
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                      Array.from({length: 5}).map((_, i) => (
                          <TableRow key={i}>
                              <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                              <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                              <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                              <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                              <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                          </TableRow>
                      ))
                  ) : realtimeOrders.length > 0 ? (
                    realtimeOrders.map((order) => (
                      <TableRow key={order.id} className="cursor-pointer" onClick={() => setSelectedOrder(order)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                  <AvatarImage src={order.customer.avatarUrl} alt={order.customer.name} />
                                  <AvatarFallback>{order.customer.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="font-medium">{order.customer.name}</div>
                          </div>
                        </TableCell>
                         <TableCell>{formatDistanceToNow(new Date(order.createdAt), { addSuffix: true, locale: idLocale })}</TableCell>
                         <TableCell className="font-mono">Rp {order.totalAmount.toLocaleString('id-ID')}</TableCell>
                         <TableCell>{getDeliveryBadge(order.deliveryMethod)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                      <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => setSelectedOrder(order)}>Lihat Detail</DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(order.id)}>Hapus Pesanan</DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        Belum ada pesanan yang tertunda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
      </Card>
      {selectedOrder && (
          <OrderDetailsDialog order={selectedOrder} open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)} />
      )}
    </>
  );
}
