/**
 * Dynamic Economy & Multiplayer Trading Hub Interface
 * Includes live planetary market, peer-to-peer player order book,
 * and high-yield colonial transport contracts.
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Coins,
  Package,
  ArrowRightLeft,
  Users,
  FileCheck,
  Building,
} from 'lucide-react';
import {
  TradeCommodity,
  MarketItem,
  TradeContract,
  SimulatedPlayerOrder,
  ShipResources,
} from '../types/game';
import { COMMODITIES } from '../sim/economy';

interface TradingHubPanelProps {
  currentStationBodyId: string;
  onChangeStation: (bodyId: string) => void;
  market: Record<string, MarketItem>;
  resources: ShipResources;
  playerOrders: SimulatedPlayerOrder[];
  contracts: TradeContract[];
  onBuyCommodity: (commodityId: string, amount: number) => void;
  onSellCommodity: (commodityId: string, amount: number) => void;
  onFulfillPlayerOrder: (order: SimulatedPlayerOrder) => void;
  onAcceptContract: (contractId: string) => void;
  onDeliverContract: (contractId: string) => void;
}

export const TradingHubPanel: React.FC<TradingHubPanelProps> = ({
  currentStationBodyId,
  onChangeStation,
  market,
  resources,
  playerOrders,
  contracts,
  onBuyCommodity,
  onSellCommodity,
  onFulfillPlayerOrder,
  onAcceptContract,
  onDeliverContract,
}) => {
  const [subTab, setSubTab] = useState<'market' | 'p2p' | 'contracts'>('market');

  const stations = [
    { id: 'earth', name: 'Earth (LEO Gateway)' },
    { id: 'mars', name: 'Mars (Bradbury Colony)' },
    { id: 'moon', name: 'Luna (Shackleton Depot)' },
    { id: 'ceres', name: 'Ceres (Asteroid Belt)' },
    { id: 'jupiter', name: 'Jupiter (Europa Abyss)' },
  ];

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* Top Header: Sub-Tabs & Station Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex space-x-1">
          <button
            onClick={() => setSubTab('market')}
            className={`px-3 py-1 rounded cursor-pointer font-semibold transition-colors flex items-center space-x-1.5 ${
              subTab === 'market' ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>LOCAL MARKET</span>
          </button>

          <button
            onClick={() => setSubTab('p2p')}
            className={`px-3 py-1 rounded cursor-pointer font-semibold transition-colors flex items-center space-x-1.5 ${
              subTab === 'p2p' ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>MULTIPLAYER ORDER BOOK</span>
          </button>

          <button
            onClick={() => setSubTab('contracts')}
            className={`px-3 py-1 rounded cursor-pointer font-semibold transition-colors flex items-center space-x-1.5 ${
              subTab === 'contracts' ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>TRADE CONTRACTS</span>
          </button>
        </div>

        {/* Station Selector */}
        {subTab === 'market' && (
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-[10px]">COMMERCE PORT:</span>
            <select
              value={currentStationBodyId}
              onChange={(e) => onChangeStation(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-0.5 text-slate-100 font-mono focus:outline-none focus:border-red-500 cursor-pointer"
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 1. LOCAL PLANETARY COMMODITY MARKET */}
      {subTab === 'market' && (
        <div className="max-h-72 overflow-y-auto pr-1 space-y-1.5">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] text-slate-400 border-b border-slate-800">
                <th className="py-1">COMMODITY</th>
                <th className="py-1">CATEGORY</th>
                <th className="py-1 text-right">BUY PRICE</th>
                <th className="py-1 text-right">SELL PRICE</th>
                <th className="py-1 text-center">TREND</th>
                <th className="py-1 text-right">IN CARGO</th>
                <th className="py-1 text-center">TRADE ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {COMMODITIES.map((comm) => {
                const item = market[comm.id] || { buyPrice: comm.basePrice, sellPrice: Math.round(comm.basePrice * 0.9), priceTrend: 'stable' };
                const playerHolding = resources.inventory[comm.id] || 0;

                return (
                  <tr key={comm.id} className="border-b border-slate-900 hover:bg-slate-900/50 transition-colors">
                    <td className="py-2 font-bold text-slate-200">
                      <div>{comm.name}</div>
                      <div className="text-[9px] text-slate-400 font-normal">{comm.unitMass} t/unit</div>
                    </td>
                    <td className="py-2 text-[10px] uppercase text-slate-400">{comm.category}</td>
                    <td className="py-2 text-right font-bold text-amber-400 tabular-nums">
                      {item.buyPrice} ¢
                    </td>
                    <td className="py-2 text-right font-bold text-emerald-400 tabular-nums">
                      {item.sellPrice} ¢
                    </td>
                    <td className="py-2 text-center">
                      {item.priceTrend === 'up' ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mx-auto" />
                      ) : item.priceTrend === 'down' ? (
                        <TrendingDown className="w-3.5 h-3.5 text-red-400 mx-auto" />
                      ) : (
                        <Minus className="w-3.5 h-3.5 text-slate-500 mx-auto" />
                      )}
                    </td>
                    <td className="py-2 text-right font-bold text-slate-200 tabular-nums">
                      {playerHolding}
                    </td>
                    <td className="py-2 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => onBuyCommodity(comm.id, 1)}
                          disabled={resources.credits < item.buyPrice || resources.cargoUsed + comm.unitMass > resources.cargoCapacity}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-amber-300 rounded font-bold cursor-pointer"
                        >
                          Buy 1
                        </button>
                        <button
                          onClick={() => onBuyCommodity(comm.id, 5)}
                          disabled={resources.credits < item.buyPrice * 5 || resources.cargoUsed + comm.unitMass * 5 > resources.cargoCapacity}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-amber-300 rounded font-bold cursor-pointer"
                        >
                          Buy 5
                        </button>
                        <button
                          onClick={() => onSellCommodity(comm.id, 1)}
                          disabled={playerHolding < 1}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-emerald-400 rounded font-bold cursor-pointer"
                        >
                          Sell 1
                        </button>
                        <button
                          onClick={() => onSellCommodity(comm.id, 5)}
                          disabled={playerHolding < 5}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-emerald-400 rounded font-bold cursor-pointer"
                        >
                          Sell 5
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. MULTIPLAYER PEER-TO-PEER ORDER BOOK */}
      {subTab === 'p2p' && (
        <div className="space-y-2">
          <div className="p-2 bg-slate-900/80 border border-slate-800 rounded flex items-center justify-between text-slate-300">
            <span>NETWORK TRADE TRAFFIC: <span className="text-emerald-400 font-bold">1,482 Commanders Online</span></span>
            <span className="text-[10px] text-slate-400">Live Peer Market Feed</span>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {playerOrders.map((ord) => {
              const comm = COMMODITIES.find((c) => c.id === ord.commodityId);
              const isBuy = ord.action === 'BUY';

              return (
                <div
                  key={ord.id}
                  className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-200">{ord.commanderName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">[{ord.callsign}]</span>
                      <span className="text-[9px] text-slate-500 font-mono">{ord.timestamp}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Location: <span className="text-slate-300">{ord.systemName}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-xs font-bold text-white">
                        {isBuy ? 'WANTS TO BUY' : 'OFFERING TO SELL'}{' '}
                        <span className={isBuy ? 'text-emerald-400' : 'text-amber-400'}>
                          {ord.amount}x {comm?.name}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        @ <span className="font-bold text-amber-400 tabular-nums">{ord.pricePerUnit} ¢</span> / unit
                      </div>
                    </div>

                    <button
                      onClick={() => onFulfillPlayerOrder(ord)}
                      className={`px-3 py-1.5 rounded font-bold cursor-pointer transition-colors ${
                        isBuy
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-amber-600 hover:bg-amber-500 text-white'
                      }`}
                    >
                      {isBuy ? 'Fulfill (Sell)' : 'Buy Offer'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. COLONIAL TRADE CONTRACTS */}
      {subTab === 'contracts' && (
        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
          {contracts.map((c) => {
            const comm = COMMODITIES.find((cm) => cm.id === c.commodityId);
            const playerHolding = resources.inventory[c.commodityId] || 0;
            const hasEnough = playerHolding >= c.amount;

            return (
              <div
                key={c.id}
                className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="font-bold text-slate-100 flex items-center space-x-2">
                    <span>{c.title}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-950 text-red-400 border border-red-800">
                      {c.factionId.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Route: <span className="text-slate-200 capitalize">{c.originBodyId}</span> →{' '}
                    <span className="text-slate-200 capitalize">{c.destinationBodyId}</span> · Required:{' '}
                    <span className="text-amber-400 font-bold">
                      {c.amount}x {comm?.name}
                    </span>{' '}
                    (Have: {playerHolding})
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-right">
                  <div>
                    <div className="text-xs font-bold text-amber-400 tabular-nums">
                      +{c.rewardCredits.toLocaleString()} ¢
                    </div>
                    <div className="text-[10px] text-emerald-400">+{c.reputationReward} Faction Standing</div>
                  </div>

                  {!c.isAccepted ? (
                    <button
                      onClick={() => onAcceptContract(c.id)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded font-bold cursor-pointer transition-colors"
                    >
                      Accept Contract
                    </button>
                  ) : (
                    <button
                      onClick={() => onDeliverContract(c.id)}
                      disabled={!hasEnough}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-bold cursor-pointer transition-colors"
                    >
                      Deliver Cargo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
