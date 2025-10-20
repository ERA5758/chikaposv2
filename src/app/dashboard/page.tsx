
'use client';

import * as React from 'react';
import { MainSidebar } from '@/app/dashboard/main-sidebar';
import { Header } from '@/components/dashboard/header';
import { SidebarInset } from '@/components/ui/sidebar';
import Overview from '@/app/dashboard/views/overview';
import AdminOverview from '@/app/dashboard/views/admin-overview';
import POS from '@/app/dashboard/views/pos';
import Products from '@/app/dashboard/views/products';
import Customers from '@/app/dashboard/views/customers';
import CustomerAnalytics from '@/app/dashboard/views/customer-analytics';
import Transactions, { TransactionDetailsDialog } from '@/app/dashboard/views/transactions';
import Employees from '@/app/dashboard/views/employees';
import Settings from '@/app/dashboard/views/settings';
import Challenges from '@/app/dashboard/views/challenges';
import Promotions from '@/app/dashboard/views/promotions';
import ReceiptSettings from '@/app/dashboard/views/receipt-settings';
import AIBusinessPlan from '@/app/dashboard/views/ai-business-plan';
import CatalogSettings from '@/app/dashboard/views/catalog-settings';
import Tables from '@/app/dashboard/views/tables';
import Kitchen from '@/app/dashboard/views/kitchen';
import { Suspense } from 'react';
import type { User, Transaction } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';
import { useDashboard } from '@/contexts/dashboard-context';
import { UtensilsCrossed, Printer, Loader, Volume2, Send, CheckCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Receipt } from '@/components/dashboard/receipt';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { doc, writeBatch, getDoc } from 'firebase/firestore';

function CheckoutReceiptDialog({ transaction, users, open, onOpenChange }: { transaction: Transaction | null; users: User[]; open: boolean; onOpenChange: (open: boolean) => void }) {
    if (!transaction) return null;
    
    const handlePrint = () => {
        const printableArea = document.querySelector('.printable-area');
        if(printableArea) {
            printableArea.innerHTML = ''; // Clear previous receipt
            const receiptString = document.getElementById(`receipt-for-${transaction.id}`)?.innerHTML;
            if (receiptString) {
                printableArea.innerHTML = receiptString;
                window.print();
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="font-headline tracking-wider text-center">Pratinjau Struk</DialogTitle>
                </DialogHeader>
                <div className="py-4" id={`receipt-for-${transaction.id}`}>
                    <Receipt transaction={transaction} users={users} />
                </div>
                <DialogFooter className="sm:justify-center">
                    <Button type="button" className="w-full gap-2" onClick={handlePrint}>
                        <Printer className="h-4 w-4" />
                        Cetak Struk
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DashboardContent() {
  const { currentUser, activeStore, pradanaTokenBalance } = useAuth();
  const { dashboardData, isLoading, refreshData } = useDashboard();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // State for shared dialogs
  const [transactionToPrint, setTransactionToPrint] = React.useState<Transaction | null>(null);
  const [transactionForDetail, setTransactionForDetail] = React.useState<Transaction | null>(null);

  // States for actions within the detail dialog
  const [actionInProgress, setActionInProgress] = React.useState<{ transaction: Transaction; type: 'call' | 'whatsapp' } | null>(null);
  const [completingTransactionId, setCompletingTransactionId] = React.useState<string | null>(null);
  const [generatingTextId, setGeneratingTextId] = React.useState<string | null>(null);
  const [sentWhatsappIds, setSentWhatsappIds] = React.useState<Set<string>>(new Set());
  
  const isAdmin = currentUser?.role === 'admin';
  const defaultView = currentUser?.role === 'kitchen' ? 'kitchen' : (isAdmin ? 'overview' : 'pos');
  const view = searchParams.get('view') || defaultView;
  
  if (isLoading || !dashboardData) {
    return <DashboardSkeleton />;
  }

  const { users, customers, transactions } = dashboardData;

  // --- Handlers for actions inside TransactionDetailsDialog ---
  const handleGenerateFollowUp = async (transaction: Transaction) => {
    setGeneratingTextId(transaction.id);
    try {
        const idToken = await auth.currentUser?.getIdToken(true);
        if (!idToken || !activeStore) throw new Error("Sesi atau toko tidak valid.");

        const response = await fetch('/api/order-ready-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}`},
            body: JSON.stringify({ transaction, customer: customers.find(c => c.id === transaction.customerId), store: activeStore })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Gagal mengirim notifikasi.');
        }
        toast({ title: "Notifikasi Terkirim!", description: "Notifikasi WhatsApp telah dikirim ke pelanggan."});
        setSentWhatsappIds(prev => new Set(prev).add(transaction.id));
    } catch (error) {
        toast({ variant: 'destructive', title: 'Gagal Mengirim Notifikasi', description: (error as Error).message });
    } finally {
        setGeneratingTextId(null);
    }
  };

  const handleCompleteTransaction = async (transaction: Transaction) => {
    if (!activeStore) return;
    setCompletingTransactionId(transaction.id);
    try {
        const batch = writeBatch(db);
        const transactionRef = doc(db, 'stores', activeStore.id, 'transactions', transaction.id);
        batch.update(transactionRef, { status: 'Selesai' });

        if (transaction.tableId) {
            const tableRef = doc(db, 'stores', activeStore.id, 'tables', transaction.tableId);
            const tableDoc = await getDoc(tableRef);
            if (tableDoc.exists()) batch.update(tableRef, { status: 'Menunggu Dibersihkan' });
        }
        await batch.commit();
        toast({ title: 'Pesanan Selesai!', description: `Status pesanan untuk ${transaction.customerName} telah diperbarui.`});
        refreshData();
    } catch (error) {
        toast({ variant: 'destructive', title: 'Gagal Menyelesaikan Pesanan' });
    } finally {
        setCompletingTransactionId(null);
        setTransactionForDetail(null);
    }
  }


  const renderView = () => {
    const commonProps = { onPrintRequest: setTransactionToPrint, onDetailRequest: setTransactionForDetail };
    const cashierViews = ['overview', 'pos', 'transactions', 'products', 'customers', 'promotions'];
    const kitchenViews = ['kitchen', 'transactions'];

    if (currentUser?.role === 'cashier' && !cashierViews.includes(view)) {
        return <Tables />; // Default view for cashier
    }
    if (currentUser?.role === 'kitchen' && !kitchenViews.includes(view)) {
        return <Kitchen onFollowUpRequest={setTransactionForDetail}/>; // Default for kitchen
    }
    if (currentUser?.role === 'admin' && view === 'kitchen') {
        return <Kitchen onFollowUpRequest={setTransactionForDetail} />;
    }

    switch (view) {
      case 'overview': return isAdmin ? <AdminOverview /> : <Overview />;
      case 'pos': return searchParams.get('tableId') ? <POS {...commonProps} /> : <Tables />;
      case 'products': return <Products />;
      case 'customers': return <Customers />;
      case 'customer-analytics': return <CustomerAnalytics />;
      case 'employees': return <Employees />;
      case 'transactions': return <Transactions {...commonProps} />;
      case 'kitchen': return <Kitchen onFollowUpRequest={setTransactionForDetail} />;
      case 'settings': return <Settings />;
      case 'challenges': return <Challenges />;
      case 'promotions': return <Promotions />;
      case 'receipt-settings': return <ReceiptSettings />;
      case 'ai-business-plan': return <AIBusinessPlan />;
      case 'catalog': return <CatalogSettings />;
      default: return <Tables />;
    }
  };

  const getTitle = () => {
    const tableId = searchParams.get('tableId');
    const tableName = searchParams.get('tableName');
    if (view === 'pos' && tableId) {
        return `Pesanan: ${tableName || ''}`;
    }
    const baseTitle = {
      'overview': 'Dashboard Overview', 'pos': 'Kasir POS', 'kitchen': 'Monitor Dapur', 'products': 'Inventaris Produk', 'customers': 'Manajemen Pelanggan',
      'customer-analytics': 'Analisis Pelanggan', 'employees': 'Manajemen Karyawan', 'transactions': 'Riwayat Transaksi', 'settings': 'Pengaturan',
      'challenges': 'Tantangan Karyawan', 'promotions': 'Manajemen Promosi', 'receipt-settings': 'Pengaturan Struk', 'ai-business-plan': 'AI Business Plan',
      'catalog': 'Pengaturan Katalog Publik',
    }[view] || 'Kasir POS';
    return isAdmin && view === 'overview' ? `Admin Overview` : baseTitle;
  };

  return (
    <>
      <MainSidebar pradanaTokenBalance={pradanaTokenBalance} />
      <SidebarInset>
        <Header title={getTitle()} view={view} />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {currentUser ? renderView() : <DashboardSkeleton />}
        </main>
      </SidebarInset>
      <div className="printable-area" aria-hidden="true"></div>
      
       <CheckoutReceiptDialog
            transaction={transactionToPrint}
            users={users}
            open={!!transactionToPrint}
            onOpenChange={() => setTransactionToPrint(null)}
        />
        
        {transactionForDetail && (
            <TransactionDetailsDialog
                transaction={transactionForDetail}
                users={users}
                open={!!transactionForDetail}
                onOpenChange={() => setTransactionForDetail(null)}
                onActionClick={setActionInProgress}
                onGenerateFollowUp={handleGenerateFollowUp}
                onCompleteTransaction={handleCompleteTransaction}
                onProcessPayment={() => { /* This should trigger a payment dialog */ }}
                onRefundTransaction={() => { /* This should trigger a refund dialog */}}
                onPrintRequest={setTransactionToPrint}
                isActionLoading={completingTransactionId === transactionForDetail.id}
                generatingTextId={generatingTextId}
                sentWhatsappIds={sentWhatsappIds}
            />
        )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardSkeleton() {
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <UtensilsCrossed className="h-16 w-16 animate-pulse-slow text-primary/50" />
                <p className="font-headline text-xl tracking-wider text-muted-foreground">
                    Loading Dashboard...
                </p>
            </div>
        </div>
    )
}
