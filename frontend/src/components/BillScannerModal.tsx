import React, { useState, useRef } from 'react';
import { X, Upload, Camera, FileText, CheckCircle2, AlertTriangle, Sparkles, Plus, Trash2, ArrowRight, Loader2, Key, Check } from 'lucide-react';
import api from '../api';

interface ScannedItem {
  temp_id: number;
  part_number: string;
  description: string;
  brand?: string;
  hsn_code?: string;
  quantity: number;
  purchase_rate: number;
  gst_percent?: number;
  selling_price: number;
  line_total: number;
  is_new: boolean;
  matched_product_id?: number | null;
  matched_product_name?: string | null;
  current_stock: number;
  new_stock: number;
}

interface BillScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStockInwarded: (processedItems: any[]) => void;
}

export default function BillScannerModal({ isOpen, onClose, onStockInwarded }: BillScannerModalProps) {
  const [step, setStep] = useState<'upload' | 'scanning' | 'verify'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Parsed Invoice Data
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [grandTotal, setGrandTotal] = useState(0);
  const [isMathVerified, setIsMathVerified] = useState(true);
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [autoPrintBarcodes, setAutoPrintBarcodes] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSaveApiKey = () => {
    localStorage.setItem('gemini_api_key', geminiApiKey.trim());
    setShowApiKeyInput(false);
  };

  const handleStartScan = async (file: File | null, isDemo: boolean = false) => {
    setError('');
    setStep('scanning');

    try {
      const formData = new FormData();
      if (file) {
        formData.append('billFile', file);
      }
      if (isDemo) {
        formData.append('isDemo', 'true');
      }

      const headers: any = {};
      if (geminiApiKey.trim()) {
        headers['x-gemini-api-key'] = geminiApiKey.trim();
      }

      const res = await api.post('/purchases/scan-bill', formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
        }
      });

      const data = res.data;
      setSupplierName(data.supplier_name || 'Wholesale Supplier');
      setInvoiceNumber(data.invoice_number || `INV-${Date.now().toString().slice(-6)}`);
      setInvoiceDate(data.invoice_date || new Date().toISOString().split('T')[0]);
      setGrandTotal(data.grand_total || 0);
      setIsMathVerified(data.is_math_verified);
      setItems(data.items || []);

      setStep('verify');
    } catch (err: any) {
      console.error('Scan bill error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to scan purchase bill. Please try again.');
      setStep('upload');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      handleStartScan(file, false);
    }
  };

  const handleItemChange = (index: number, field: keyof ScannedItem, val: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      if (field === 'quantity' || field === 'purchase_rate') {
        const q = field === 'quantity' ? Number(val) : copy[index].quantity;
        const r = field === 'purchase_rate' ? Number(val) : copy[index].purchase_rate;
        copy[index].line_total = q * r;
        if (field === 'purchase_rate') {
          copy[index].selling_price = Math.round(r * 1.25);
        }
      }
      return copy;
    });
  };

  const handleDeleteItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCommitStock = async () => {
    if (items.length === 0) {
      alert('Please add at least one item.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      const res = await api.post('/purchases/commit-inward-stock', {
        supplier_name: supplierName,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        items: items
      });

      onStockInwarded(res.data.items || []);
      onClose();
    } catch (err: any) {
      console.error('Commit inward stock error:', err);
      setError(err.response?.data?.error || 'Failed to inward stock.');
      setIsSubmitting(false);
    }
  };

  const computedTotal = items.reduce((acc, it) => acc + (it.line_total || (it.quantity * it.purchase_rate)), 0);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden border border-gray-200 dark:border-zinc-800 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                AI Inward Purchase Bill Scanner
                <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 px-2 py-0.5 rounded-full uppercase">
                  Zero Typing
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Upload wholesaler bill to auto-match parts, update stock & print barcodes
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STAGE 1: UPLOAD SCREEN */}
          {step === 'upload' && (
            <div className="space-y-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-8 sm:p-12 text-center hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-all cursor-pointer flex flex-col items-center justify-center space-y-3"
              >
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">
                    Upload Supplier Invoice / Purchase Bill
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                    Take a clear photo from your mobile phone or upload a PDF/Image of the invoice
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      cameraInputRef.current?.click();
                    }}
                    className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm"
                  >
                    <Camera className="w-3.5 h-3.5 mr-1.5" />
                    Take Photo with Camera
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center px-4 py-2 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 rounded-lg text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                    Browse PDF or Image
                  </button>
                </div>
              </div>

              {/* Instant Sample Test Card */}
              <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <h5 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide">
                      Instant Demonstration
                    </h5>
                    <p className="text-xs text-amber-800 dark:text-amber-400">
                      Test with a pre-configured automobile spare parts bill (Bosch, Castrol, Hyundai OEM)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleStartScan(null, true)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm whitespace-nowrap active:scale-95 transition-transform"
                >
                  Test Sample Bill Now &rarr;
                </button>
              </div>

              {/* Gemini API Key Collapsible */}
              <div className="pt-2 border-t border-gray-100 dark:border-zinc-800">
                {!showApiKeyInput ? (
                  <button
                    type="button"
                    onClick={() => setShowApiKeyInput(true)}
                    className="text-xs text-gray-500 hover:text-indigo-600 flex items-center font-medium"
                  >
                    <Key className="w-3.5 h-3.5 mr-1" />
                    {geminiApiKey ? '✓ Gemini Vision API Key Configured (Click to change)' : 'Configure Custom Gemini API Key'}
                  </button>
                ) : (
                  <div className="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-gray-200 dark:border-zinc-700 space-y-2">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300">
                      Google Gemini API Key (Free tier 15 req/min)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="AIzaSy..."
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-zinc-700 rounded-lg text-xs dark:bg-zinc-800 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={handleSaveApiKey}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STAGE 2: SCANNING ANIMATION */}
          {step === 'scanning' && (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-indigo-600 text-white flex items-center justify-center animate-pulse">
                  <Sparkles className="w-10 h-10" />
                </div>
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin absolute -top-2 -right-2" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                  Reading & Matching Inward Bill...
                </h4>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-sm">
                  Extracting OEM part numbers, verifying wholesale rates, and matching existing inventory items.
                </p>
              </div>
            </div>
          )}

          {/* STAGE 3: RECONCILIATION & CONFIRMATION SCREEN */}
          {step === 'verify' && (
            <div className="space-y-5">
              {/* Supplier & Invoice Summary Header */}
              <div className="bg-gray-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-gray-200 dark:border-zinc-700 grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1">
                    Distributor / Supplier
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-zinc-700 rounded-lg text-xs font-bold dark:bg-zinc-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-zinc-700 rounded-lg text-xs font-bold dark:bg-zinc-800 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-zinc-700 rounded-lg text-xs font-semibold dark:bg-zinc-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1">
                    Invoice Total
                  </label>
                  <div className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-gray-900 dark:text-white">
                    ₹ {grandTotal.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Math Checksum Banner */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  isMathVerified
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300'
                }`}
              >
                <div className="flex items-center space-x-2 text-xs font-semibold">
                  {isMathVerified ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  )}
                  <span>
                    {isMathVerified
                      ? `Math Checksum Verified: Extracted items sum (₹${computedTotal.toLocaleString('en-IN')}) matches invoice total!`
                      : `Checksum Note: Extracted sum (₹${computedTotal.toLocaleString('en-IN')}) vs invoice total (₹${grandTotal.toLocaleString('en-IN')}). Please inspect items below.`}
                  </span>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-md shadow-xs">
                  {items.length} Line Items
                </span>
              </div>

              {/* Extracted Line Items List */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
                    Inward Line Items & Stock Update
                  </h4>
                  <span className="text-xs text-gray-500">
                    Review part numbers and selling margins before adding to stock
                  </span>
                </div>

                <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-zinc-800 max-h-80 overflow-y-auto">
                  {items.map((item, idx) => (
                    <div key={item.temp_id || idx} className="p-3.5 bg-white dark:bg-zinc-800/40 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        {/* Part Number & Title */}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            {item.is_new ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 uppercase">
                                ✨ New Part (Will be created)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 uppercase">
                                ✓ Match Found (+Stock)
                              </span>
                            )}
                            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {item.part_number}
                            </span>
                            {item.brand && (
                              <span className="text-[10px] font-medium text-gray-500 bg-gray-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded">
                                {item.brand}
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            className="w-full text-xs font-bold uppercase text-gray-900 dark:text-white px-2 py-1 border border-gray-200 dark:border-zinc-700 rounded bg-gray-50/50 dark:bg-zinc-800"
                          />
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-600 self-end sm:self-center"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Stock, Rate, Margin, and Selling Price Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                            Received Qty
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-zinc-700 rounded font-bold text-center dark:bg-zinc-800 dark:text-white"
                          />
                          <span className="text-[10px] text-gray-400 block mt-0.5 text-center">
                            Stock: {item.current_stock} &rarr;{' '}
                            <strong className="text-emerald-600 font-bold">{item.current_stock + (item.quantity || 0)}</strong>
                          </span>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                            Purchase Rate
                          </label>
                          <input
                            type="number"
                            value={item.purchase_rate}
                            onChange={(e) => handleItemChange(idx, 'purchase_rate', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-zinc-700 rounded font-bold text-center dark:bg-zinc-800 dark:text-white"
                          />
                          <span className="text-[10px] text-gray-400 block mt-0.5 text-center">
                            Total: ₹{((item.quantity || 1) * (item.purchase_rate || 0)).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                            Selling Price (+25%)
                          </label>
                          <input
                            type="number"
                            value={item.selling_price}
                            onChange={(e) => handleItemChange(idx, 'selling_price', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-indigo-300 dark:border-indigo-700 rounded font-bold text-center text-indigo-700 dark:text-indigo-400 dark:bg-zinc-800"
                          />
                          <span className="text-[10px] text-indigo-500 block mt-0.5 text-center">
                            Margin: ₹{Math.max(0, (item.selling_price || 0) - (item.purchase_rate || 0))}
                          </span>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                            HSN Code
                          </label>
                          <input
                            type="text"
                            value={item.hsn_code || '8708'}
                            onChange={(e) => handleItemChange(idx, 'hsn_code', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-zinc-700 rounded font-mono text-center dark:bg-zinc-800 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Barcode Print Option */}
              <div className="bg-indigo-50/60 dark:bg-zinc-800/50 p-3.5 rounded-xl border border-indigo-100 dark:border-zinc-700 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <input
                    type="checkbox"
                    id="autoPrintBarcodes"
                    checked={autoPrintBarcodes}
                    onChange={(e) => setAutoPrintBarcodes(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <label htmlFor="autoPrintBarcodes" className="text-xs font-semibold text-gray-900 dark:text-white cursor-pointer">
                    Automatically open Batch Barcode Printer for newly received items
                  </label>
                </div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {items.reduce((s, it) => s + (it.quantity || 1), 0)} Stickers Ready
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 flex justify-between items-center">
          {step === 'verify' ? (
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="px-4 py-2 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
              &larr; Rescan Bill
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          )}

          {step === 'verify' && (
            <button
              type="button"
              disabled={isSubmitting || items.length === 0}
              onClick={handleCommitStock}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-lg text-sm font-bold shadow-md transition-transform active:scale-95 flex items-center disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Inwarding Stock...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {autoPrintBarcodes ? 'Confirm Stock & Print Barcodes' : 'Confirm Stock Inward'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
