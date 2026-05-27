import React, { useState, useEffect } from 'react';
import { Camera, Plus, AlertCircle, Trash2, Scan, Loader2, X } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

export default function PantryManager({ fridge, onAddManual, manualItem, setManualItem, onUpdateItem, onRemoveItem, receiptLoading, onFileUpload, barcodeInput, setBarcodeInput, onBarcodeLookup, barcodeLoading, barcodeResult, isScanningBarcode, setIsScanningBarcode }) {
  const isExpiringSoon = (date) => {
    if (!date) return false;
    const today = new Date();
    const expiry = new Date(date);
    const diff = (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7 && diff > 0; // Expiring within 7 days
  };

  useEffect(() => {
    let html5QrCode;
    if (isScanningBarcode) {
      html5QrCode = new Html5Qrcode("barcode-scanner-region");
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      
      html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        (decodedText) => {
          onBarcodeLookup(decodedText);
        },
        () => {} // Ignore parse errors
      ).catch((err) => {
        console.error("Scanner error:", err);
        setIsScanningBarcode(false);
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Error stopping scanner", err));
      }
    };
  }, [isScanningBarcode, handleBarcodeLookup, setIsScanningBarcode]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Manual Entry Section */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="space-y-4">
          <div>
            <h2 className="text-[14px] font-bold text-slate-400 mb-2 px-2">Pantry Input</h2>
            <p className="text-[12px] text-slate-500">Scan receipts, lookup barcodes, or add pantry items manually.</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); onAddManual(manualItem); setManualItem(''); }} className="flex gap-2">
            <input type="text" value={manualItem} onChange={(e) => setManualItem(e.target.value)} placeholder="Add manually..." className="flex-1 bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none transition-all shadow-sm" />
            <button type="submit" className="bg-[#6BAEE0] text-white p-4 rounded-2xl shadow-lg shadow-blue-100 active:scale-90 transition-all">
              <Plus size={20} />
            </button>
          </form>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label htmlFor="receipt-upload" className="cursor-pointer bg-sky-50 text-[#1F6FB8] border border-sky-100 px-5 py-4 rounded-2xl text-xs font-bold text-slate-800 hover:bg-sky-100 transition-all shadow-sm text-center flex items-center justify-center gap-2">
              {receiptLoading ? 'Scanning receipt…' : 'Scan receipt'}
            </label>
            <input id="receipt-upload" type="file" accept="image/*" capture="environment" onChange={(e) => onFileUpload(e.target.files[0])} className="hidden" />
          </div>

          <div className="grid gap-3 sm:grid-cols-[2fr_auto]">
            <input type="text" value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} placeholder="Enter barcode / UPC" className="bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none transition-all shadow-sm" />
            <button type="button" onClick={() => onBarcodeLookup(barcodeInput)} className="bg-[#6BAEE0] text-white px-5 py-4 rounded-2xl text-xs font-bold shadow-lg shadow-blue-100 hover:bg-[#5da0cf] transition-all">
              {barcodeLoading ? <Loader2 className="animate-spin" size={20} /> : <Scan size={20} />}
            </button>
          </div>

          <button 
            type="button" 
            onClick={() => setIsScanningBarcode(true)} 
            className="w-full bg-sky-50 text-[#1F6FB8] border border-sky-100 px-5 py-4 rounded-2xl text-xs font-bold hover:bg-sky-100 transition-all shadow-sm text-center flex items-center justify-center gap-2"
          >
            <Camera size={16} /> Scan with Camera
          </button>

          {isScanningBarcode && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
              <div className="bg-white/10 backdrop-blur-2xl rounded-[3rem] w-full max-w-md overflow-hidden relative shadow-2xl border border-white/20">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                  <h3 className="text-sm font-bold text-white tracking-tight">Scan Barcode</h3>
                  <button onClick={() => setIsScanningBarcode(false)} className="text-white/40 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <div className="relative aspect-square bg-black overflow-hidden">
                  <div id="barcode-scanner-region" className="w-full h-full"></div>
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-2/3 h-2/3 border-2 border-white/20 rounded-3xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.8)] animate-scanner-line"></div>
                    </div>
                  </div>
                </div>
                <div className="p-6 text-center bg-white/5">
                  <p className="text-xs text-white/50 font-medium">Position the barcode within the frame</p>
                </div>
              </div>
            </div>
          )}

          {barcodeResult && <p className="text-[12px] text-slate-500">{barcodeResult}</p>}
        </div>
      </section>

      {/* Stock List */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex justify-between items-center mb-6 px-2">
          <h2 className="text-[14px] font-bold text-slate-400">Pantry Stock</h2>
          <span className="bg-blue-50 text-[#6BAEE0] border border-blue-100 px-3 py-1 rounded-full text-[10px] font-black">{fridge.length} items</span>
        </div>
        
        <div className="grid gap-3">
          {fridge.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium italic text-center py-10">Your pantry is empty</p>
          ) : (
            fridge.map((item) => (
              <div key={item.id} className="bg-white border border-blue-50 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-sm group hover:shadow-md transition-all">
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <input type="text" defaultValue={item.raw_name} onBlur={(e) => onUpdateItem(item.id, e.target.value)} className="w-full bg-transparent text-xs font-bold text-slate-800 border-b border-transparent hover:border-blue-100 focus:border-sky-400 focus:outline-none pb-1" />
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-mono font-black text-slate-300 uppercase">
                      Sanitized: <span className="text-[#6BAEE0]">{item.item_name}</span>
                      {item.expiry_date && <span className="ml-2">Exp: {new Date(item.expiry_date).toLocaleDateString()}</span>}</span>
                    {isExpiringSoon(item.expiry_date) && <AlertCircle size={10} className="text-orange-400 animate-pulse" />}
                  </div>
                </div>
                <button onClick={() => onRemoveItem(item.id)} className="text-slate-200 hover:text-red-400 transition-colors p-2"><Trash2 size={16} /></button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}