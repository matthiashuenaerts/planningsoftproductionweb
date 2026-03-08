import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Radio, Usb, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { qrCodeService } from '@/services/qrCodeService';
import { supabase } from '@/integrations/supabase/client';

interface KeyboardScannerListenerProps {
  isOpen: boolean;
  onClose: () => void;
  onCodeDetected: (code: string) => void;
  workstationName: string;
  workstationId?: string;
}

interface ScanResult {
  code: string;
  status: 'success' | 'not_found' | 'error';
  message: string;
  partsCompleted?: number;
  timestamp: number;
}

const MAX_KEY_INTERVAL_MS = 80; // USB scanners type faster than humans
const MIN_CODE_LENGTH = 3;
const RESULT_DISPLAY_MS = 2000;
const MAX_HISTORY = 20;

export const KeyboardScannerListener: React.FC<KeyboardScannerListenerProps> = ({
  isOpen,
  onClose,
  onCodeDetected,
  workstationName,
  workstationId,
}) => {
  const { toast } = useToast();
  const [listening, setListening] = useState(false);
  const [serialConnected, setSerialConnected] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [currentBuffer, setCurrentBuffer] = useState('');

  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const serialPortRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Process a scanned code
  const processCode = useCallback(async (rawCode: string) => {
    const code = rawCode.trim();
    if (code.length < MIN_CODE_LENGTH || processing) return;

    // Remove first character (barcode prefix) — same logic as QRCodeScanner
    const processedCode = code.length > 1 ? code.substring(1) : code;

    setProcessing(true);

    try {
      const part = await qrCodeService.findPartByQRCode(processedCode);

      if (!part) {
        const result: ScanResult = {
          code: processedCode,
          status: 'not_found',
          message: `"${processedCode}" niet gevonden`,
          timestamp: Date.now(),
        };
        setScanHistory(prev => [result, ...prev].slice(0, MAX_HISTORY));
        setProcessing(false);
        return;
      }

      // Update workstation status
      await qrCodeService.updatePartWorkstationStatus(part.id, workstationName);

      // Complete part_workstation_tracking
      let partsCompleted = 0;
      if (workstationId) {
        const { data, error } = await supabase
          .from('part_workstation_tracking')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('part_id', part.id)
          .eq('workstation_id', workstationId)
          .eq('status', 'pending')
          .select();

        if (!error && data) {
          partsCompleted = data.length;
        }
      }

      const result: ScanResult = {
        code: processedCode,
        status: 'success',
        message: `✓ ${processedCode}`,
        partsCompleted,
        timestamp: Date.now(),
      };
      setScanHistory(prev => [result, ...prev].slice(0, MAX_HISTORY));
      onCodeDetected(processedCode);
    } catch (error: any) {
      const result: ScanResult = {
        code: processedCode,
        status: 'error',
        message: `Fout: ${error.message}`,
        timestamp: Date.now(),
      };
      setScanHistory(prev => [result, ...prev].slice(0, MAX_HISTORY));
    } finally {
      setProcessing(false);
    }
  }, [workstationName, workstationId, onCodeDetected, processing]);

  // Keyboard listener for HID scanners
  useEffect(() => {
    if (!isOpen || !listening) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();

      // If too much time passed, reset buffer (user is typing, not scanner)
      if (now - lastKeyTimeRef.current > MAX_KEY_INTERVAL_MS && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= MIN_CODE_LENGTH) {
          e.preventDefault();
          const code = bufferRef.current;
          bufferRef.current = '';
          setCurrentBuffer('');
          processCode(code);
        } else {
          bufferRef.current = '';
          setCurrentBuffer('');
        }
      } else if (e.key.length === 1) {
        // Only single printable characters
        bufferRef.current += e.key;
        setCurrentBuffer(bufferRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, listening, processCode]);

  // WebSerial COM port connection
  const connectSerialPort = async () => {
    if (!('serial' in navigator)) {
      toast({
        title: 'WebSerial niet ondersteund',
        description: 'Uw browser ondersteunt geen seriële poort verbinding. Gebruik Chrome of Edge.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      serialPortRef.current = port;
      setSerialConnected(true);

      // Start reading
      abortControllerRef.current = new AbortController();
      readSerialPort(port);

      toast({
        title: 'COM poort verbonden',
        description: 'Scanner is verbonden via seriële poort.',
      });
    } catch (error: any) {
      if (error.name !== 'NotFoundError') {
        console.error('Serial port error:', error);
        toast({
          title: 'Verbindingsfout',
          description: error.message || 'Kon geen verbinding maken met de seriële poort.',
          variant: 'destructive',
        });
      }
    }
  };

  const readSerialPort = async (port: any) => {
    const decoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(decoder.writable, {
      signal: abortControllerRef.current?.signal,
    });

    const reader = decoder.readable.getReader();
    serialReaderRef.current = reader;
    let serialBuffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          for (const char of value) {
            if (char === '\n' || char === '\r') {
              if (serialBuffer.length >= MIN_CODE_LENGTH) {
                processCode(serialBuffer);
              }
              serialBuffer = '';
            } else {
              serialBuffer += char;
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Serial read error:', error);
      }
    } finally {
      reader.releaseLock();
    }
  };

  const disconnectSerialPort = async () => {
    try {
      abortControllerRef.current?.abort();
      if (serialReaderRef.current) {
        try { await serialReaderRef.current.cancel(); } catch {}
        serialReaderRef.current = null;
      }
      if (serialPortRef.current) {
        try { await serialPortRef.current.close(); } catch {}
        serialPortRef.current = null;
      }
      setSerialConnected(false);
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  const startListening = () => {
    setListening(true);
    bufferRef.current = '';
    setCurrentBuffer('');
  };

  const stopListening = () => {
    setListening(false);
    bufferRef.current = '';
    setCurrentBuffer('');
  };

  const handleClose = async () => {
    stopListening();
    await disconnectSerialPort();
    setScanHistory([]);
    onClose();
  };

  const supportsSerial = 'serial' in navigator;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Scanner Listener - {workstationName}
          </DialogTitle>
          <DialogDescription>
            Luister naar input van een aangesloten USB/COM barcode scanner
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0">
          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            {!listening ? (
              <Button onClick={startListening} className="gap-2">
                <Radio className="h-4 w-4" />
                Start Luisteren
              </Button>
            ) : (
              <Button onClick={stopListening} variant="destructive" className="gap-2">
                <X className="h-4 w-4" />
                Stop Luisteren
              </Button>
            )}

            {supportsSerial && (
              !serialConnected ? (
                <Button onClick={connectSerialPort} variant="outline" className="gap-2">
                  <Usb className="h-4 w-4" />
                  COM Poort Verbinden
                </Button>
              ) : (
                <Button onClick={disconnectSerialPort} variant="outline" className="gap-2 border-green-500 text-green-600">
                  <Usb className="h-4 w-4" />
                  COM Verbonden ✓
                </Button>
              )
            )}
          </div>

          {/* Status indicator */}
          <div className={`flex items-center gap-3 p-4 rounded-lg border ${
            listening ? 'border-green-300 bg-green-50 dark:bg-green-950/20' : 'border-border bg-muted/30'
          }`}>
            <div className={`h-3 w-3 rounded-full ${listening ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {listening ? 'Luistert naar scanner input...' : 'Scanner listener gestopt'}
              </p>
              {listening && currentBuffer && (
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  Buffer: {currentBuffer}
                </p>
              )}
              {processing && (
                <div className="flex items-center gap-1 mt-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <p className="text-xs text-muted-foreground">Verwerken...</p>
                </div>
              )}
            </div>
            {serialConnected && (
              <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded-full">
                COM
              </span>
            )}
          </div>

          {/* Scan history */}
          {scanHistory.length > 0 && (
            <div className="flex-1 min-h-0">
              <h4 className="text-sm font-medium mb-2">Scan Geschiedenis ({scanHistory.length})</h4>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {scanHistory.map((result, idx) => (
                  <div
                    key={`${result.code}-${result.timestamp}`}
                    className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                      result.status === 'success'
                        ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300'
                        : result.status === 'not_found'
                        ? 'bg-orange-50 dark:bg-orange-950/20 text-orange-800 dark:text-orange-300'
                        : 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300'
                    }`}
                  >
                    {result.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span className="font-mono truncate flex-1">{result.message}</span>
                    {result.partsCompleted != null && result.partsCompleted > 0 && (
                      <span className="text-xs opacity-70">{result.partsCompleted} tracking</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 mr-1" />
            Sluiten
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
