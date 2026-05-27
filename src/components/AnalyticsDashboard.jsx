import React from 'react';
import { DollarSign, BarChart, ShoppingBag } from 'lucide-react';

export default function AnalyticsDashboard({ metrics, fridge, shoppingList }) {
  // Placeholder for price tracking and store insights
  const totalShoppingCost = shoppingList.reduce((sum, item) => sum + (item.price || 0), 0);
  const uniqueStores = [...new Set(fridge.map(item => item.storeName).filter(Boolean))]; // Assuming storeName is added to fridge items

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <h2 className="text-[14px] font-bold text-slate-400 mb-4 px-2">Nutritional Overview</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <p className="text-xs text-slate-500">Protein</p>
            <p className="text-xl font-bold text-[#6BAEE0]">{metrics.protein}g</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <p className="text-xs text-slate-500">Carbs</p>
            <p className="text-xl font-bold text-[#6BAEE0]">{metrics.carbs}g</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <p className="text-xs text-slate-500">Fat</p>
            <p className="text-xl font-bold text-[#6BAEE0]">{metrics.fat}g</p>
          </div>
        </div>
      </section>

      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <h2 className="text-[14px] font-bold text-slate-400 mb-4 px-2">Shopping & Price Insights</h2>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center">
            <DollarSign size={24} className="text-slate-400 mb-2" />
            <p className="text-xs text-slate-500">Est. Shopping Cost</p>
            <p className="text-xl font-bold text-[#6BAEE0]">${totalShoppingCost.toFixed(2)}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center">
            <ShoppingBag size={24} className="text-slate-400 mb-2" />
            <p className="text-xs text-slate-500">Stores Shopped</p>
            <p className="text-xl font-bold text-[#6BAEE0]">{uniqueStores.length}</p>
          </div>
        </div>
        {uniqueStores.length > 0 && (
          <div className="mt-4 text-center text-xs text-slate-500">
            <p>Tracked stores: {uniqueStores.join(', ')}</p>
          </div>
        )}
      </section>
    </div>
  );
}