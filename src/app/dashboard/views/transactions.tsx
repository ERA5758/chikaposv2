'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Transaction, User, Customer, TransactionStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Volume2, Send, CheckCircle, Loader, Calendar as CalendarIcon, Printer, Sparkles, CreditCard, Undo2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderReadyDialog } from '@/components/dashboard/order-ready-dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { useDashboard } from '@/contexts/dashboard-context';
import { db, auth } from '@/lib/firebase';
import { doc, writeBatch, getDoc, updateDoc, runTransaction, increment } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { OrderReadyFollowUpOutput } from '@/ai/flows/order-ready-follow-up';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type TransactionsProps = {
    onPrintRequest: (transaction: Transaction) => void;
    initialTransaction?: Transaction | null;
    onDialogClose?: () => void;
};

function TransactionDetailsDialog({ 
    transaction, 
    open, 
    onOpenChange, 
    users,
    onActionClick,
    onGenerateFollowUp,
    onCompleteTransaction,
    onProcessPayment,
    onRefundTransaction,
    onPrintRequest,
    isActionLoading,
    generatingTextId,
    sentWhatsappIds,
}: { 
    transaction: Transaction; 
    open: boolean; 
    onOpenChange: (open: boolean) => void; 
    users: User[];
    onActionClick: (transaction: Transaction, type: 'call' | 'whatsapp') => void;
    onGenerateFollowUp: (transaction: Transaction) => void;
    onCompleteTransaction: (transaction: Transaction) => void;
    onProcessPayment: (transaction: Transaction) => void;
    onRefundTransaction: (transaction: Transaction) => void;
    onPrintRequest: (transaction: Transaction) => void;
    isActionLoading: boolean;
    generatingTextId: string | null;
    sentWhatsappIds: Set<string>;
}) {
    if (!transaction) return null;
    
    const staff = (users || []).find(u => u.id === transaction.staffId);
    const isRefundable = transaction.status !== 'Dibatalkan';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="font-headline tracking-wider">Detail Transaksi</DialogTitle>
                    <DialogDescription>
                        Nota: {String(transaction.receiptNumber).padStart(6, '0')}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4 -mr-4">
                   <div>
                        <p className="text-sm text-muted-foreground">Pelanggan</p>
                        <p className="font-medium">{transaction.customerName}</p>
                   </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Kasir</p>
                        <p className="font-medium">{staff?.name || 'Unknown'}</p>
                   </div>
                   <div>
                        <p className="text-sm text-muted-foreground">Tanggal</p>
                        <p className="font-medium">{new Date(transaction.createdAt).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}</p>
                   </div>
                   <Separator />
                   <div className="space-y-2">
                        <p className="font-medium">Item Dibeli</p>
                        {transaction.items.map(item => (
                            <div key={item.productId} className="flex justify-between items-start text-sm">
                                <div>
                                    <p>{item.productName}</p>
                                    <p className="text-muted-foreground">{item.quantity} x Rp {item.price.toLocaleString('id-ID')}</p>
                                    {item.notes && <p className="text-xs italic text-blue-600 pl-2"> &#x21B3; {item.notes}</p>}
                                </div>
                                <p>Rp {(item.quantity * item.price).toLocaleString('id-ID')}</p>
                            </div>
                        ))}
                   </div>
                   <Separator />
                   <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <p className="text-muted-foreground">Subtotal</p>
                            <p>Rp {transaction.subtotal.toLocaleString('id-ID')}</p>
                        </div>
                        <div className="flex justify-between text-destructive">
                            <p>Diskon</p>
                            <p>-Rp {transaction.discountAmount.toLocaleString('id-ID')}</p>
                        </div>
                         {transaction.taxAmount > 0 && (
                            <div className="flex justify-between">
                                <p className="text-muted-foreground">Pajak</p>
                                <p>Rp {transaction.taxAmount.toLocaleString('id-ID')}</p>
                            </div>
                        )}
                        {transaction.serviceFeeAmount > 0 && (
                            <div className="flex justify-between">
                                <p className="text-muted-foreground">Biaya Layanan</p>
                                <p>Rp {transaction.serviceFeeAmount.toLocaleString('id-ID')}</p>
                            </div>
                        )}
                        <div className="flex justify-between font-medium">
                            <p>Total</p>
                            <p>Rp {transaction.totalAmount.toLocaleString('id-ID')}</p>
                        </div>
                        <div className="flex justify-between">
                            <p className="text-muted-foreground">Metode Pembayaran</p>
                            <p>{transaction.paymentMethod}</p>
                        </div>
                         <div className="flex justify-between">
                            <p className="text-muted-foreground">Poin Didapat</p>
                            <p className="text-primary">+{transaction.pointsEarned} pts</p>
                        </div>
                         <div className="flex justify-between text-destructive">
                            <p>Poin Ditukar</p>
                            <p>-{transaction.pointsRedeemed} pts</p>
                        </div>
                   </div>
                </div>
                 <DialogFooter className="pt-4 border-t">
                    <div className="flex w-full items-center justify-between gap-1">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => onPrintRequest(transaction)}>
                            <Printer className="h-4 w-4"/> Cetak Struk
                        </Button>
                        <div className="flex items-center gap-1">
                          {transaction.status === 'Belum Dibayar' && (
                              <Button variant="default" size="sm" className="h-8 gap-2" onClick={() => onProcessPayment(transaction)} disabled={isActionLoading}>
                                  {isActionLoading ? <Loader className="h-4 w-4 animate-spin"/> : <CreditCard className="h-4 w-4"/>}
                                  Proses Pembayaran
                              </Button>
                          )}
                          {transaction.status === 'Diproses' && (
                              <>
                                  <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => onActionClick(transaction, 'call')} disabled={isActionLoading}>
                                      <Volume2 className="h-4 w-4"/> Panggil
                                  </Button>
                                  <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => onGenerateFollowUp(transaction)} disabled={isActionLoading || generatingTextId === transaction.id}>
                                      {generatingTextId === transaction.id ? <Loader className="h-4 w-4 animate-spin"/> : (
                                          <div className="relative flex items-center gap-2">
                                              <Send className="h-4 w-4"/> WhatsApp
                                              {sentWhatsappIds.has(transaction.id) && <CheckCircle className="h-3 w-3 absolute -top-1 -right-2 text-green-500 bg-background rounded-full"/>}
                                          </div>
                                      )}
                                  </Button>
                                  <Button variant="default" size="sm" className="h-8 gap-2" onClick={() => onCompleteTransaction(transaction)} disabled={isActionLoading}>
                                      {isActionLoading ? <Loader className="h-4 w-4 animate-spin"/> : <CheckCircle className="h-4 w-4"/>}
                                      Selesaikan
                                  </Button>
                              </>
                          )}
                           <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button aria-haspopup="true" size="icon" variant="ghost" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Aksi Lainnya</span>
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Aksi Lainnya</DropdownMenuLabel>
                                <DropdownMenuItem 
                                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                  onClick={() => onRefundTransaction(transaction)}
                                  disabled={!isRefundable}
                                >
                                    <Undo2 className="mr-2 h-4 w-4"/> Pengembalian Dana
                                </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type StatusFilter = 'Semua' | 'Diproses' | 'Selesai' | 'Belum Dibayar' | 'Dibatalkan';

export default function Transactions({ onPrintRequest, initialTransaction, onDialogClose }: TransactionsProps) {
  const { activeStore } = useAuth();
  const { dashboardData, isLoading, refreshData: onDataChange } = useDashboard();
  const { transactions, users, customers, feeSettings } = dashboardData || {};
  
  const { toast } = useToast();
  const [selectedTransaction, setSelectedTransaction] = React.useState<Transaction | null>(initialTransaction || null);
  const [actionInProgress, setActionInProgress] = React.useState<{ transaction: Transaction; type: 'call' | 'whatsapp' } | null>(null);
  const [completingTransactionId, setCompletingTransactionId] = React.useState<string | null>(null);
  const [transactionToComplete, setTransactionToComplete] = React.useState<Transaction | null>(null);
  const [transactionToRefund, setTransactionToRefund] = React.useState<Transaction | null>(null);
  const [generatingTextId, setGeneratingTextId] = React.useState<string | null>(null);
  const [sentWhatsappIds, setSentWhatsappIds] = React.useState<Set<string>>(new Set());

  // State for Payment Dialog
  const [transactionToPay, setTransactionToPay] = React.useState<Transaction | null>(null);
  const [paymentMethodForDialog, setPaymentMethodForDialog] = React.useState<'Cash' | 'Card' | 'QRIS'>('Cash');
  const [isPaying, setIsPaying] = React.useState(false);

  const [date, setDate] = React.useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('Semua');
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 100;

  const filteredTransactions = React.useMemo(() => {
    let dateFiltered = transactions || [];
    if (date?.from && date?.to) {
        const fromDate = new Date(date.from.setHours(0, 0, 0, 0));
        const toDate = new Date(date.to.setHours(23, 59, 59, 999));
        dateFiltered = dateFiltered.filter(t => isWithinInterval(new Date(t.createdAt), { start: fromDate, end: toDate }));
    }

    if (statusFilter === 'Semua') {
        return dateFiltered;
    }
    
    return dateFiltered.filter(t => {
        if (statusFilter === 'Diproses') {
            return t.status === 'Diproses';
        }
        if (statusFilter === 'Selesai') {
            return t.status === 'Selesai' || t.status === 'Selesai Dibayar';
        }
        if (statusFilter === 'Belum Dibayar') {
            return t.status === 'Belum Dibayar';
        }
        if (statusFilter === 'Dibatalkan') {
            return t.status === 'Dibatalkan';
        }
        return false;
    });

  }, [transactions, date, statusFilter]);

  const paginatedTransactions = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  
  React.useEffect(() => {
      setCurrentPage(1);
  }, [date, statusFilter]);

  const getCustomerForTransaction = (transaction: Transaction): Customer | undefined => {
      if (!transaction.customerId || transaction.customerId === 'N/A') return undefined;
      return (customers || []).find(c => c.id === transaction.customerId);
  }

  const handleActionClick = (transaction: Transaction, type: 'call' | 'whatsapp') => {
    setActionInProgress({ transaction, type });
  };

  const handleWhatsappSent = (transactionId: string) => {
    setSentWhatsappIds(prev => new Set(prev).add(transactionId));
  }

  const handleGenerateFollowUp = async (transaction: Transaction) => {
    setGeneratingTextId(transaction.id);
    try {
        const idToken = await auth.currentUser?.getIdToken(true);
        if (!idToken) throw new Error("Authentication token not available.");
        if (!activeStore) throw new Error("Active store not found.");

        const response = await fetch('/api/order-ready-notification', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ transaction, customer: getCustomerForTransaction(transaction), store: activeStore })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to generate creative text.');
        }

        const result: OrderReadyFollowUpOutput = await response.json();
        
        toast({
            title: "Notifikasi Terkirim!",
            description: "Notifikasi WhatsApp telah dikirim ke pelanggan.",
        });
        handleWhatsappSent(transaction.id); // Mark as sent
    } catch (error) {
        console.error("Error generating follow-up text:", error);
        toast({
            variant: 'destructive',
            title: 'Gagal Mengirim Notifikasi',
            description: (error as Error).message,
        });
    } finally {
        setGeneratingTextId(null);
    }
  };

  const handleCompleteTransaction = async () => {
    if (!transactionToComplete || !activeStore) return;
    
    setCompletingTransactionId(transactionToComplete.id);

    try {
        const batch = writeBatch(db);
        
        const transactionRef = doc(db, 'stores', activeStore.id, 'transactions', transactionToComplete.id);
        batch.update(transactionRef, { status: 'Selesai' });

        if (transactionToComplete.tableId) {
            const tableRef = doc(db, 'stores', activeStore.id, 'tables', transactionToComplete.tableId);
            const tableDoc = await getDoc(tableRef);
            if (tableDoc.exists()) {
                batch.update(tableRef, { status: 'Menunggu Dibersihkan' });
            }
        }
        
        await batch.commit();

        toast({ title: 'Pesanan Selesai!', description: `Status pesanan untuk ${transactionToComplete.customerName} telah diperbarui.`});
        onDataChange();

    } catch (error) {
        console.error("Error completing transaction:", error);
        toast({ variant: 'destructive', title: 'Gagal Menyelesaikan Pesanan' });
    } finally {
        setCompletingTransactionId(null);
        setTransactionToComplete(null);
    }
  }

  const handleProcessPayment = async () => {
    if (!transactionToPay || !activeStore) return;
    setIsPaying(true);

    try {
        const transactionRef = doc(db, 'stores', activeStore.id, 'transactions', transactionToPay.id);
        await updateDoc(transactionRef, {
            status: 'Selesai Dibayar',
            paymentMethod: paymentMethodForDialog,
        });

        toast({
            title: "Pembayaran Berhasil",
            description: `Pembayaran untuk nota ${String(transactionToPay.receiptNumber).padStart(6, '0')} telah diterima.`,
        });
        
        onDataChange();
        setTransactionToPay(null);

    } catch (error) {
        console.error("Error processing payment:", error);
        toast({
            variant: "destructive",
            title: "Gagal Memproses Pembayaran",
            description: (error as Error).message,
        });
    } finally {
        setIsPaying(false);
    }
  };
  
  const handleRefund = async () => {
    if (!transactionToRefund || !activeStore || !feeSettings) return;
    setIsPaying(true); // Reuse loading state

    try {
        await runTransaction(db, async (transaction) => {
            const storeRef = doc(db, 'stores', activeStore.id);
            const transRef = doc(db, 'stores', activeStore.id, 'transactions', transactionToRefund.id);
            
            // 1. Revert stock
            for (const item of transactionToRefund.items) {
                 if (!item.productId.startsWith('manual-')) {
                    const productRef = doc(db, 'stores', activeStore.id, 'products', item.productId);
                    transaction.update(productRef, { stock: increment(item.quantity) });
                 }
            }
            
            // 2. Revert points
            if (transactionToRefund.customerId !== 'N/A') {
                const customerRef = doc(db, 'stores', activeStore.id, 'customers', transactionToRefund.customerId);
                const pointsToRevert = transactionToRefund.pointsRedeemed - transactionToRefund.pointsEarned;
                transaction.update(customerRef, { loyaltyPoints: increment(pointsToRevert) });
            }

            // 3. Refund transaction fee
            const feeFromPercentage = transactionToRefund.totalAmount * feeSettings.feePercentage;
            const feeCappedAtMin = Math.max(feeFromPercentage, feeSettings.minFeeRp);
            const feeToRefund = Math.min(feeCappedAtMin, feeSettings.maxFeeRp) / feeSettings.tokenValueRp;
            transaction.update(storeRef, { pradanaTokenBalance: increment(feeToRefund) });

            // 4. Update transaction status
            transaction.update(transRef, { status: 'Dibatalkan' });
        });
        
        toast({
            title: "Transaksi Dibatalkan",
            description: "Stok, poin, dan token telah dikembalikan.",
        });

        onDataChange();
        setTransactionToRefund(null);

    } catch (error) {
        console.error("Error refunding transaction:", error);
        toast({
            variant: "destructive",
            title: "Gagal Membatalkan Transaksi",
            description: (error as Error).message,
        });
    } finally {
        setIsPaying(false);
    }
  }


  return (
    <>
      <div className="non-printable">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
                <div>
                    <CardTitle className="font-headline tracking-wider">
                    Riwayat Transaksi
                    </CardTitle>
                    <CardDescription>
                    Lihat semua penjualan yang lalu, status pesanan, dan detailnya.
                    </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Filter status..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Semua">Semua Status</SelectItem>
                            <SelectItem value="Diproses">Diproses</SelectItem>
                            <SelectItem value="Selesai">Selesai</SelectItem>
                            <SelectItem value="Belum Dibayar">Belum Dibayar</SelectItem>
                            <SelectItem value="Dibatalkan">Dibatalkan</SelectItem>
                        </SelectContent>
                    </Select>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                            "w-full sm:w-[300px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? (
                            date.to ? (
                                <>
                                {format(date.from, "LLL dd, y")} -{" "}
                                {format(date.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y")
                            )
                            ) : (
                            <span>Pilih tanggal</span>
                            )}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={2}
                        />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nota</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Metode Pembayaran</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right w-[100px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                    Array.from({length: 10}).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-16"/></TableCell>
                            <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                            <TableCell><Skeleton className="h-5 w-32"/></TableCell>
                            <TableCell className="text-center"><Skeleton className="h-6 w-20 mx-auto"/></TableCell>
                            <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto"/></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto"/></TableCell>
                        </TableRow>
                    ))
                ) : (
                    paginatedTransactions.map((transaction) => {
                    return (
                    <TableRow key={transaction.id} onClick={() => setSelectedTransaction(transaction)} className="cursor-pointer">
                        <TableCell className="font-mono">{String(transaction.receiptNumber).padStart(6, '0')}</TableCell>
                        <TableCell>
                        {new Date(transaction.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                        })}
                        </TableCell>
                        <TableCell>{transaction.customerName}</TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={transaction.status === 'Selesai' || transaction.status === 'Selesai Dibayar' ? 'secondary' : 'default'}
                            className={cn(
                                transaction.status === 'Diproses' && 'bg-amber-500/20 text-amber-800 border-amber-500/50',
                                (transaction.status === 'Selesai' || transaction.status === 'Selesai Dibayar') && 'bg-green-500/20 text-green-800 border-green-500/50',
                                transaction.status === 'Belum Dibayar' && 'bg-orange-500/20 text-orange-800 border-orange-500/50',
                                transaction.status === 'Dibatalkan' && 'bg-red-500/20 text-red-800 border-red-500/50',
                            )}
                          >
                              {transaction.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{transaction.paymentMethod}</TableCell>
                        <TableCell className="text-right font-mono">
                        Rp {transaction.totalAmount.toLocaleString('id-ID')}
                        </TableCell>
                         <TableCell className="text-right">
                           {transaction.status === 'Belum Dibayar' ? (
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); setTransactionToPay(transaction); }}>Bayar</Button>
                           ) : (
                             <Button aria-haspopup="true" size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedTransaction(transaction); }}>
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Lihat Detail</span>
                            </Button>
                           )}
                        </TableCell>
                    </TableRow>
                    )})
                )}
              </TableBody>
            </Table>
            </TooltipProvider>
             <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-muted-foreground">
                    Halaman {currentPage} dari {totalPages}
                </span>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        Sebelumnya
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                    >
                        Berikutnya
                    </Button>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {selectedTransaction && (
          <TransactionDetailsDialog
              transaction={selectedTransaction}
              open={!!selectedTransaction}
              onOpenChange={() => {
                  setSelectedTransaction(null)
                  if(onDialogClose) onDialogClose();
              }}
              users={users || []}
              onActionClick={handleActionClick}
              onGenerateFollowUp={handleGenerateFollowUp}
              onCompleteTransaction={() => setTransactionToComplete(selectedTransaction)}
              onProcessPayment={() => setTransactionToPay(selectedTransaction)}
              onRefundTransaction={() => setTransactionToRefund(selectedTransaction)}
              onPrintRequest={onPrintRequest}
              isActionLoading={completingTransactionId === selectedTransaction.id}
              generatingTextId={generatingTextId}
              sentWhatsappIds={sentWhatsappIds}
          />
      )}
      {actionInProgress && activeStore && (
        <OrderReadyDialog
          transaction={actionInProgress.transaction}
          customer={getCustomerForTransaction(actionInProgress.transaction)}
          store={activeStore}
          open={!!actionInProgress}
          onOpenChange={() => setActionInProgress(null)}
          onSuccess={() => {
            if (actionInProgress.type === 'whatsapp') {
                handleWhatsappSent(actionInProgress.transaction.id);
            }
          }}
        />
      )}
      <AlertDialog open={!!transactionToComplete} onOpenChange={() => setTransactionToComplete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Selesaikan Pesanan?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menandai pesanan untuk <span className="font-bold">{transactionToComplete?.customerName}</span> sebagai selesai. Pastikan pesanan sudah diserahkan kepada pelanggan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompleteTransaction}>Ya, Selesaikan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!transactionToRefund} onOpenChange={() => setTransactionToRefund(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan &amp; Kembalikan Dana?</AlertDialogTitle>
            <AlertDialogDescription>
              Transaksi ini akan dibatalkan. Stok, poin, dan biaya token akan dikembalikan. Tindakan ini tidak dapat diurungkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleRefund} disabled={isPaying} className="bg-destructive hover:bg-destructive/90">
                {isPaying ? <Loader className="animate-spin mr-2"/> : <Undo2 className="mr-2 h-4 w-4"/>}
                Ya, Batalkan Transaksi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Dialog */}
      <Dialog open={!!transactionToPay} onOpenChange={() => setTransactionToPay(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Proses Pembayaran</DialogTitle>
                <DialogDescription>
                    Pilih metode pembayaran untuk transaksi nota #{String(transactionToPay?.receiptNumber).padStart(6, '0')}.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="text-center">
                    <p className="text-muted-foreground">Total Tagihan</p>
                    <p className="text-3xl font-bold">Rp {transactionToPay?.totalAmount.toLocaleString('id-ID')}</p>
                </div>
                <Select value={paymentMethodForDialog} onValueChange={(value: 'Cash' | 'Card' | 'QRIS') => setPaymentMethodForDialog(value)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Pilih Metode Pembayaran"/>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Cash">Tunai</SelectItem>
                        <SelectItem value="Card">Kartu</SelectItem>
                        <SelectItem value="QRIS">QRIS</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setTransactionToPay(null)}>Batal</Button>
                <Button onClick={handleProcessPayment} disabled={isPaying}>
                    {isPaying && <Loader className="mr-2 h-4 w-4 animate-spin"/>}
                    Konfirmasi Pembayaran
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
