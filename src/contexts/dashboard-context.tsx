'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, onSnapshot, Unsubscribe, where } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { User, RedemptionOption, Product, Store, Customer, Transaction, PendingOrder, Table, ChallengePeriod, TransactionFeeSettings } from '@/lib/types';
import { defaultFeeSettings } from '@/lib/types';
import { getTransactionFeeSettings } from '@/lib/server/app-settings';

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
  playNotificationSound: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// A new function to fetch settings using a Server Action
async function fetchTransactionFeeSettings(): Promise<TransactionFeeSettings> {
    try {
        const settings = await getTransactionFeeSettings();
        // Merge with defaults to ensure all properties are present client-side
        return { ...defaultFeeSettings, ...settings };
    } catch (error) {
        console.error("Error fetching app settings via server action:", error);
        return defaultFeeSettings;
    }
}


export function DashboardProvider({ children }: { children: ReactNode }) {
  const { currentUser, activeStore, isLoading: isAuthLoading, refreshPradanaTokenBalance } = useAuth();
  const { toast } = useToast();
  const notificationAudioRef = useRef<HTMLAudioElement>(null);

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
  
  const playNotificationSound = useCallback(() => {
    notificationAudioRef.current?.play().catch(e => console.error("Audio playback failed:", e));
  }, []);

  const refreshData = useCallback(async () => {
    if (!currentUser) return;
    if (currentUser.role !== 'superadmin' && !activeStore) return;

    setIsLoading(true);
    
    try {
        const storeId = activeStore?.id;
        
        let productCollectionRef, customerCollectionRef, redemptionOptionsCollectionRef, challengePeriodsCollectionRef;

        if (storeId) {
             productCollectionRef = collection(db, 'stores', storeId, 'products');
             customerCollectionRef = collection(db, 'stores', storeId, 'customers');
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
            challengePeriodsSnapshot,
        ] = await Promise.all([
            getDocs(collection(db, 'stores')),
            storeId ? getDocs(query(productCollectionRef, orderBy('name'))) : Promise.resolve({ docs: [] }),
            storeId ? getDocs(query(customerCollectionRef, orderBy('joinDate', 'desc'))) : Promise.resolve({ docs: [] }),
            getDocs(query(collection(db, 'users'))),
            storeId ? getDocs(query(redemptionOptionsCollectionRef)) : Promise.resolve({ docs: [] }),
            fetchTransactionFeeSettings(),
            storeId ? getDocs(query(challengePeriodsCollectionRef, orderBy('createdAt', 'desc'))) : Promise.resolve({ docs: [] }),
        ]);

        setStores(storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store)));
        setProducts(productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
        setCustomers(customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
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
    if (isAuthLoading) {
      setIsLoading(true);
      return;
    }
    
    if (!currentUser) {
        setIsLoading(false);
        // Clear all data if user logs out
        setStores([]);
        setProducts([]);
        setCustomers([]);
        setTransactions([]);
        setPendingOrders([]);
        setUsers([]);
        setRedemptionOptions([]);
        setTables([]);
        setChallengePeriods([]);
        setFeeSettings(defaultFeeSettings);
        return;
    }

    if (currentUser && (currentUser.role === 'superadmin' || activeStore)) {
        refreshData();
    } else if (currentUser && currentUser.role !== 'superadmin' && !activeStore) {
        setIsLoading(true);
        return;
    }

    let unsubscribes: Unsubscribe[] = [];

    if (currentUser.role !== 'superadmin' && activeStore?.id) {
        const storeId = activeStore.id;
        
        const transactionsQuery = query(collection(db, 'stores', storeId, 'transactions'), orderBy('createdAt', 'desc'));
        const tablesQuery = query(collection(db, 'stores', storeId, 'tables'), orderBy('name'));
        const pendingOrdersQuery = query(collection(db, 'pendingOrders'));

        const unsubTransactions = onSnapshot(transactionsQuery, (snapshot) => {
            setTransactions(prevTransactions => {
              const newTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
              
              if (prevTransactions.length > 0) {
                  const prevTxIds = new Set(prevTransactions.map(t => t.id));
                  const justAdded = newTransactions.filter(t => !prevTxIds.has(t.id));
                  
                  if (justAdded.some(t => t.status === 'Diproses')) {
                    playNotificationSound();
                    toast({
                        title: "🔔 Pesanan Baru untuk Dapur!",
                        description: `Ada pesanan baru yang perlu disiapkan.`,
                    });
                  }
              }
              return newTransactions;
            });
        }, (error) => console.error("Error listening to transactions: ", error));

        const unsubTables = onSnapshot(tablesQuery, (snapshot) => {
            const newTables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table));
            
            setTables(prevTables => {
                // Only notify if there are previous tables to compare against
                if (prevTables.length > 0) {
                    const prevTableIds = new Set(prevTables.map(t => t.id));
                    const newVirtualOrders = newTables.filter(t => 
                        !prevTableIds.has(t.id) && t.isVirtual && t.currentOrder
                    );

                    if (newVirtualOrders.length > 0) {
                        playNotificationSound();
                        newVirtualOrders.forEach(table => {
                             toast({
                                title: "🔔 Pesanan Baru Masuk!",
                                description: `Ada pesanan baru di ${table.name}.`,
                            });
                        });
                    }
                }
                return newTables;
            });
        }, (error) => console.error("Error listening to tables: ", error));
        
        const unsubPendingOrders = onSnapshot(pendingOrdersQuery, (snapshot) => {
            setPendingOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingOrder)));
        }, (error) => console.error("Error listening to pending orders: ", error));

        unsubscribes = [unsubTransactions, unsubTables, unsubPendingOrders];
    }

    return () => {
        unsubscribes.forEach(unsub => unsub());
    };
  }, [isAuthLoading, currentUser, activeStore, refreshData, toast, playNotificationSound]);

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
    playNotificationSound,
  };

  return (
    <DashboardContext.Provider value={value}>
        {children}
        <audio ref={notificationAudioRef} src="https://cdn.freesound.org/previews/242/242857_4284968-lq.mp3" preload="auto" />
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
