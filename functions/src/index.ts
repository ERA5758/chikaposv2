
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { URLSearchParams } from "url";

// Initialize Firebase Admin SDK for the deployment tool to work.
initializeApp();

const db = getFirestore();

interface WhatsappSettings {
  deviceId?: string;
  adminGroup?: string;
}

// Duplicating this interface here as it's a separate runtime from the main app.
interface TransactionFeeSettings {
    tokenValueRp: number;
    // ... other fields are not needed for this function
}

async function getWhatsappSettings(storeId: string): Promise<WhatsappSettings> {
  const defaultSettings: WhatsappSettings = { deviceId: '', adminGroup: '' };
  if (!storeId) {
    logger.error("storeId was not provided to getWhatsappSettings");
    return defaultSettings;
  }
  
  const settingsDocRef = db.collection('stores').doc(storeId).collection('settings').doc('whatsapp');

  try {
    const docSnap = await settingsDocRef.get();
    if (docSnap.exists) {
      return { ...defaultSettings, ...docSnap.data() };
    } else {
      await settingsDocRef.set(defaultSettings);
      return defaultSettings;
    }
  } catch (error) {
    logger.error(`Error fetching WhatsApp settings for store ${storeId}:`, error);
    return defaultSettings;
  }
}

export const processWhatsappQueue = onDocumentCreated("whatsappQueue/{messageId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        logger.info("No data associated with the event, exiting.");
        return;
    }

    const messageData = snapshot.data();
    const { to, message, isGroup = false, storeId = 'platform' } = messageData;

    if (!to || !message) {
        logger.error("Document is missing 'to' or 'message' field.", { id: snapshot.id });
        return snapshot.ref.update({ status: 'failed', error: 'Missing to/message field' });
    }

    try {
        const settings = await getWhatsappSettings(storeId);
        const { deviceId, adminGroup } = settings;

        if (!deviceId) {
            throw new Error(`WhatsApp deviceId is not configured for store '${storeId}'`);
        }

        const recipient = (to === 'admin_group' && isGroup) ? adminGroup : to;
        if (!recipient) {
            throw new Error(`Recipient is invalid. 'to' field was '${to}' and adminGroup for store '${storeId}' is not set.`);
        }

        const fetch = (await import('node-fetch')).default;
        const body = new URLSearchParams();
        body.append('device_id', deviceId);
        body.append(isGroup ? 'group' : 'number', recipient);
        body.append('message', message);

        const endpoint = isGroup ? 'sendGroup' : 'send';
        const webhookUrl = `https://app.whacenter.com/api/${endpoint}`;

        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: body,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        const responseJson = await response.json() as { status: 'error' | 'success', reason?: string };

        if (!response.ok || responseJson.status === 'error') {
            throw new Error(responseJson.reason || `WhaCenter API error with status ${response.status}`);
        }

        logger.info(`Successfully sent WhatsApp message via queue to ${recipient}`);
        return snapshot.ref.update({ status: 'sent', sentAt: new Date().toISOString() });

    } catch (error: any) {
        logger.error(`Failed to process WhatsApp message for recipient '${to}' in store '${storeId}':`, error);
        return snapshot.ref.update({ status: 'failed', error: error.message });
    }
});

export const sendDailySalesSummary = onSchedule({
    schedule: "1 0 * * *",
    timeZone: "Asia/Jakarta",
}, async (event) => {
    logger.info("Memulai pengiriman ringkasan penjualan harian...");
    try {
        const storesSnapshot = await db.collection('stores').get();
        if (storesSnapshot.empty) {
            logger.info("Tidak ada toko yang terdaftar. Proses dihentikan.");
            return;
        }
        const fetch = (await import('node-fetch')).default;

        const promises = storesSnapshot.docs.map(async (storeDoc) => {
            const store = storeDoc.data();
            const storeId = storeDoc.id;

            if (store.notificationSettings?.dailySummaryEnabled === false) {
                logger.info(`Pengiriman ringkasan harian dinonaktifkan untuk toko: ${store.name}`);
                return;
            }

            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
            const endOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);

            const transactionsSnapshot = await db.collection('stores').doc(storeId).collection('transactions')
                .where('createdAt', '>=', startOfDay.toISOString())
                .where('createdAt', '<=', endOfDay.toISOString())
                .get();

            let totalRevenue = 0;
            const totalTransactions = transactionsSnapshot.size;
            transactionsSnapshot.forEach(txDoc => {
                totalRevenue += txDoc.data().totalAmount || 0;
            });

            logger.info(`Toko: ${store.name}, Omset Kemarin: Rp ${totalRevenue}, Transaksi: ${totalTransactions}`);

            if (!store.adminUids || store.adminUids.length === 0) {
                logger.warn(`Toko ${store.name} tidak memiliki admin.`);
                return;
            }

            const adminDocs = await Promise.all(
                store.adminUids.map((uid: string) => db.collection('users').doc(uid).get())
            );

            const formattedDate = format(yesterday, "EEEE, d MMMM yyyy", { locale: idLocale });

            for (const adminDoc of adminDocs) {
                if (adminDoc.exists) {
                    const adminData = adminDoc.data();
                    if (adminData && adminData.whatsapp) {
                        const message = `*Ringkasan Harian Chika POS*
*${store.name}* - ${formattedDate}

Halo *${adminData.name}*, berikut adalah ringkasan penjualan Anda kemarin:
- *Total Omset*: Rp ${totalRevenue.toLocaleString('id-ID')}
- *Jumlah Transaksi*: ${totalTransactions}

Terus pantau dan optimalkan performa penjualan Anda melalui dasbor Chika. Semangat selalu! 💪

_Apabila tidak berkenan, fitur ini dapat dinonaktifkan di menu Pengaturan._`;

                        try {
                            const formattedPhone = adminData.whatsapp.startsWith('0')
                                ? `62${adminData.whatsapp.substring(1)}`
                                : adminData.whatsapp;
                            
                            const { deviceId } = await getWhatsappSettings(storeId);
                            if (!deviceId) continue;

                            const body = new URLSearchParams();
                            body.append('device_id', deviceId);
                            body.append('number', formattedPhone);
                            body.append('message', message);

                            await fetch('https://app.whacenter.com/api/send', {
                                method: 'POST',
                                body: body,
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                }
                            });
                            logger.info(`Laporan harian berhasil dikirim ke ${adminData.name} (${store.name})`);
                        } catch (waError) {
                            logger.error(`Gagal mengirim WA ke ${adminData.name} (${store.name}):`, waError);
                        }
                    }
                }
            }
        });
        await Promise.all(promises);
        logger.info("Pengiriman ringkasan penjualan harian selesai.");
    } catch (error) {
        logger.error("Error dalam fungsi terjadwal sendDailySalesSummary:", error);
    }
});


/**
 * Copies a new top-up request from the root 'topUpRequests' collection 
 * to the corresponding store's subcollection for client-side history display.
 */
export const syncTopUpRequestToStore = onDocumentCreated("topUpRequests/{requestId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        logger.info("No data associated with the syncTopUpRequestToStore event, exiting.");
        return;
    }

    const requestData = snapshot.data();
    const { storeId } = requestData;

    if (!storeId) {
        logger.error("Top-up request is missing 'storeId' field.", { id: snapshot.id });
        return;
    }
    
    try {
        // Path to the subcollection in the store document
        const historyRef = db.collection('stores').doc(storeId).collection('topUpRequests').doc(snapshot.id);
        
        // Copy the data
        await historyRef.set(requestData);

        logger.info(`Successfully synced top-up request ${snapshot.id} to store ${storeId}`);
    } catch (error) {
        logger.error(`Failed to sync top-up request ${snapshot.id} for store ${storeId}:`, error);
    }
});


/**
 * Handles the business logic when a top-up request is updated.
 * It always syncs the data to the store's subcollection and handles token logic
 * if the status changes to 'completed'.
 */
export const onTopUpRequestUpdate = onDocumentUpdated("topUpRequests/{requestId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) {
    logger.info("No data change detected in onTopUpRequestUpdate, exiting.");
    return;
  }

  const { storeId, status, amount } = after;
  const requestId = event.params.requestId;

  if (!storeId) {
    logger.error(`Request ${requestId} is missing 'storeId'. Cannot process update.`);
    return;
  }

  const storeRef = db.collection('stores').doc(storeId);
  const historyRef = storeRef.collection('topUpRequests').doc(requestId);

  try {
    // Check if the status changed from something else to 'completed'.
    if (before.status !== 'completed' && status === 'completed') {
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        throw new Error(`Invalid 'amount' for completed request ${requestId}`);
      }

      const settingsRef = db.collection('appSettings').doc('transactionFees');
      const settingsDoc = await settingsRef.get();
      const settingsData = settingsDoc.data() as TransactionFeeSettings | undefined;
      const tokenValueRp = settingsData?.tokenValueRp || 1000;
      const tokensToAdd = amount / tokenValueRp;

      // Use a transaction to ensure atomicity of token update and history sync.
      await db.runTransaction(async (transaction) => {
        const storeDoc = await transaction.get(storeRef);
        if (!storeDoc.exists) {
          throw new Error(`Store with ID ${storeId} not found.`);
        }
        
        // 1. Increment store's token balance.
        transaction.update(storeRef, {
          pradanaTokenBalance: FieldValue.increment(tokensToAdd)
        });

        // 2. Sync the latest data to the history subcollection.
        transaction.set(historyRef, after, { merge: true });
      });

      logger.info(`Successfully processed COMPLETED top-up ${requestId} for store ${storeId}. Added ${tokensToAdd} tokens and synced data.`);
    
    } else {
      // For any other update (including status changes to 'rejected' or simple metadata changes),
      // just sync the latest data to the history subcollection.
      await historyRef.set(after, { merge: true });
      logger.info(`Successfully synced update for request ${requestId} to store ${storeId}. New status: ${status}`);
    }

  } catch (error) {
    logger.error(`Failed to process top-up update for request ${requestId} for store ${storeId}:`, error);
  }
});
