import React, { useState, useEffect } from 'react';
import { Search, Plus, MoreVertical, Settings, FileText, ChevronDown, HelpCircle, Tag, AlertCircle, ArrowUpDown, TrendingUp, ArrowLeft, Edit, Trash2, Printer, Activity, X, FolderTree, Send, Eye } from 'lucide-react';
import WhatsAppOrderModal from '../components/WhatsAppOrderModal';
import { useAuthStore } from '../store/useAuthStore';
import { useDataStore } from '../store/useDataStore';
import CreateItemModal from '../components/CreateItemModal';
import AdjustStockModal from '../components/AdjustStockModal';
import EditItemModal from '../components/EditItemModal';
import CategoryManagerModal from '../components/CategoryManagerModal';
import QRCode from 'qrcode';
import { useScanner } from '../hooks/useScanner';
import { socket } from '../socket';
import api from '../api';

export default function Inventory() {
  const { products, setProducts, categories, setCategories, loadOfflineData } = useDataStore();
  const [loading, setLoading] = useState(products.length === 0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [catInput, setCatInput] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppOrderItems, setWhatsAppOrderItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  
  // Split view state
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Item Details');
  const [stockHistory, setStockHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const token = useAuthStore(state => state.token);

  useEffect(() => {
    socket.connect();

    socket.on('stock_updated', () => {
      fetchData();
    });

    return () => {
      socket.off('stock_updated');
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (activeTab === 'Stock Details' && selectedProduct) {
      const fetchHistory = async () => {
        setIsHistoryLoading(true);
        try {
          const res = await api.get(`/inventory/products/${selectedProduct.id}/history`);
          setStockHistory(res.data);
        } catch (err) {
          console.error("Failed to fetch history", err);
        } finally {
          setIsHistoryLoading(false);
        }
      };
      fetchHistory();
    }
  }, [activeTab, selectedProduct, token]);

  useEffect(() => {
    if (selectedProduct) {
      const value = selectedProduct.code || selectedProduct.item_code || selectedProduct.id.toString();
      QRCode.toDataURL(value, { width: 160, margin: 1 })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error(err));
    }
  }, [selectedProduct]);

  const fetchData = async () => {
    try {
      const [res, catRes] = await Promise.all([
        api.get(`/inventory/products`),
        api.get(`/inventory/categories`)
      ]);
      setProducts(res.data);
      setCategories(catRes.data);
      // Update selected product if it exists using functional state update
      setSelectedProduct((prevSelected: any) => {
        if (prevSelected) {
          const updated = res.data.find((p: any) => p.id === prevSelected.id);
          return updated ? updated : null;
        }
        return prevSelected;
      });
    } catch (error) {
      console.warn('Failed to fetch data from server, loading from offline cache...', error);
      await loadOfflineData();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  useScanner((scannedCode) => {
    const cleanScan = scannedCode.trim().toLowerCase();
    const product = products.find(p => 
      p.code?.trim().toLowerCase() === cleanScan || 
      p.item_code?.trim().toLowerCase() === cleanScan ||
      p.id.toString() === cleanScan
    );
    
    if (product) {
       setSelectedProduct(product);
       setActiveTab('Item Details');
    } else {
       alert(`Scanned item '${scannedCode}' not found in inventory!`);
    }
  });

  const handleOpenLowStockWhatsAppOrder = () => {
    const lowStockItems = products.filter(p => {
      const totalQty = p.inventory?.reduce((sum: number, inv: any) => sum + inv.quantity, 0) || 0;
      return totalQty <= p.min_stock;
    });

    if (lowStockItems.length === 0) {
      alert('All items currently have sufficient stock! You can search and add any items inside the WhatsApp order window.');
      setWhatsAppOrderItems([]);
    } else {
      setWhatsAppOrderItems(lowStockItems);
    }
    setIsWhatsAppModalOpen(true);
  };

  const handleOpenSingleProductWhatsAppOrder = (product: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setWhatsAppOrderItems([product]);
    setIsWhatsAppModalOpen(true);
  };

  const handleQuickAdjust = (product: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedProduct(product);
    setIsAdjustStockOpen(true);
  };

  const filteredProducts = products.filter(p => {
    const sTerm = searchTerm.toLowerCase();
    const matchesSearch = !sTerm || 
      (p.name && p.name.toLowerCase().includes(sTerm)) || 
      (p.code && p.code.toLowerCase().includes(sTerm)) ||
      (p.item_code && p.item_code.toLowerCase().includes(sTerm));
    const matchesCat = selectedCategoryFilter ? p.category_id?.toString() === selectedCategoryFilter : true;
    
    let matchesLowStock = true;
    if (showLowStockOnly) {
      const totalQty = p.inventory?.reduce((sum: number, inv: any) => sum + inv.quantity, 0) || 0;
      matchesLowStock = totalQty <= p.min_stock;
    }

    return matchesSearch && matchesCat && matchesLowStock;
  });

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategoryFilter, showLowStockOnly]);

  const paginatedProducts = filteredProducts;

  const handleDeleteProduct = async (product: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this product? All related stock history and inventory records will also be deleted.')) {
      try {
        await api.delete(`/inventory/products/${product.id}`);
        fetchData();
        setSelectedProduct(null);
      } catch (error) {
        console.error("Failed to delete product", error);
        alert("Failed to delete product. Please check your connection.");
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItemIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedItemIds.size} selected item(s)?`)) return;
    
    try {
      await Promise.all(Array.from(selectedItemIds).map(id => 
        api.delete(`/inventory/products/${id}`)
      ));
      
      setSelectedItemIds(new Set());
      if (selectedProduct && selectedItemIds.has(selectedProduct.id)) {
        setSelectedProduct(null);
      }
      fetchData();
    } catch (err) {
      alert("Failed to delete some products. Please try again.");
      fetchData(); 
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedItemIds(new Set(filteredProducts.map(p => p.id)));
    } else {
      setSelectedItemIds(new Set());
    }
  };

  const handleSelectRow = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newSet = new Set(selectedItemIds);
    if (e.target.checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedItemIds(newSet);
  };

  const handlePrintBarcode = () => {
    window.print();
  };

  const totalStockValue = products.reduce((acc, product) => {
    const totalQty = product.inventory?.reduce((sum: number, inv: any) => sum + inv.quantity, 0) || 0;
    const price = product.purchase_price > 0 ? product.purchase_price : product.selling_price;
    return acc + (totalQty * price);
  }, 0);

  const lowStockCount = products.filter(product => {
    const totalQty = product.inventory?.reduce((sum: number, inv: any) => sum + inv.quantity, 0) || 0;
    return totalQty <= product.min_stock;
  }).length;

  // If a product is selected, render the Detail / Split View
  if (selectedProduct) {
    const totalQty = selectedProduct.inventory?.reduce((sum: number, inv: any) => sum + inv.quantity, 0) || 0;
    const stockValue = totalQty * (selectedProduct.purchase_price || selectedProduct.selling_price || 0);

    return (
      <div className="flex flex-col md:flex-row h-full bg-[#f8f9fa] dark:bg-zinc-950 font-sans overflow-hidden print:bg-white print:overflow-visible">
        
        {/* PRINT ONLY THERMAL / BARCODE LABEL (Formatted for 48mm / 58mm label printers) */}
        <div className="hidden print:flex flex-col items-center justify-start w-full max-w-[48mm] mx-auto pt-2 text-black">
          <div className="font-bold text-[13px] mb-1 text-center w-full truncate border-b border-black pb-1 uppercase">PANCHAWATI AUTOMOBILES</div>
          {qrDataUrl && <img src={qrDataUrl} alt="QR Code" style={{ width: '110px', height: '110px' }} />}
          <div className="text-[11px] font-mono text-center mt-0.5 font-semibold text-gray-800">
            {selectedProduct.code || selectedProduct.item_code || `ID: ${selectedProduct.id}`}
          </div>
          <div className="text-[12px] text-center mt-1 font-bold leading-tight w-full break-words uppercase">{selectedProduct.name}</div>
          <div className="text-[15px] font-bold mt-1 border-t border-black pt-1 w-full text-center">Rs. {selectedProduct.selling_price}</div>
        </div>

        {/* Left Pane: Master List (Hidden on Mobile to provide full screen focus) */}
        <div className="hidden md:flex md:w-80 md:h-full flex-shrink-0 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-col print:hidden overflow-y-auto">
          <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0">
            <div className="relative mb-3">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="w-full flex items-center justify-center py-2 px-4 border border-dashed border-indigo-300 text-indigo-600 rounded-md text-sm font-medium hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/30 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" /> Create Item
            </button>
          </div>
          <div className="flex-col">
            {paginatedProducts.map(product => {
              const qty = product.inventory?.reduce((sum: number, inv: any) => sum + inv.quantity, 0) || 0;
              const isSelected = product.id === selectedProduct.id;
              return (
                <div 
                  key={product.id} 
                  onClick={() => setSelectedProduct(product)}
                  className={`p-4 border-b border-gray-100 dark:border-zinc-800/50 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50 border-l-4 border-l-indigo-600 dark:bg-indigo-900/10 dark:border-l-indigo-500' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50 border-l-4 border-l-transparent'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate pr-2 uppercase">{product.name}</h4>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                      qty <= 0 
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' 
                        : qty <= product.min_stock 
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' 
                          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {qty <= 0 ? 'Out of Stock' : qty <= product.min_stock ? 'Low Stock' : 'In Stock'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{qty} {product.unit || 'PCS'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Full Detail View on Mobile & Desktop */}
        <div className="flex-1 flex flex-col bg-[#f8f9fa] dark:bg-zinc-950 overflow-auto print:hidden">
          
          {/* Header */}
          <div className="bg-white dark:bg-zinc-900 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-10 shadow-sm">
            
            {/* Mobile Top Return Bar */}
            <div className="flex md:hidden items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-zinc-800">
              <button 
                onClick={() => setSelectedProduct(null)} 
                className="flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 py-1.5 px-3 bg-indigo-50 dark:bg-zinc-800 rounded-lg active:scale-95 transition-transform"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Stock
              </button>
              <span className="text-xs font-mono font-medium text-gray-500">
                {selectedProduct.code || selectedProduct.item_code || `ID: ${selectedProduct.id}`}
              </span>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
              <div className="flex items-center flex-wrap gap-2">
                <button 
                  onClick={() => setSelectedProduct(null)} 
                  className="hidden md:inline-flex mr-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                  title="Back to list"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white uppercase truncate mr-2">{selectedProduct.name}</h2>
                {totalQty <= 0 ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    Out of Stock
                  </span>
                ) : totalQty <= selectedProduct.min_stock ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                    Low Stock
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    In Stock
                  </span>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2 mt-3 md:mt-0 w-full sm:w-auto">
                <button 
                  onClick={handlePrintBarcode} 
                  className="flex-1 sm:flex-none flex items-center justify-center px-3 py-1.5 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs sm:text-sm font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 transition-colors shadow-sm active:scale-95"
                >
                  <Printer className="w-4 h-4 mr-1.5" /> Print Barcode
                </button>

                <button 
                  onClick={() => handleOpenSingleProductWhatsAppOrder(selectedProduct)} 
                  className="flex-1 sm:flex-none flex items-center justify-center px-3 py-1.5 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-lg text-xs sm:text-sm font-bold transition-colors shadow-sm active:scale-95"
                >
                  <Send className="w-4 h-4 mr-1.5" /> Order WhatsApp
                </button>

                <button 
                  onClick={() => setIsAdjustStockOpen(true)} 
                  className="flex-1 sm:flex-none flex items-center justify-center px-3 py-1.5 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-700"
                >
                  <Activity className="w-4 h-4 mr-1.5" /> Adjust Stock
                </button>

                <button 
                  onClick={() => setIsEditModalOpen(true)} 
                  className="flex items-center justify-center px-3 py-1.5 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-700"
                >
                  <Edit className="w-4 h-4 mr-1.5" /> Edit
                </button>

                <button 
                  onClick={() => handleDeleteProduct(selectedProduct)} 
                  className="p-1.5 border border-red-200 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400"
                  title="Delete item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-6 border-b border-gray-200 dark:border-zinc-800">
              {['Item Details', 'Stock Details', 'Party Wise Report'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <span className="flex items-center">
                    {tab === 'Item Details' && <FileText className="w-4 h-4 mr-2" />}
                    {tab === 'Stock Details' && <Tag className="w-4 h-4 mr-2" />}
                    {tab}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-4 md:p-6 flex-1 overflow-auto pb-24 md:pb-8">
            {activeTab === 'Item Details' && (
              <div className="space-y-5">
                
                {/* Live Shelf Barcode & QR Label Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col sm:flex-row items-center gap-4">
                  <div className="p-2.5 bg-white border border-gray-200 dark:border-zinc-700 rounded-xl shadow-inner flex flex-col items-center">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="Product QR Code" className="w-28 h-28 object-contain" />
                    ) : (
                      <div className="w-28 h-28 flex items-center justify-center text-xs text-gray-400">Loading QR...</div>
                    )}
                    <span className="text-[11px] font-mono font-bold text-gray-600 dark:text-gray-400 mt-1">
                      {selectedProduct.code || selectedProduct.item_code || `ID: ${selectedProduct.id}`}
                    </span>
                  </div>

                  <div className="flex-1 text-center sm:text-left space-y-1.5 w-full">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                        Shelf Barcode & QR
                      </span>
                      <span className="text-[11px] text-gray-500 font-mono">
                        {selectedProduct.code || selectedProduct.item_code || 'AUTOGEN'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white uppercase leading-tight">{selectedProduct.name}</h3>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Selling Price: <span className="text-indigo-600 dark:text-indigo-400 font-bold">₹{selectedProduct.selling_price?.toLocaleString('en-IN') || 0}</span>
                      {selectedProduct.purchase_price ? ` • Cost: ₹${selectedProduct.purchase_price}` : ''}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Current Stock: <strong className="text-gray-900 dark:text-white">{totalQty} {selectedProduct.unit || 'PCS'}</strong>
                      {selectedProduct.brand ? ` • Brand: ${selectedProduct.brand}` : ''}
                    </p>

                    <div className="flex flex-wrap gap-2 pt-2 justify-center sm:justify-start">
                      <button 
                        onClick={handlePrintBarcode}
                        className="flex items-center px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-transform active:scale-95"
                      >
                        <Printer className="w-3.5 h-3.5 mr-1.5" />
                        Print Barcode Label
                      </button>
                      <button 
                        onClick={() => handleOpenSingleProductWhatsAppOrder(selectedProduct)}
                        className="flex items-center px-3.5 py-1.5 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-lg text-xs font-bold shadow-sm transition-transform active:scale-95"
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        WhatsApp Wholesaler
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* General Details */}
                  <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                        <FileText className="w-4 h-4 mr-2 text-gray-400" /> General Details
                      </h3>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-y-5 gap-x-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Item Name</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white uppercase">{selectedProduct.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Item Code / Barcode</p>
                        <p className="text-sm font-mono font-medium text-gray-900 dark:text-white">{selectedProduct.code || selectedProduct.item_code || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Category / Brand</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white uppercase">
                          {selectedProduct.category?.name || 'UNCATEGORIZED'} {selectedProduct.brand ? `• ${selectedProduct.brand}` : ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">OEM Number</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedProduct.oem_number || '-'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Vehicle Compatibility</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedProduct.vehicle_compatibility || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Stock</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{totalQty} {selectedProduct.unit || 'PCS'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center">Stock Value</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">₹ {stockValue.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Low Stock Warning Limit</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedProduct.min_stock || 10} {selectedProduct.unit || 'PCS'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Stock Status</p>
                        <p className={`text-sm font-bold ${totalQty <= selectedProduct.min_stock ? 'text-orange-500' : 'text-green-600'}`}>
                          {totalQty <= 0 ? 'Out of Stock' : totalQty <= selectedProduct.min_stock ? 'Low Stock Warning' : 'Healthy Stock'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Details */}
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                          <Tag className="w-4 h-4 mr-2 text-gray-400" /> Pricing & Tax Details
                        </h3>
                      </div>
                      <div className="p-4 grid grid-cols-2 gap-y-5 gap-x-4">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Sales Price</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            ₹ {selectedProduct.selling_price?.toLocaleString('en-IN')} <span className="text-xs font-normal text-gray-400">With Tax</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Purchase Price</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            ₹ {selectedProduct.purchase_price?.toLocaleString('en-IN')} <span className="text-xs font-normal text-gray-400">With Tax</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">GST Tax Rate</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedProduct.gst_rate ? `${selectedProduct.gst_rate}%` : '0%'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">HSN Code</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedProduct.hsn_code || '-'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Quick Stock Adjust Button in Detail Tab */}
                    <div className="bg-indigo-50/50 dark:bg-zinc-900 rounded-lg border border-indigo-100 dark:border-zinc-800 p-4 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-indigo-950 dark:text-white">Instant Stock Update</h4>
                        <p className="text-xs text-gray-500 dark:text-zinc-400">Add purchases, record sales or damages</p>
                      </div>
                      <button
                        onClick={() => setIsAdjustStockOpen(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
                      >
                        Adjust Stock
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'Stock Details' && (
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                {isHistoryLoading ? (
                  <div className="p-6 text-center text-gray-500">Loading stock history...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                      <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-400 font-medium">
                        <tr>
                          <th className="px-4 py-3 border-b border-gray-200 dark:border-zinc-700">Date</th>
                          <th className="px-4 py-3 border-b border-gray-200 dark:border-zinc-700">Transaction Type</th>
                          <th className="px-4 py-3 border-b border-gray-200 dark:border-zinc-700">Quantity</th>
                          <th className="px-4 py-3 border-b border-gray-200 dark:border-zinc-700">Reference / Invoice</th>
                          <th className="px-4 py-3 border-b border-gray-200 dark:border-zinc-700">Closing Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockHistory.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No stock history found for this item.</td></tr>
                        ) : stockHistory.map((history) => (
                          <tr key={history.id} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                            <td className="px-4 py-3">{new Date(history.date).toLocaleDateString('en-GB').replace(/\//g, '-')}</td>
                            <td className="px-4 py-3 font-medium">{history.action}</td>
                            <td className="px-4 py-3">
                              {history.action === 'Decrease' || history.action === 'Damaged' || history.action === 'Missing' 
                                ? `- ${history.quantity}` 
                                : `+ ${history.quantity}`} {selectedProduct.unit || 'PCS'}
                            </td>
                            <td className="px-4 py-3">{history.reference_id || '-'}</td>
                            <td className="px-4 py-3 font-semibold">{history.new_qty} {selectedProduct.unit || 'PCS'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Party Wise Report' && (
               <div className="bg-white dark:bg-zinc-900 p-8 rounded-lg border border-gray-200 dark:border-zinc-800 shadow-sm text-center text-gray-500">
                  Party Wise Purchase / Sale Report for {selectedProduct.name}
               </div>
            )}
          </div>
        </div>

        <AdjustStockModal isOpen={isAdjustStockOpen} onClose={() => setIsAdjustStockOpen(false)} onStockAdjusted={fetchData} product={selectedProduct} />
        <WhatsAppOrderModal isOpen={isWhatsAppModalOpen} onClose={() => setIsWhatsAppModalOpen(false)} initialItems={whatsAppOrderItems} />
        <EditItemModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onItemEdited={fetchData} product={selectedProduct} />
      </div>
    );
  }

  // If no product is selected, render the Full View
  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-zinc-950 font-sans relative md:overflow-hidden overflow-y-auto">
      {/* Desktop Header */}
      <div className="hidden md:flex flex-none justify-between items-center px-6 py-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-20 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Stock Management</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Manage spare parts, barcode labels & purchase orders</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            className="flex items-center px-4 py-2 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
            onClick={handleOpenLowStockWhatsAppOrder}
            title="Create WhatsApp Purchase Order for Low Stock"
          >
            <Send className="w-4 h-4 mr-2" />
            WhatsApp Reorder
          </button>
          
          <button 
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Item
          </button>
          
          <button 
            className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 shadow-sm"
            onClick={() => setIsCategoryModalOpen(true)}
          >
            <FolderTree className="w-4 h-4 mr-2" />
            Categories
          </button>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden flex flex-col px-4 py-3 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Stock & Items</h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{products.length} products in stock</p>
          </div>
          <div className="flex items-center space-x-1.5">
            <button 
              onClick={handleOpenLowStockWhatsAppOrder}
              className="flex items-center px-2.5 py-1.5 bg-[#25D366] active:bg-[#128C7E] text-white rounded-lg text-xs font-bold shadow-sm"
            >
              <Send className="w-3.5 h-3.5 mr-1" /> Reorder
            </button>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center px-2.5 py-1.5 bg-indigo-600 active:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
            </button>
            <button 
              onClick={() => setIsCategoryModalOpen(true)}
              className="p-1.5 border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs hover:bg-gray-50 dark:hover:bg-zinc-800"
              title="Categories"
            >
              <FolderTree className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-3 sm:p-4 md:p-6 md:flex-1 md:min-h-0 flex flex-col pb-32">
        {/* KPI Cards */}
        {/* Desktop KPI Cards */}
        <div className="hidden md:grid grid-cols-3 gap-6 mb-6 flex-shrink-0">
          <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/30 dark:border-indigo-900/30 dark:bg-indigo-900/10">
            <p className="text-xs text-gray-500 font-medium mb-1">Total Stock Value</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">₹ {totalStockValue.toLocaleString('en-IN')}</p>
          </div>
          <div 
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={`border rounded-xl p-4 cursor-pointer transition-colors ${showLowStockOnly ? 'border-orange-300 bg-orange-100 dark:bg-orange-900/40 dark:border-orange-700' : 'border-orange-100 bg-orange-50/30 dark:border-orange-900/30 dark:bg-orange-900/10 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}
          >
            <p className="text-xs text-gray-500 font-medium mb-1">Low Stock Items {showLowStockOnly && '(Filtered)'}</p>
            <p className="text-xl font-bold text-orange-600">{lowStockCount}</p>
          </div>
          <div 
            onClick={() => {
              setShowLowStockOnly(false);
              setSearchTerm('');
              setCatInput('');
              setSelectedCategoryFilter('');
            }}
            className={`border rounded-xl p-4 cursor-pointer transition-colors ${!showLowStockOnly && !searchTerm && !selectedCategoryFilter ? 'border-green-300 bg-green-100 dark:bg-green-900/40 dark:border-green-700' : 'border-green-100 bg-green-50/30 dark:border-green-900/30 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
          >
            <p className="text-xs text-gray-500 font-medium mb-1">Total Items {!showLowStockOnly && !searchTerm && !selectedCategoryFilter && '(Active)'}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{products.length}</p>
          </div>
        </div>

        {/* Mobile KPI Cards */}
        <div className="md:hidden grid grid-cols-2 gap-2.5 mb-4">
          <div className="p-3 bg-white border border-gray-200 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 rounded-xl">
            <span className="text-[11px] text-gray-500 dark:text-gray-400 block mb-0.5">Stock Value</span>
            <div className="text-base font-bold text-gray-900 dark:text-white">₹ {totalStockValue.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div>
          </div>
          
          <div 
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={`p-3 border rounded-xl shadow-sm transition-colors ${showLowStockOnly ? 'bg-orange-50 border-orange-300 dark:bg-orange-900/30' : 'bg-white border-gray-200 dark:border-zinc-800 dark:bg-zinc-900'}`}
          >
            <span className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold block mb-0.5">
              ⚠️ Low Stock {showLowStockOnly && '✓'}
            </span>
            <div className="text-base font-bold text-orange-600 dark:text-orange-400">{lowStockCount} Items</div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:bg-white md:dark:bg-zinc-900 md:p-3 md:rounded-xl md:border md:border-gray-200 md:dark:border-zinc-800 flex-shrink-0 mb-4">
          <div className="flex flex-1 items-center space-x-2 w-full">
            <div className="relative flex-1 md:max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
                placeholder="Search by item name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {/* Mobile Low Stock Filter Toggle */}
            <button 
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className={`md:hidden flex items-center px-3 py-2 border rounded-lg text-xs font-semibold transition-colors ${showLowStockOnly ? 'bg-orange-50 border-orange-500 text-orange-600' : 'bg-white border-gray-300 text-gray-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-gray-300'}`}
            >
               Low Stock
            </button>

            {/* Desktop Clear Filters */}
            <div className="hidden md:flex">
              {(showLowStockOnly || selectedCategoryFilter || searchTerm) && (
                <button 
                  onClick={() => {
                    setShowLowStockOnly(false);
                    setSelectedCategoryFilter('');
                    setSearchTerm('');
                  }}
                  className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {selectedItemIds.size > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{selectedItemIds.size} selected</span>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                Delete Selected
              </button>
            </div>
          )}
        </div>

        {/* Master Products Table / Card List */}
        <div className="flex-1 md:min-h-0 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
          {/* Desktop Table View */}
          <div className="hidden md:block flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
              <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0 z-10">
                <tr>
                  <th scope="col" className="px-4 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8">
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll}
                      checked={filteredProducts.length > 0 && selectedItemIds.size === filteredProducts.length}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                    />
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Item Name
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Item Code
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Stock Qty
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Selling Price
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Purchase Price
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">Loading products...</td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">No items found. Click 'Create Item' to add one.</td>
                  </tr>
                ) : (
                  <>
                  {paginatedProducts.map((product) => {
                    const totalQty = product.inventory?.reduce((sum: number, inv: any) => sum + inv.quantity, 0) || 0;
                    return (
                      <tr 
                        key={product.id} 
                        onClick={() => setSelectedProduct(product)}
                        className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={selectedItemIds.has(product.id)}
                            onChange={(e) => handleSelectRow(product.id, e)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white uppercase">
                            {product.name}
                          </div>
                          <div className="text-xs flex items-center mt-1">
                            <span className="bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider">
                              {product.category?.name || product.brand || 'Uncategorized'}
                            </span>
                            {product.brand && (
                               <span className="bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ml-2">
                                 {product.brand}
                               </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400">
                          {product.code || product.item_code || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            totalQty <= 0 
                              ? 'bg-red-100 text-red-800' 
                              : totalQty <= product.min_stock 
                                ? 'bg-orange-100 text-orange-800' 
                                : 'text-gray-900 dark:text-white'
                          }`}>
                            {totalQty} {product.unit || 'PCS'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-semibold">
                          ₹ {product.selling_price?.toLocaleString('en-IN') || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {product.purchase_price ? `₹ ${product.purchase_price.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-1.5">
                            <button 
                              onClick={() => handleOpenSingleProductWhatsAppOrder(product)}
                              className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 dark:hover:bg-zinc-800"
                              title="Order on WhatsApp"
                            >
                              <Send className="w-4 h-4 text-[#25D366]" />
                            </button>
                            <button 
                              onClick={() => handleQuickAdjust(product)}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-zinc-800"
                              title="Adjust Stock"
                            >
                              <Activity className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setSelectedProduct(product)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
                              title="View & Barcode"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View with Touch-Friendly Actions */}
          <div className="md:hidden flex flex-col divide-y divide-gray-200 dark:divide-zinc-800">
            {loading ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading products...</div>
            ) : paginatedProducts.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">No items found. Click '+ Add Item' above.</div>
            ) : (
              paginatedProducts.map(product => {
                const qty = product.inventory?.reduce((sum: number, inv: any) => sum + inv.quantity, 0) || 0;
                return (
                  <div 
                    key={product.id} 
                    className="p-3.5 flex flex-col gap-2.5 active:bg-gray-50 dark:active:bg-zinc-800 cursor-pointer transition-colors" 
                    onClick={() => setSelectedProduct(product)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-3">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase leading-snug">{product.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-[11px] text-gray-500 dark:text-zinc-400">
                            {product.code || product.item_code || 'ID:' + product.id}
                          </span>
                          <span className="bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase">
                            {product.category?.name || product.brand || 'General'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-base text-gray-900 dark:text-white">₹{product.selling_price?.toFixed(2) || '0.00'}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          qty === 0 
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' 
                            : qty <= (product.min_stock || 10)
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {qty} {product.unit || 'PCS'}
                        </span>
                      </div>
                    </div>

                    {/* Touch-Friendly Action Buttons on Each Mobile Card */}
                    <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-zinc-800/60" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => setSelectedProduct(product)}
                        className="flex-1 py-1.5 px-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-semibold flex items-center justify-center active:scale-95 transition-transform"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> View & Barcode
                      </button>
                      <button 
                        onClick={(e) => handleQuickAdjust(product, e)}
                        className="flex-1 py-1.5 px-2 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium flex items-center justify-center active:scale-95 transition-transform"
                      >
                        <Activity className="w-3.5 h-3.5 mr-1" /> Stock +/-
                      </button>
                      <button 
                        onClick={(e) => handleOpenSingleProductWhatsAppOrder(product, e)}
                        className="py-1.5 px-2.5 bg-[#25D366] text-white rounded-lg text-xs font-bold flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                        title="Reorder via WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Floating Action Button */}
      <button
        onClick={() => setIsCreateModalOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-30 flex items-center justify-center w-13 h-13 p-3.5 bg-indigo-600 text-white rounded-full shadow-xl hover:bg-indigo-700 active:scale-95 transition-transform"
        aria-label="Create Item"
      >
        <Plus className="w-6 h-6" />
      </button>

      {isCreateModalOpen && (
        <CreateItemModal 
          isOpen={isCreateModalOpen} 
          onClose={() => setIsCreateModalOpen(false)} 
          onItemCreated={fetchData}
          existingProducts={products}
        />
      )}

      {isCategoryModalOpen && (
        <CategoryManagerModal 
          isOpen={isCategoryModalOpen} 
          onClose={() => setIsCategoryModalOpen(false)} 
          onCategoriesChanged={fetchData}
        />
      )}

      <WhatsAppOrderModal 
        isOpen={isWhatsAppModalOpen} 
        onClose={() => setIsWhatsAppModalOpen(false)} 
        initialItems={whatsAppOrderItems} 
      />
    </div>
  );
}
