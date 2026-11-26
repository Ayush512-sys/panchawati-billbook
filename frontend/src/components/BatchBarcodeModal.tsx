import React, { useState, useEffect } from 'react';
import { X, Printer, Check, Copy } from 'lucide-react';
import QRCode from 'qrcode';

interface InwardItem {
  id: number;
  name: string;
  code?: string;
  quantity: number;
  selling_price: number;
  purchase_price?: number;
}

interface BatchBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InwardItem[];
}

export default function BatchBarcodeModal({ isOpen, onClose, items }: BatchBarcodeModalProps) {
  const [printMultiples, setPrintMultiples] = useState(true);
  const [qrCodes, setQrCodes] = useState<{ [id: number]: string }>({});
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    if (isOpen && items.length > 0) {
      setIsGenerating(true);
      const promises = items.map(async (item) => {
        const val = item.code || `PROD-${item.id}`;
        try {
          const url = await QRCode.toDataURL(val, { width: 140, margin: 1 });
          return { id: item.id, url };
        } catch (e) {
          return { id: item.id, url: '' };
        }
      });

      Promise.all(promises).then((results) => {
        const map: { [id: number]: string } = {};
        results.forEach((r) => {
          map[r.id] = r.url;
        });
        setQrCodes(map);
        setIsGenerating(false);
      });
    }
  }, [isOpen, items]);

  if (!isOpen || items.length === 0) return null;

  // Compute printable labels list
  const labelsToPrint: { item: InwardItem; index: number }[] = [];
  items.forEach((item) => {
    const count = printMultiples ? Math.max(1, item.quantity) : 1;
    for (let i = 0; i < count; i++) {
      labelsToPrint.push({ item, index: i + 1 });
    }
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      {/* PRINT-ONLY CSS CONTAINER (Hidden on screen, active only when window.print is called) */}
      <div className="hidden print:block w-full">
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #thermal-print-area, #thermal-print-area * {
              visibility: visible;
            }
            #thermal-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .label-page-break {
              page-break-after: always;
              break-after: page;
              height: 48mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 4px;
              box-sizing: border-box;
            }
          }
        `}</style>

        <div id="thermal-print-area">
          {labelsToPrint.map((lbl, idx) => (
            <div key={idx} className="label-page-break text-black text-center font-sans">
              <div className="font-bold text-[13px] tracking-tight uppercase border-b border-black w-full pb-0.5 truncate">
                PANCHAWATI AUTOMOBILES
              </div>
              {qrCodes[lbl.item.id] && (
                <img
                  src={qrCodes[lbl.item.id]}
                  alt="QR"
                  style={{ width: '100px', height: '100px', margin: '2px auto' }}
                />
              )}
              <div className="text-[11px] font-mono font-bold tracking-wider">{lbl.item.code || `ID:${lbl.item.id}`}</div>
              <div className="text-[12px] font-bold uppercase truncate w-full px-1 leading-tight">{lbl.item.name}</div>
              <div className="text-[15px] font-extrabold mt-0.5 border-t border-black w-full pt-0.5">
                Rs. {lbl.item.selling_price?.toLocaleString('en-IN') || 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ON-SCREEN MODAL */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-zinc-800 flex flex-col max-h-[90vh] print:hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Batch Barcode Label Printing</h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Print shelf tags & part stickers for newly inwarded stock
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Print Mode Selector */}
          <div className="bg-indigo-50/50 dark:bg-zinc-800/50 p-4 rounded-xl border border-indigo-100 dark:border-zinc-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Print Quantity Mode</h4>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Total labels queued: <strong className="text-indigo-600 dark:text-indigo-400">{labelsToPrint.length} labels</strong>
              </p>
            </div>

            <div className="flex items-center space-x-2 bg-white dark:bg-zinc-800 p-1 rounded-lg border border-gray-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setPrintMultiples(true)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  printMultiples ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-zinc-300'
                }`}
              >
                1 Sticker Per Piece ({items.reduce((s, i) => s + (i.quantity || 1), 0)})
              </button>
              <button
                type="button"
                onClick={() => setPrintMultiples(false)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  !printMultiples ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-zinc-300'
                }`}
              >
                1 Sticker Per Item ({items.length})
              </button>
            </div>
          </div>

          {/* Label Preview Grid */}
          <div>
            <h4 className="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
              Preview Stickers (Formatted for 48mm / 58mm Thermal Printers):
            </h4>
            {isGenerating ? (
              <div className="p-8 text-center text-sm text-gray-500">Generating QR Codes...</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto p-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-center shadow-sm flex flex-col items-center"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-tight text-gray-500 mb-0.5 truncate w-full">
                      PANCHAWATI
                    </span>
                    {qrCodes[item.id] ? (
                      <img src={qrCodes[item.id]} alt="QR" className="w-20 h-20 object-contain my-1" />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 flex items-center justify-center text-[10px]">QR</div>
                    )}
                    <span className="text-[10px] font-mono font-bold text-gray-700 dark:text-zinc-300 truncate w-full">
                      {item.code || `ID: ${item.id}`}
                    </span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white uppercase truncate w-full">
                      {item.name}
                    </span>
                    <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
                      ₹{item.selling_price?.toLocaleString('en-IN') || 0}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      Qty: {item.quantity} pcs
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            Done / Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-md transition-transform active:scale-95 flex items-center"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print All {labelsToPrint.length} Labels Now
          </button>
        </div>
      </div>
    </div>
  );
}
