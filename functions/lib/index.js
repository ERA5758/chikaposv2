"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendDailySalesSummary = exports.onTopUpRequestUpdate = exports.onTopUpRequestCreate = exports.processWhatsappQueue = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const logger = __importStar(require("firebase-functions/logger"));
const firestore_2 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
const date_fns_1 = require("date-fns");
const locale_1 = require("date-fns/locale");
const url_1 = require("url");
// Initialize Firebase Admin SDK
(0, app_1.initializeApp)();
const db = (0, firestore_2.getFirestore)();
/**
 * Fetches WhatsApp settings.
 * If storeId is 'platform', it fetches global settings from appSettings.
 * Otherwise, it fetches store-specific settings (if any).
 */
async function getWhatsappSettings(storeId = 'platform') {
    const defaultSettings = { deviceId: '', adminGroup: '' };
    let settingsDocRef;
    if (storeId === 'platform') {
        settingsDocRef = db.collection('appSettings').doc('whatsappConfig');
    }
    else {
        // Fallback to platform settings if store-specific settings are not the primary goal for this function.
        settingsDocRef = db.collection('appSettings').doc('whatsappConfig');
    }
    try {
        const docSnap = await settingsDocRef.get();
        if (docSnap.exists) {
            return Object.assign(Object.assign({}, defaultSettings), docSnap.data());
        }
        else {
            logger.warn(`WhatsApp settings document not found at ${settingsDocRef.path}. Returning default.`);
            return defaultSettings;
        }
    }
    catch (error) {
        logger.error(`Error fetching WhatsApp settings from ${settingsDocRef.path}:`, error);
        return defaultSettings;
    }
}
exports.processWhatsappQueue = (0, firestore_1.onDocumentCreated)("whatsappQueue/{messageId}", async (event) => {
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
            throw new Error(`WhatsApp deviceId is not configured for store '${storeId}' or platform.`);
        }
        const recipient = (to === 'admin_group' && isGroup) ? adminGroup : to;
        if (!recipient) {
            throw new Error(`Recipient is invalid. 'to' field was '${to}' and adminGroup is not set.`);
        }
        const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
        const body = new url_1.URLSearchParams();
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
        const responseJson = await response.json();
        if (!response.ok || responseJson.status === 'error') {
            throw new Error(responseJson.reason || `WhaCenter API error with status ${response.status}`);
        }
        logger.info(`Successfully sent WhatsApp message via queue to ${recipient}`);
        return snapshot.ref.update({ status: 'sent', sentAt: firestore_2.FieldValue.serverTimestamp() });
    }
    catch (error) {
        logger.error(`Failed to process WhatsApp message for recipient '${to}':`, error);
        return snapshot.ref.update({ status: 'failed', error: error.message, processedAt: firestore_2.FieldValue.serverTimestamp() });
    }
});
/**
 * Triggers when a new top-up request is created.
 * It syncs the request to the store's subcollection and sends a notification to the admin group.
 */
exports.onTopUpRequestCreate = (0, firestore_1.onDocumentCreated)("topUpRequests/{requestId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        logger.info("No data for onTopUpRequestCreate event, exiting.");
        return;
    }
    const requestData = snapshot.data();
    const { storeId, storeName, tokensToAdd, proofUrl, userName } = requestData;
    if (!storeId || !storeName) {
        logger.error("Top-up request is missing 'storeId' or 'storeName'.", { id: snapshot.id });
        return;
    }
    const whatsappQueueRef = db.collection('whatsappQueue');
    try {
        // Path to the subcollection in the store document for history
        const historyRef = db.collection('stores').doc(storeId).collection('topUpRequests').doc(snapshot.id);
        // 1. Sync the data to the store's subcollection
        await historyRef.set(requestData);
        logger.info(`Synced top-up request ${snapshot.id} to store ${storeId}`);
        // 2. Send notification to admin group
        const formattedAmount = (tokensToAdd || 0).toLocaleString('id-ID');
        const adminMessage = `🔔 *Permintaan Top-up Baru*\n\nToko: *${storeName}*\nPengaju: *${userName || 'N/A'}*\nJumlah: *${formattedAmount} token*\n\nMohon segera verifikasi di konsol admin.\nBukti: ${proofUrl || 'Tidak ada'}`;
        await whatsappQueueRef.add({
            to: 'admin_group',
            message: adminMessage,
            isGroup: true,
            storeId: 'platform', // Use platform settings for admin notifications
            createdAt: firestore_2.FieldValue.serverTimestamp(),
        });
        logger.info(`Queued new top-up request notification for admin group.`);
    }
    catch (error) {
        logger.error(`Failed to process new top-up request ${snapshot.id} for store ${storeId}:`, error);
    }
});
/**
 * Handles logic when a top-up request is updated (approved/rejected).
 * Sends notifications to the customer and admin group via whatsappQueue.
 */
exports.onTopUpRequestUpdate = (0, firestore_1.onDocumentUpdated)("topUpRequests/{requestId}", async (event) => {
    var _a, _b, _c, _d;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after) {
        logger.info("No data change detected in onTopUpRequestUpdate, exiting.");
        return;
    }
    // Proceed only if the status has changed from pending to something else.
    if (before.status !== 'pending' || before.status === after.status) {
        return;
    }
    const { storeId, storeName, status, tokensToAdd, userId } = after;
    const requestId = event.params.requestId;
    if (!storeId || !storeName) {
        logger.error(`Request ${requestId} is missing 'storeId' or 'storeName'. Cannot process update.`);
        return;
    }
    const whatsappQueueRef = db.collection('whatsappQueue');
    const formattedAmount = (tokensToAdd || 0).toLocaleString('id-ID');
    // Get customer's WhatsApp number and name from their user profile
    let customerWhatsapp = '';
    let customerName = after.userName || 'Pelanggan';
    if (userId) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                customerWhatsapp = ((_c = userDoc.data()) === null || _c === void 0 ? void 0 : _c.whatsapp) || '';
                customerName = ((_d = userDoc.data()) === null || _d === void 0 ? void 0 : _d.name) || customerName;
            }
        }
        catch (userError) {
            logger.error(`Could not fetch user document for UID ${userId}:`, userError);
        }
    }
    let customerMessage = '';
    let adminMessage = '';
    if (status === 'disetujui') {
        customerMessage = `✅ *Top-up Disetujui!*\n\nHalo ${customerName},\nPermintaan top-up Anda untuk toko *${storeName}* telah disetujui.\n\nSejumlah *${formattedAmount} token* telah ditambahkan ke saldo Anda.\n\nTerima kasih!`;
        adminMessage = `✅ *Top-up Disetujui*\n\nPermintaan dari: *${storeName}*\nJumlah: *${formattedAmount} token*\n\nStatus berhasil diperbarui dan saldo toko telah ditambahkan.`;
    }
    else if (status === 'ditolak') {
        customerMessage = `❌ *Top-up Ditolak*\n\nHalo ${customerName},\nMohon maaf, permintaan top-up Anda untuk toko *${storeName}* sejumlah ${formattedAmount} token telah ditolak.\n\nSilakan periksa bukti transfer Anda dan coba lagi, atau hubungi admin jika ada pertanyaan.`;
        adminMessage = `❌ *Top-up Ditolak*\n\nPermintaan dari: *${storeName}*\nJumlah: *${formattedAmount} token*\n\nStatus berhasil diperbarui. Tidak ada perubahan pada saldo toko.`;
    }
    else {
        // Do nothing for other status changes
        return;
    }
    try {
        // Queue notification for customer
        if (customerWhatsapp) {
            const formattedPhone = customerWhatsapp.startsWith('0') ? `62${customerWhatsapp.substring(1)}` : customerWhatsapp;
            await whatsappQueueRef.add({
                to: formattedPhone,
                message: customerMessage,
                storeId: 'platform', // Use platform settings for sending to customer
                createdAt: firestore_2.FieldValue.serverTimestamp(),
            });
            logger.info(`Queued '${status}' notification for customer ${customerName} of store ${storeId}`);
        }
        else {
            logger.warn(`User ${userId} for store ${storeId} does not have a WhatsApp number. Cannot send notification.`);
        }
        // Queue notification for admin group
        await whatsappQueueRef.add({
            to: 'admin_group',
            message: adminMessage,
            isGroup: true,
            storeId: 'platform', // Use platform settings
            createdAt: firestore_2.FieldValue.serverTimestamp(),
        });
        logger.info(`Queued '${status}' notification for admin group for request from ${storeName}.`);
    }
    catch (error) {
        logger.error(`Failed to queue notifications for request ${requestId}:`, error);
    }
});
exports.sendDailySalesSummary = (0, scheduler_1.onSchedule)({
    schedule: "1 0 * * *", // Runs at 00:01 every day
    timeZone: "Asia/Jakarta",
}, async (event) => {
    logger.info("Memulai pengiriman ringkasan penjualan harian...");
    try {
        const storesSnapshot = await db.collection('stores').get();
        if (storesSnapshot.empty) {
            logger.info("Tidak ada toko yang terdaftar. Proses dihentikan.");
            return;
        }
        const promises = storesSnapshot.docs.map(async (storeDoc) => {
            var _a;
            const store = storeDoc.data();
            const storeId = storeDoc.id;
            if (((_a = store.notificationSettings) === null || _a === void 0 ? void 0 : _a.dailySummaryEnabled) === false) {
                logger.info(`Pengiriman ringkasan harian dinonaktifkan untuk toko: ${store.name}`);
                return;
            }
            if (!store.adminUids || store.adminUids.length === 0) {
                logger.warn(`Toko ${store.name} tidak memiliki admin.`);
                return;
            }
            // Calculate date range for yesterday
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
            const endOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
            const transactionsSnapshot = await db.collectionGroup('transactions')
                .where('storeId', '==', storeId)
                .where('createdAt', '>=', startOfDay)
                .where('createdAt', '<=', endOfDay)
                .get();
            let totalRevenue = 0;
            const totalTransactions = transactionsSnapshot.size;
            transactionsSnapshot.forEach(txDoc => {
                totalRevenue += txDoc.data().totalAmount || 0;
            });
            logger.info(`Toko: ${store.name}, Omset Kemarin: Rp ${totalRevenue}, Transaksi: ${totalTransactions}`);
            // Fetch admin details
            const adminDocs = await Promise.all(store.adminUids.map((uid) => db.collection('users').doc(uid).get()));
            const formattedDate = (0, date_fns_1.format)(yesterday, "EEEE, d MMMM yyyy", { locale: locale_1.id });
            for (const adminDoc of adminDocs) {
                if (adminDoc.exists) {
                    const adminData = adminDoc.data();
                    if (adminData && adminData.whatsapp) {
                        const message = `*Ringkasan Harian Chika POS*\n*${store.name}* - ${formattedDate}\n\nHalo *${adminData.name}*, berikut adalah ringkasan penjualan Anda kemarin:\n- *Total Omset*: Rp ${totalRevenue.toLocaleString('id-ID')}\n- *Jumlah Transaksi*: ${totalTransactions}\n\nTerus pantau dan optimalkan performa penjualan Anda melalui dasbor Chika. Semangat selalu! 💪\n\n_Apabila tidak berkenan, fitur ini dapat dinonaktifkan di menu Pengaturan._`;
                        await db.collection('whatsappQueue').add({
                            to: adminData.whatsapp,
                            message: message,
                            isGroup: false,
                            storeId: storeId,
                            createdAt: firestore_2.FieldValue.serverTimestamp(),
                        });
                        logger.info(`Laporan harian berhasil diantrikan untuk ${adminData.name} (${store.name})`);
                    }
                }
            }
        });
        await Promise.all(promises);
        logger.info("Pengiriman ringkasan penjualan harian selesai.");
    }
    catch (error) {
        logger.error("Error dalam fungsi terjadwal sendDailySalesSummary:", error);
    }
});
//# sourceMappingURL=index.js.map