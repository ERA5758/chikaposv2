
'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode as QrCodeIcon, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

interface QrCodeDialogProps {
  catalogUrl: string;
  storeName: string;
  children: React.ReactNode;
}

export function QrCodeDialog({ catalogUrl, storeName, children }: QrCodeDialogProps) {
  const qrCodeRef = React.useRef<HTMLDivElement>(null);

  const downloadQRCode = () => {
    if (qrCodeRef.current) {
      const canvas = qrCodeRef.current.querySelector('canvas');
      if (canvas) {
        const pngUrl = canvas
          .toDataURL('image/png')
          .replace('image/png', 'image/octet-stream');
        let downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `qr-code-${storeName.toLowerCase().replace(/\s+/g, '-')}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan QR Code</DialogTitle>
          <DialogDescription>
            Pindai kode ini untuk membuka katalog {storeName}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center p-4" ref={qrCodeRef}>
          <QRCodeCanvas value={catalogUrl} size={256} />
        </div>
        <Button onClick={downloadQRCode}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </DialogContent>
    </Dialog>
  );
}
