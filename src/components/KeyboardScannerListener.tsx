import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { X, Radio, Usb, CheckCircle2, AlertCircle, Loader2, Settings2, Keyboard } from 'lucide-react';
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
  rawCode: string;
  status: 'success' | 'not_found' | 'error';
  message: string;
  partsCompleted?: number;
  timestamp: number;
}

const MAX_HISTORY = 50;

// Common baud rates for serial scanners
const BAUD_RATES = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

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
  const [showSettings, setShowSettings] = useState(false);

  // Configurable settings
  const [maxKeyInterval, setMaxKeyInterval] = useState(150); // ms between keys to detect scanner vs human
  const [minCodeLength, setMinCodeLength] = useState(1); // minimum code length to accept
  const [stripPrefix, setStripPrefix] = useState(true); // remove first character
  const [stripSuffix, setStripSuffix] = useState(false); // remove last character
  const [selectedBaudRate, setSelectedBaudRate] = useState(9600);
  const [terminator, setTerminator] = useState<'enter' | 'tab' | 'both'>('both'); // what ends a scan
  const [acceptAllInput, setAcceptAllInput] = useState(true); // accept even slow typed input
  const [manualInput, setManualInput] = useState(''); // for manual code entry

  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const serialPortRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Process a scanned code
  const processCode = useCallback(async (rawCode: string) => {
    let code = rawCode.trim();
    if (code.length < minCodeLength) return;
    if (processing) return;

    const originalCode = code;

    // Apply prefix/suffix stripping
    if (stripPrefix && code.length > 1) {
      code = code.substring(1);
    }
    if (stripSuffix && code.length > 1) {
      code = code.substring(0, code.length - 1);
    }

    setProcessing(true);

    try {
      const part = await qrCodeService.findPartByQRCode(code);

      if (!part) {
        // Try without stripping as fallback
        let fallbackPart = null;
        if (stripPrefix || stripSuffix) {
          fallbackPart = await qrCodeService.findPartByQRCode(originalCode);
        }

        if (fallbackPart) {
          // Fallback found with original code
          await qrCodeService.updatePartWorkstationStatus(fallbackPart.id, workstationName);

          let partsCompleted = 0;
          if (workstationId) {
            const { data, error } = await supabase
              .from('part_workstation_tracking')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('part_id', fallbackPart.id)
              .eq('workstation_id', workstationId)
              .eq('status', 'pending')
              .select();
            if (!error && data) partsCompleted = data.length;
          }

          const result: ScanResult = {
            code: originalCode,
            rawCode: rawCode,
            status: 'success',
            message: `✓ ${originalCode} (origineel)`,
            partsCompleted,
            timestamp: Date.now(),
          };
          setScanHistory(prev => [result, ...prev].slice(0, MAX_HISTORY));
          onCodeDetected(originalCode);
        } else {
          const result: ScanResult = {
            code,
            rawCode: rawCode,
            status: 'not_found',
            message: `"${code}" niet gevonden`,
            timestamp: Date.now(),
          };
          setScanHistory(prev => [result, ...prev].slice(0, MAX_HISTORY));
        }
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
        if (!error && data) partsCompleted = data.length;
      }

      const result: ScanResult = {
        code,
        rawCode: rawCode,
        status: 'success',
        message: `✓ ${code}`,
        partsCompleted,
        timestamp: Date.now(),
      };
      setScanHistory(prev => [result, ...prev].slice(0, MAX_HISTORY));
      onCodeDetected(code);
    } catch (error: any) {
      const result: ScanResult = {
        code,
        rawCode: rawCode,
        status: 'error',
        message: `Fout: ${error.message}`,
        timestamp: Date.now(),
      };
      setScanHistory(prev => [result, ...prev].slice(0, MAX_HISTORY));
    } finally {
      setProcessing(false);
    }
  }, [workstationName, workstationId, onCodeDetected, processing, minCodeLength, stripPrefix, stripSuffix]);

  // Keyboard listener for HID scanners
  useEffect(() => {
    if (!isOpen || !listening) return;

    const isTerminator = (key: string) => {
      if (terminator === 'enter') return key === 'Enter';
      if (terminator === 'tab') return key === 'Tab';
      return key === 'Enter' || key === 'Tab';
    };

    const flushBuffer = () => {
      if (bufferRef.current.length >= minCodeLength) {
        const code = bufferRef.current;
        bufferRef.current = '';
        setCurrentBuffer('');
        processCode(code);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in the manual input or settings
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      const now = Date.now();

      // If not accepting all input, reset buffer on slow typing
      if (!acceptAllInput && now - lastKeyTimeRef.current > maxKeyInterval && bufferRef.current.length > 0) {
        bufferRef.current = '';
        setCurrentBuffer('');
      }
      lastKeyTimeRef.current = now;

      // Clear any pending flush timer
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      if (isTerminator(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        flushBuffer();
      } else if (e.key.length === 1) {
        bufferRef.current += e.key;
        setCurrentBuffer(bufferRef.current);

        // Auto-flush after timeout (for scanners that don't send Enter/Tab)
        if (acceptAllInput) {
          flushTimerRef.current = setTimeout(() => {
            if (bufferRef.current.length >= minCodeLength) {
              flushBuffer();
            }
          }, 500);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, [isOpen, listening, processCode, maxKeyInterval, minCodeLength, terminator, acceptAllInput]);

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
      // Request port with no filters — accept ANY device
      const port = await (navigator as any).serial.requestPort({ filters: [] });
      await port.open({
        baudRate: selectedBaudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
      });
      serialPortRef.current = port;
      setSerialConnected(true);

      abortControllerRef.current = new AbortController();
      readSerialPort(port);

      toast({
        title: 'COM poort verbonden',
        description: `Scanner verbonden (${selectedBaudRate} baud).`,
      });
    } catch (error: any) {
      if (error.name !== 'NotFoundError') {
        console.error('Serial port error:', error);
        toast({
          title: 'Verbindingsfout',
          description: error.message || 'Kon geen verbinding maken.',
          variant: 'destructive',
        });
      }
    }
  };

  const readSerialPort = async (port: any) => {
    const decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable, {
      signal: abortControllerRef.current?.signal,
    }).catch(() => {});

    const reader = decoder.readable.getReader();
    serialReaderRef.current = reader;
    let serialBuffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          for (const char of value) {
            if (char === '\n' || char === '\r' || char === '\t') {
              if (serialBuffer.length >= minCodeLength) {
                processCode(serialBuffer);
              }
              serialBuffer = '';
            } else {
              serialBuffer += char;
              setCurrentBuffer(serialBuffer);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Serial read error:', error);
        toast({
          title: 'Leesfout',
          description: 'Verbinding met seriële poort verloren.',
          variant: 'destructive',
        });
      }
    } finally {
      reader.releaseLock();
      setSerialConnected(false);
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

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim().length >= minCodeLength) {
      processCode(manualInput.trim());
      setManualInput('');
    }
  };

  const handleClose = async () => {
    stopListening();
    await disconnectSerialPort();
    setScanHistory([]);
    onClose();
  };

  const supportsSerial = typeof navigator !== 'undefined' && 'serial' in navigator;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Scanner Listener - {workstationName}
          </DialogTitle>
          <DialogDescription>
            Luister naar input van een USB scanner, COM poort, of voer handmatig in
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 min-h-0 overflow-y-auto">
          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            {!listening ? (
              <Button onClick={startListening} className="gap-2">
                <Keyboard className="h-4 w-4" />
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
                  COM Poort
                </Button>
              ) : (
                <Button onClick={disconnectSerialPort} variant="outline" className="gap-2 border-green-500 text-green-600">
                  <Usb className="h-4 w-4" />
                  COM ✓ ({selectedBaudRate})
                </Button>
              )
            )}

            <Button
              onClick={() => setShowSettings(!showSettings)}
              variant="ghost"
              size="icon"
              className={showSettings ? 'bg-muted' : ''}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
              <h4 className="text-sm font-medium">Scanner Instellingen</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Max toets interval (ms)</Label>
                  <Input
                    type="number"
                    min={20}
                    max={1000}
                    value={maxKeyInterval}
                    onChange={e => setMaxKeyInterval(parseInt(e.target.value) || 150)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Min. code lengte</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={minCodeLength}
                    onChange={e => setMinCodeLength(parseInt(e.target.value) || 1)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Terminator</Label>
                  <Select value={terminator} onValueChange={(v: any) => setTerminator(v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enter">Enter</SelectItem>
                      <SelectItem value="tab">Tab</SelectItem>
                      <SelectItem value="both">Enter + Tab</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Baud rate (COM)</Label>
                  <Select value={String(selectedBaudRate)} onValueChange={v => setSelectedBaudRate(parseInt(v))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BAUD_RATES.map(rate => (
                        <SelectItem key={rate} value={String(rate)}>{rate}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={stripPrefix} onCheckedChange={setStripPrefix} id="strip-prefix" />
                  <Label htmlFor="strip-prefix" className="text-xs">Eerste karakter verwijderen</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={stripSuffix} onCheckedChange={setStripSuffix} id="strip-suffix" />
                  <Label htmlFor="strip-suffix" className="text-xs">Laatste karakter verwijderen</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={acceptAllInput} onCheckedChange={setAcceptAllInput} id="accept-all" />
                  <Label htmlFor="accept-all" className="text-xs">Alle input accepteren (ook traag)</Label>
                </div>
              </div>
            </div>
          )}

          {/* Status indicator */}
          <div className={`flex items-center gap-3 p-3 rounded-lg border ${
            listening || serialConnected ? 'border-green-300 bg-green-50 dark:bg-green-950/20' : 'border-border bg-muted/30'
          }`}>
            <div className={`h-3 w-3 rounded-full flex-shrink-0 ${
              listening || serialConnected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {listening && serialConnected
                  ? 'Luistert via keyboard + COM poort...'
                  : listening
                  ? 'Luistert naar keyboard input...'
                  : serialConnected
                  ? 'Luistert via COM poort...'
                  : 'Niet actief'}
              </p>
              {(listening || serialConnected) && currentBuffer && (
                <p className="text-xs text-muted-foreground font-mono mt-1 truncate">
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
            <div className="flex gap-1 flex-shrink-0">
              {listening && (
                <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded">
                  HID
                </span>
              )}
              {serialConnected && (
                <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-1.5 py-0.5 rounded">
                  COM
                </span>
              )}
            </div>
          </div>

          {/* Manual input */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              placeholder="Handmatig code invoeren..."
              className="h-9 text-sm"
            />
            <Button type="submit" size="sm" variant="outline" disabled={manualInput.trim().length < minCodeLength || processing}>
              Verwerk
            </Button>
          </form>

          {/* Scan history */}
          {scanHistory.length > 0 && (
            <div className="flex-1 min-h-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Geschiedenis ({scanHistory.length})</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setScanHistory([])}
                >
                  Wissen
                </Button>
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {scanHistory.map((result) => (
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
