
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/server/firebase-admin';
import { getTransactionFeeSettings } from '@/lib/server/app-settings';
import { getWhatsappSettings } from '@/lib/server/whatsapp-settings';
import { internalSendWhatsapp, formatWhatsappNumber } from '@/lib/server/whatsapp';


export async function POST(req: NextRequest) {
  const { auth, db } = getFirebaseAdmin();
  
  const { storeName, storeLocation, adminName, email, whatsapp, password, referralCode, catalogSlug } = await req.json();
  if (!storeName || !storeLocation || !adminName || !email || !whatsapp || !password || !catalogSlug) {
    return NextResponse.json({ error: 'Missing required registration data.' }, { status: 400 });
  }

  let newUser = null;

  try {
    const feeSettings = await getTransactionFeeSettings();
    const bonusTokens = feeSettings.newStoreBonusTokens || 0;

    const userRecord = await auth.createUser({ email, password, displayName: adminName });
    newUser = userRecord;
    const uid = newUser.uid;
    
    await auth.setCustomUserClaims(uid, { role: 'admin' });

    const batch = db.batch();
    const storeId = uid;
    const storeRef = db.collection('stores').doc(storeId);
    batch.set(storeRef, {
      name: storeName,
      location: storeLocation,
      pradanaTokenBalance: bonusTokens,
      adminUids: [uid],
      createdAt: new Date().toISOString(),
      transactionCounter: 0,
      firstTransactionDate: null,
      referralCode: referralCode || '',
      catalogSlug: catalogSlug,
    });

    const userRef = db.collection('users').doc(uid);
    batch.set(userRef, {
      name: adminName,
      email: email,
      whatsapp: whatsapp,
      role: 'admin',
      status: 'active',
      storeId: storeRef.id,
    });

    await batch.commit();
    console.info(`New store and admin created successfully for ${email}`);

    // --- Handle WhatsApp notifications directly ---
    (async () => {
        try {
            const { adminGroup } = await getWhatsappSettings();

            // Notify User
            const welcomeMessage = `🎉 *Selamat Datang di Chika POS, ${adminName}!* 🎉\n\nToko Anda *"${storeName}"* telah berhasil dibuat dengan bonus *${bonusTokens} Pradana Token*.\n\nSilakan login untuk mulai mengelola bisnis Anda.`;
            const formattedPhone = formatWhatsappNumber(whatsapp);
            if (formattedPhone) {
                await internalSendWhatsapp(formattedPhone, welcomeMessage);
            }

            // Notify Platform Admin
            if (adminGroup) {
                const adminMessage = `*PENDAFTARAN TOKO BARU*\n\n*Nama Toko:* ${storeName}\n*Lokasi:* ${storeLocation}\n*Admin:* ${adminName}\n*Email:* ${email}\n*WhatsApp:* ${whatsapp}\n\nBonus ${bonusTokens} token telah diberikan.`;
                await internalSendWhatsapp(adminGroup, adminMessage, true);
            }
        } catch (whatsappError) {
            console.error("Error sending registration WhatsApp notifications:", whatsappError);
        }
    })();
    
    return NextResponse.json({ success: true, storeId });

  } catch (error: any) {
    if (newUser) {
      await auth.deleteUser(newUser.uid).catch(delErr => console.error(`Failed to clean up orphaned user ${newUser?.uid}`, delErr));
    }
    console.error('Error in registerNewStore function:', error);
    
    let errorMessage = 'An unknown error occurred during registration.';
    if (error.code === 'auth/email-already-exists') {
        errorMessage = 'Email ini sudah terdaftar. Silakan gunakan email lain.';
    } else {
        errorMessage = error.message || errorMessage;
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
