'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader, Send, Volume2, AlertCircle, RefreshCw } from 'lucide-react';
import type { Customer, Store, Transaction } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { TextToSpeechInput, TextToSpeechOutput } from '@/ai/flows/text-to-speech';
import type { OrderReadyFollowUpOutput, OrderReadyFollowUpInput } from '@/ai/flows/order-ready-follow-up';

type OrderReadyDialogProps = {
  transaction: Transaction;
  customer?: Customer;
  store: Store;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

// Firestore Caching Strategy:
// 1. On open, check if `transaction.generatedFollowUpText` exists.
// 2. If yes, use it. If no, generate it via AI.
// 3. After generation, save the new text back to the transaction document in Firestore.

export function OrderReadyDialog({
  transaction,
  customer,
  store,
  open,
  onOpenChange,
  onSuccess
}: OrderReadyDialogProps) {
  const [isGeneratingText, setIsGeneratingText] = React.useState(true);
  const [generatedText, setGeneratedText] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = React.useState(false);
  const [audioDataUri, setAudioDataUri] = React.useState('');
  
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const generateAndCacheText = React.useCallback(async () => {
    setIsGeneratingText(true);
    setError(null);
    setGeneratedText('');
    setAudioDataUri('');

    // Strategy Part 1: Check for existing text
    if (transaction.generatedFollowUpText) {
        console.log("Using cached text from Firestore.");
        setGeneratedText(transaction.generatedFollowUpText);
        setIsGeneratingText(false);
        return;
    }

    // Strategy Part 2: Generate text if not cached
    console.log("No cached text found. Generating new text via AI.");
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Authentication token not available.");

      const response = await fetch('/api/ai/order-ready-follow-up', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          customerName: customer?.name || transaction.customerName,
          storeName: store.name,
          itemsOrdered: transaction.items.map(i => i.productName),
          notificationStyle: 'fakta',
        } as OrderReadyFollowUpInput)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate creative text.');
      }

      const result: OrderReadyFollowUpOutput = await response.json();
      const newText = result.followUpMessage;
      setGeneratedText(newText);

      // Strategy Part 3: Save the new text back to Firestore
      try {
        const transactionRef = doc(db, 'stores', store.id, 'transactions', transaction.id);
        await updateDoc(transactionRef, {
          generatedFollowUpText: newText
        });
        console.log("Successfully cached new text to Firestore.");
      } catch (firestoreError) {
        console.error("Failed to cache text to Firestore:", firestoreError);
        // Non-critical error, so we just log it and don't bother the user.
      }

    } catch (e) {
      console.error("Error generating creative text:", e);
      setError((e as Error).message);
    } finally {
      setIsGeneratingText(false);
    }
  }, [customer, transaction, store]);

  React.useEffect(() => {
    if (open) {
      generateAndCacheText();
    }
  }, [open, generateAndCacheText]);

  const handleTextToSpeech = async () => {
    if (!generatedText) return;
    setIsGeneratingAudio(true);
    setAudioDataUri('');
    try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Authentication token not available.");
        const response = await fetch('/api/ai/text-to-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ text: generatedText, gender: 'female' } as TextToSpeechInput),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to generate audio.');
        }
        const result: TextToSpeechOutput = await response.json();
        setAudioDataUri(result.audioDataUri);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal Membuat Suara', description: (e as Error).message });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  React.useEffect(() => {
    if (audioDataUri && audioRef.current) {
      audioRef.current.play().catch(e => console.error("Audio playback failed:", e));
    }
  }, [audioDataUri]);

  const handleSendWhatsApp = () => {
    if (!customer?.phone) {
      toast({ variant: 'destructive', title: 'Nomor WhatsApp Tidak Ditemukan' });
      return;
    }
    const whatsappUrl = `https://wa.me/${customer.phone}?text=${encodeURIComponent(generatedText)}`;
    window.open(whatsappUrl, '_blank');
    toast({ title: "Membuka WhatsApp..." });
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Follow Up Pesanan Cerdas</DialogTitle>
          <DialogDescription>
            Panggil pelanggan atau kirim notifikasi WhatsApp dengan bantuan AI.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          
          {isGeneratingText && (
            <div className="flex items-center justify-center gap-2 py-4">
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                <span>Memeriksa & membuat teks pengumuman...</span>
            </div>
          )}

          {error && (
             <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Gagal Membuat Teks</AlertTitle>
              <AlertDescription>
                {error}
                <Button variant="ghost" size="sm" className="mt-2" onClick={generateAndCacheText}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Coba Lagi
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!isGeneratingText && generatedText && (
            <>
              <Alert variant="default">
                <AlertTitle className="font-semibold">Teks Dihasilkan AI</AlertTitle>
                <AlertDescription className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap mt-2">
                  {generatedText}
                </AlertDescription>
              </Alert>
              
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button onClick={handleTextToSpeech} disabled={isGeneratingAudio} className="w-full">
                  {isGeneratingAudio ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Volume2 className="mr-2 h-4 w-4" />}
                  Panggil Suara
                </Button>
                <Button onClick={handleSendWhatsApp} disabled={!customer?.phone} className="w-full">
                  <Send className="mr-2 h-4 w-4" /> Kirim via WhatsApp
                </Button>
              </div>

              {audioDataUri && (
                  <audio ref={audioRef} src={audioDataUri} className="w-full mt-4" controls autoPlay/>
              )}
            </>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
