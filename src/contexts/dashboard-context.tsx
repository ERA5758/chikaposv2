'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { User, RedemptionOption, Product, Store, Customer, Transaction, PendingOrder, Table, ChallengePeriod, TransactionFeeSettings } from '@/lib/types';

// Default settings, defined on the client-side to avoid server imports.
const defaultFeeSettings: TransactionFeeSettings = {
  tokenValueRp: 1000,
  feePercentage: 0.005,
  minFeeRp: 500,
  maxFeeRp: 2500,
  aiUsageFee: 1,
  newStoreBonusTokens: 50,
  aiBusinessPlanFee: 25,
  aiSessionFee: 5,
  aiSessionDurationMinutes: 30,
};

interface DashboardContextType {
  dashboardData: {
    stores: Store[];
    products: Product[];
    customers: Customer[];
    transactions: Transaction[];
    pendingOrders: PendingOrder[];
    users: User[];
    redemptionOptions: RedemptionOption[];
    tables: Table[];
    challengePeriods: ChallengePeriod[];
    feeSettings: TransactionFeeSettings;
  };
  isLoading: boolean;
  refreshData: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// A new function to fetch settings from the API route
async function fetchTransactionFeeSettings(): Promise<TransactionFeeSettings> {
    try {
        const response = await fetch('/api/app-settings');
        if (!response.ok) {
            console.error("Failed to fetch app settings, using defaults.");
            return defaultFeeSettings;
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching app settings:", error);
        return defaultFeeSettings;
    }
}


export function DashboardProvider({ children }: { children: ReactNode }) {
  const { currentUser, activeStore, isLoading: isAuthLoading, refreshPradanaTokenBalance } = useAuth();
  const { toast } = useToast();

  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [redemptionOptions, setRedemptionOptions] = useState<RedemptionOption[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [challengePeriods, setChallengePeriods] = useState<ChallengePeriod[]>([]);
  const [feeSettings, setFeeSettings] = useState<TransactionFeeSettings>(defaultFeeSettings);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    if (!currentUser) return;
    if (currentUser.role !== 'superadmin' && !activeStore) return;

    setIsLoading(true);
    
    try {
        const storeId = activeStore?.id;
        
        let productCollectionRef, customerCollectionRef, tableCollectionRef, redemptionOptionsCollectionRef, challengePeriodsCollectionRef;

        if (storeId) {
             productCollectionRef = collection(db, 'stores', storeId, 'products');
             customerCollectionRef = collection(db, 'stores', storeId, 'customers');
             tableCollectionRef = collection(db, 'stores', storeId, 'tables');
             redemptionOptionsCollectionRef = collection(db, 'stores', storeId, 'redemptionOptions');
             challengePeriodsCollectionRef = collection(db, 'stores', storeId, 'challengePeriods');
        }

        const [
            storesSnapshot,
            productsSnapshot,
            customersSnapshot,
            usersSnapshot,
            redemptionOptionsSnapshot,
            feeSettingsData,
            tablesSnapshot,
            challengePeriodsSnapshot,
        ] = await Promise.all([
            getDocs(collection(db, 'stores')),
            storeId ? getDocs(query(productCollectionRef, orderBy('name'))) : Promise.resolve({ docs: [] }),
            storeId ? getDocs(query(customerCollectionRef, orderBy('joinDate', 'desc'))) : Promise.resolve({ docs: [] }),
            getDocs(query(collection(db, 'users'))),
            storeId ? getDocs(query(redemptionOptionsCollectionRef)) : Promise.resolve({ docs: [] }),
            fetchTransactionFeeSettings(),
            storeId ? getDocs(query(tableCollectionRef, orderBy('name'))) : Promise.resolve({ docs: [] }),
            storeId ? getDocs(query(challengePeriodsCollectionRef, orderBy('createdAt', 'desc'))) : Promise.resolve({ docs: [] }),
        ]);

        setStores(storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store)));
        setProducts(productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
        setCustomers(customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
        setTables(tablesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table)));
        setRedemptionOptions(redemptionOptionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RedemptionOption)));
        setChallengePeriods(challengePeriodsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChallengePeriod)));
        setFeeSettings(feeSettingsData);
        
        if (activeStore) {
            refreshPradanaTokenBalance();
        }

    } catch (error) {
        console.error("Error fetching static dashboard data: ", error);
        toast({
            variant: 'destructive',
            title: 'Gagal Memuat Data Statis',
            description: 'Terjadi kesalahan saat mengambil data dasar. Beberapa fitur mungkin tidak berfungsi.'
        });
    } finally {
        setIsLoading(false);
    }
  }, [currentUser, activeStore, toast, refreshPradanaTokenBalance]);

  useEffect(() => {
    if (isAuthLoading || !currentUser) {
        setIsLoading(false);
        return;
    }

    refreshData();

    let transactionsUnsubscribe: Unsubscribe | undefined;
    let pendingOrdersUnsubscribe: Unsubscribe | undefined;

    if (currentUser.role !== 'superadmin' && activeStore?.id) {
        const storeId = activeStore.id;
        const transactionCollectionRef = collection(db, 'stores', storeId, 'transactions');
        const transactionsQuery = query(transactionCollectionRef, orderBy('createdAt', 'desc'));
        
        transactionsUnsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
            setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
        }, (error) => {
            console.error("Error listening to transactions: ", error);
            toast({ variant: 'destructive', title: 'Error Real-time Transaksi', description: 'Gagal memperbarui data transaksi.'});
        });

        const pendingOrdersQuery = query(collection(db, 'pendingOrders'));
        pendingOrdersUnsubscribe = onSnapshot(pendingOrdersQuery, (snapshot) => {
            setPendingOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingOrder)));
        }, (error) => {
            console.error("Error listening to pending orders: ", error);
            toast({ variant: 'destructive', title: 'Error Real-time Pesanan', description: 'Gagal memperbarui data pesanan.'});
        });

    } else if (currentUser.role === 'superadmin') {
        setTransactions([]);
        setPendingOrders([]);
    }

    return () => {
        if (transactionsUnsubscribe) transactionsUnsubscribe();
        if (pendingOrdersUnsubscribe) pendingOrdersUnsubscribe();
    };
  }, [isAuthLoading, currentUser, activeStore, refreshData, toast]);

  const value = {
    dashboardData: {
        stores,
        products,
        customers,
        transactions,
        pendingOrders,
        users,
        redemptionOptions,
        tables,
        challengePeriods,
        feeSettings,
    },
    isLoading,
    refreshData,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
