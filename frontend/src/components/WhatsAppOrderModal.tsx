import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Send, Search, Building2, Package, Phone } from 'lucide-react';
import { useDataStore } from '../store/useDataStore';
import api from '../api';

interface OrderItem {
  id: number;
  name: string;
  code?: string;
  currentStock: number;
  orderQty: number;
  unit?: string;
}

interface WhatsAppOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSupplier?: any;
  initialItems?: any[];
}

export default function WhatsAppOrderModal({
  isOpen,
  onClose,
  initialSupplier,
  initialItems = []
}: WhatsAppOrderModalProps) {
  const { products } = useDataStore();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [manualPhone, setManualPhone] = useState<string>('');
  const [manualSupplierName, setManualSupplierName] = useState<string>('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [urgency, setUrgency] = useState('Normal');

  useEffect(() => {
    if (isOpen) {
      // Fetch suppliers
      api.get('/billing/suppliers')
        .then(res => {
          setSuppliers(res.data || []);
          if (initialSupplier) {
            setSelectedSupplierId(initialSupplier.id?.toString() || '');
            if (initialSupplier.mobile) setManualPhone(initialSupplier.mobile);
            if (initialSupplier.name) setManualSupplierName(initialSupplier.name);
          } else if (res.data && res.data.length > 0) {
            setSelectedSupplierId(res.data[0].id.toString());
            if (res.data[0].mobile) setManualPhone(res.data[0].mobile);
            if (res.data[0].name) setManualSupplierName(res.data[0].name);
          }
        })
        .catch(err => {
          console.warn('Could not fetch suppliers online, using manual entry', err);
        });

      // Pre-fill initial items (e.g. from low stock or single item)
      if (initialItems && initialItems.length > 0) {
        const formatted: OrderItem[] = initialItems.map(p => {
          const totalQty = p.inventory?.reduce((sum: number, inv: any) => sum + inv.quantity, 0) || 0;
          const reorderQty = Math.max(p.min_stock ? p.min_stock * 2 : 10, 5);
          return {
            id: p.id,
            name: p.name,
            code: p.code || p.item_code,
            currentStock: totalQty,
            orderQty: reorderQty,
            unit: p.unit || p.measuring_unit || 'pcs'
          };
        });
        setOrderItems(formatted);
      } else {
        setOrderItems([]);
      }
    }
  }, [isOpen, initialSupplier, initialItems]);

  if (!isOpen) return null;

  const currentSupplier = suppliers.find(s => s.id?.toString() === selectedSupplierId) || initialSupplier;
  const effectiveSupplierName = manualSupplierName.trim() || currentSupplier?.name || 'Wholesaler / Distributor';
  const effectivePhone = manualPhone.trim() || currentSupplier?.mobile || '';

  const handleSupplierSelect = (supId: string) => {
    setSelectedSupplierId(supId);
    if (!supId) {
      setManualSupplierName('');
      setManualPhone('');
      return;
    }
    const found = suppliers.find(s => s.id?.toString() === supId);
    if (found) {
      setManualSupplierName(found.name || '');
      setManualPhone(found.mobile || '');
    }
  };

  const handleAddItem = (prod: any) => {
    if (orderItems.some(i => i.id === prod.id)) return;
    const totalQty = prod.inventory?.reduce((sum: number, inv: any) => sum + inv.quantity, 0) || 0;
    setOrderItems(prev => [
      ...prev,
      {
        id: prod.id,
        name: prod.name,
        code: prod.code || prod.item_code,
        currentStock: totalQty,
        orderQty: Math.max(prod.min_stock ? prod.min_stock * 2 : 10, 5),
        unit: prod.unit || prod.measuring_unit || 'pcs'
      }
    ]);
    setItemSearch('');
  };

  const handleUpdateQty = (id: number, qty: number) => {
    setOrderItems(prev => prev.map(item => item.id === id ? { ...item, orderQty: Math.max(1, qty) } : item));
  };

  const handleRemoveItem = (id: number) => {
    setOrderItems(prev => prev.filter(item => item.id !== id));
  };

  const generateWhatsAppMessage = () => {
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    let msg = `*PURCHASE ORDER - PANCHAWATI AUTOMOBILES*\n`;
    msg += `📅 Date: ${today}\n`;
    if (effectiveSupplierName) {
      msg += `🏢 To: ${effectiveSupplierName}\n`;
    }
    if (urgency === 'Urgent') {
      msg += `⚡ Priority: *URGENT REQUIREMENT*\n`;
    }
    msg += `----------------------------------------\n`;
    msg += `*ITEMS TO DISPATCH:*\n\n`;

    orderItems.forEach((item, idx) => {
      msg += `${idx + 1}. *${item.name}*`;
      if (item.code) msg += ` (Code: ${item.code})`;
      msg += `\n   ➡️ *Qty: ${item.orderQty} ${item.unit || 'pcs'}*\n\n`;
    });

    if (customNote.trim()) {
      msg += `📝 *Note:* ${customNote.trim()}\n\n`;
    }

    msg += `----------------------------------------\n`;
    msg += `📍 Delivery: Panchawati Automobiles, Main Shop\n`;
    msg += `Please confirm order receipt & dispatch ETA. Thank you!`;
    return msg;
  };

  const handleSendWhatsApp = () => {
    if (!effectivePhone.trim()) {
      alert('Please enter or select a wholesaler WhatsApp phone number.');
      return;
    }
    if (orderItems.length === 0) {
      alert('Please add at least one item to order.');
      return;
    }

    let phone = effectivePhone.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    const message = generateWhatsAppMessage();
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    onClose();
  };

  const searchResults = itemSearch.trim() === '' 
    ? [] 
    : products.filter(p => 
        (p.name && p.name.toLowerCase().includes(itemSearch.toLowerCase())) ||
        (p.code && p.code.toLowerCase().includes(itemSearch.toLowerCase()))
      ).slice(0, 6);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-zinc-800 flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-full bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366] flex items-center justify-center font-bold">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Order to Wholesaler on WhatsApp</h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Send purchase requirements directly via WhatsApp</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
          
          {/* Supplier Selector & Phone */}
          <div className="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-gray-200 dark:border-zinc-700/60 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1 uppercase tracking-wider">
                  Select Saved Wholesaler / Supplier
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={e => handleSupplierSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">-- Choose or enter manually below --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.mobile ? `(${s.mobile})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1 uppercase tracking-wider">
                  Priority
                </label>
                <select
                  value={urgency}
                  onChange={e => setUrgency(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="Normal">Normal Order</option>
                  <option value="Urgent">⚡ Urgent Dispatch</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1 uppercase tracking-wider">
                  Wholesaler / Supplier Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. M.K. Spares / National Auto"
                  value={manualSupplierName}
                  onChange={e => setManualSupplierName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1 uppercase tracking-wider flex items-center">
                  <Phone className="w-3.5 h-3.5 mr-1 text-green-600" />
                  WhatsApp Mobile Number *
                </label>
                <input
                  type="tel"
                  placeholder="10-digit number (e.g. 9822012345)"
                  value={manualPhone}
                  onChange={e => setManualPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Add Item Search */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
              Search & Add Items from Inventory
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search item by name or code to add..."
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Dropdown search results */}
            {searchResults.length > 0 && (
              <div className="mt-1 border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 shadow-lg overflow-hidden divide-y divide-gray-100 dark:divide-zinc-700/50">
                {searchResults.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleAddItem(p)}
                    className="p-2.5 px-3 hover:bg-indigo-50 dark:hover:bg-zinc-700/60 cursor-pointer flex justify-between items-center text-sm"
                  >
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                      <span className="text-xs text-gray-500 dark:text-zinc-400 ml-2">Code: {p.code || 'N/A'}</span>
                    </div>
                    <span className="text-xs bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 px-2 py-0.5 rounded">
                      In Stock: {p.inventory?.[0]?.quantity || 0}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order Items Table */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
                Items to Order ({orderItems.length})
              </h4>
              {orderItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOrderItems([])}
                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                >
                  Clear All
                </button>
              )}
            </div>

            {orderItems.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-xl text-gray-400 text-sm">
                No items added yet. Search above to add items.
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-zinc-800 max-h-52 overflow-y-auto">
                {orderItems.map((item, idx) => (
                  <div key={item.id} className="p-3 bg-white dark:bg-zinc-800/40 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {idx + 1}. {item.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400">
                        {item.code ? `Code: ${item.code} • ` : ''}Current Stock: {item.currentStock} {item.unit}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500 dark:text-zinc-400 font-medium">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={item.orderQty}
                        onChange={e => handleUpdateQty(item.id, parseInt(e.target.value) || 1)}
                        className="w-20 px-2 py-1 text-center font-bold text-sm border border-gray-300 dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Optional Note */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">
              Additional Note for Wholesaler (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Please send via evening transport, or dispatch before 11 AM"
              value={customNote}
              onChange={e => setCustomNote(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg dark:bg-zinc-800 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Live Message Preview */}
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block mb-1">
              WhatsApp Message Preview:
            </span>
            <pre className="text-xs text-emerald-900 dark:text-emerald-300 font-mono whitespace-pre-wrap max-h-28 overflow-y-auto">
              {generateWhatsAppMessage()}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSendWhatsApp}
            disabled={orderItems.length === 0 || !effectivePhone.trim()}
            className="px-5 py-2 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-lg text-sm font-bold shadow-md transition-colors flex items-center disabled:opacity-50"
          >
            <Send className="w-4 h-4 mr-2" />
            Send Order via WhatsApp
          </button>
        </div>

      </div>
    </div>
  );
}
