import React from 'react';
import { DollarSign, BarChart, ShoppingBag, TrendingDown, PieChart, Target } from 'lucide-react';
import { useUser } from './UserContext';

export default function AnalyticsDashboard({ metrics, fridge, shoppingList }) {
  const { household } = useUser();
  // Spending & Asset Calculations
  const pantryValue = fridge.reduce((sum, item) => sum + (item.price || 0), 0);
  const missingSpend = shoppingList.filter(i => !i.is_completed).reduce((sum, i) => sum + (i.price || 0), 0);
  const purchasedSpend = shoppingList.filter(i => i.is_completed).reduce((sum, i) => sum + (i.price || 0), 0);

  const uniqueStores = [...new Set(fridge.map(item => item.storeName).filter(Boolean))]; // Assuming storeName is added to fridge items

  // Savings Metric: Value of current stock vs what we still need to spend
  const totalBudget = pantryValue + missingSpend;
  const totalListCost = missingSpend + purchasedSpend;
  const stockEfficiency = totalBudget > 0 ? Math.round((pantryValue / totalBudget) * 100) : 0;

  const totalMacros = metrics.protein + metrics.carbs + metrics.fat || 1;
  const getPercent = (val) => Math.round((val / totalMacros) * 100);

  // Budget Progress
  const budgetLimit = household?.budget_limit || 0;
  const budgetPercent = budgetLimit > 0 ? Math.min(100, Math.round((totalListCost / budgetLimit) * 100)) : 0;
  const isOverBudget = totalListCost > budgetLimit && budgetLimit > 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-2 mb-6 px-2">
          <BarChart className="text-[#6BAEE0]" size={18} />
          <h2 className="text-[14px] font-bold text-slate-400">Nutritional Overview</h2>
        </div>

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

        {/* Visual Macro Distribution Chart */}
        <div className="mt-8 space-y-5 px-2">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>Protein Distribution</span>
              <span className="text-[#6BAEE0]">{getPercent(metrics.protein)}%</span>
            </div>
            <div className="h-3 bg-blue-50/50 rounded-full overflow-hidden border border-blue-100/50">
              <div className="h-full bg-[#6BAEE0] rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(107,174,224,0.4)]" style={{ width: `${getPercent(metrics.protein)}%` }}></div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>Carbs Distribution</span>
              <span className="text-sky-400">{getPercent(metrics.carbs)}%</span>
            </div>
            <div className="h-3 bg-blue-50/50 rounded-full overflow-hidden border border-blue-100/50">
              <div className="h-full bg-sky-300 rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(125,211,252,0.4)]" style={{ width: `${getPercent(metrics.carbs)}%` }}></div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>Fat Distribution</span>
              <span className="text-blue-300">{getPercent(metrics.fat)}%</span>
            </div>
            <div className="h-3 bg-blue-50/50 rounded-full overflow-hidden border border-blue-100/50">
              <div className="h-full bg-blue-200 rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(191,219,254,0.4)]" style={{ width: `${getPercent(metrics.fat)}%` }}></div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-2 mb-6 px-2">
          <PieChart className="text-[#6BAEE0]" size={18} />
          <h2 className="text-[14px] font-bold text-slate-400">Spending Breakdown</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg text-emerald-500 shadow-sm"><TrendingDown size={16} /></div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Inventory Value</p>
                  <p className="text-lg font-bold text-slate-700">${pantryValue.toFixed(2)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">In Stock</p>
              </div>
            </div>

            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg text-amber-500 shadow-sm"><ShoppingBag size={16} /></div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Projected Spend</p>
                  <p className="text-lg font-bold text-slate-700">${missingSpend.toFixed(2)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">Missing</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center bg-sky-50/30 p-6 rounded-[2rem] border border-sky-100/50 text-center relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-sky-100 opacity-20"><DollarSign size={80} /></div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Stock Efficiency</p>
            <p className="text-4xl font-black text-[#6BAEE0]">{stockEfficiency}%</p>
            <p className="text-[11px] text-slate-500 mt-2 px-4 leading-tight">Percentage of your total grocery budget currently sitting in your pantry.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-center mt-6">
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center">
            <DollarSign size={24} className="text-slate-400 mb-2" />
            <p className="text-xs text-slate-500">Total List Cost</p>
            <p className={`text-xl font-bold ${isOverBudget ? 'text-red-400' : 'text-[#6BAEE0]'}`}>
              ${totalListCost.toFixed(2)}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center">
            <ShoppingBag size={24} className="text-slate-400 mb-2" />
            <p className="text-xs text-slate-500">Stores Shopped</p>
            <p className="text-xl font-bold text-[#6BAEE0]">{uniqueStores.length}</p>
          </div>
        </div>

        {budgetLimit > 0 && (
          <div className="mt-8 px-2 space-y-3">
            <div className="flex justify-between items-end">
              <div className="flex items-center gap-2">
                <Target size={14} className={isOverBudget ? 'text-red-400' : 'text-slate-400'} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Budget Progress</span>
              </div>
              <span className={`text-[10px] font-black ${isOverBudget ? 'text-red-400' : 'text-[#6BAEE0]'}`}>
                ${totalListCost.toFixed(2)} / ${budgetLimit.toFixed(2)}
              </span>
            </div>
            <div className="h-4 bg-blue-50/50 rounded-full overflow-hidden border border-blue-100/50 relative">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${isOverBudget ? 'bg-red-400 shadow-red-200' : 'bg-[#6BAEE0] shadow-blue-100'}`} 
                style={{ width: `${budgetPercent}%` }}
              ></div>
            </div>
            {isOverBudget && <p className="text-[9px] font-bold text-red-400 text-center animate-pulse italic">Warning: You have exceeded your budget limit!</p>}
          </div>
        )}

        {uniqueStores.length > 0 && (
          <div className="mt-4 text-center text-xs text-slate-500">
            <p>Tracked stores: {uniqueStores.join(', ')}</p>
          </div>
        )}
      </section>
    </div>
  );
}