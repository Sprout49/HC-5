import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi,
  WifiOff,
  Bluetooth,
  Smartphone,
  RefreshCw,
  Layers,
  X,
  Zap,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { meshNetwork } from '../../utils/meshNetwork';
import type { MeshNode, MeshPacket } from '../../utils/meshNetwork';
import { API_BASE } from '../../context/SimulationContext';

interface MeshRelayHUDProps {
  compact?: boolean;
}

export const MeshRelayHUD: React.FC<MeshRelayHUDProps> = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [nodes, setNodes] = useState<MeshNode[]>(meshNetwork.getNodes());
  const [packets, setPackets] = useState<MeshPacket[]>(meshNetwork.getPacketBuffer());
  const [isBlackout, setIsBlackout] = useState(meshNetwork.isBlackoutActive());
  const [btStatus, setBtStatus] = useState(meshNetwork.getBluetoothStatus());
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = meshNetwork.subscribe((currentNodes, currentPackets) => {
      setNodes([...currentNodes]);
      setPackets([...currentPackets]);
      setIsBlackout(meshNetwork.isBlackoutActive());
      setBtStatus(meshNetwork.getBluetoothStatus());
    });
    return () => unsubscribe();
  }, []);

  const handlePairBluetooth = async () => {
    setStatusMessage('Searching for nearby smartphone BLE beacons (Zero External Hardware)...');
    const res = await meshNetwork.pairBluetoothDevice();
    setStatusMessage(res.message);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleToggleBlackout = () => {
    const nextVal = !isBlackout;
    meshNetwork.setSimulatedBlackout(nextVal);
    setStatusMessage(
      nextVal
        ? '⚠️ Cell towers down! Way 2 Pre-Cached PWA & BLE Store-and-Forward Mesh active.'
        : '✅ 4G/5G Cellular connection restored. Central routing active.'
    );
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleSyncPackets = async () => {
    setSyncing(true);
    const count = await meshNetwork.flushPacketBuffer(API_BASE);
    setStatusMessage(`Successfully synced ${count} mesh packets with Central HQ!`);
    setSyncing(false);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const activeNodesCount = nodes.length;

  return (
    <>
      {/* 1. Header Trigger Pill */}
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs border cursor-pointer ${
          isBlackout
            ? 'bg-amber-500/10 text-amber-700 border-amber-300 ring-2 ring-amber-400/30 animate-pulse'
            : btStatus.connected
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-slate-100 text-slate-700 border-slate-200/80 hover:bg-slate-200'
        }`}
        title="Way 2: Pre-Cached PWA & BLE Mesh Network (Zero External Hardware)"
      >
        {isBlackout ? (
          <WifiOff className="w-3.5 h-3.5 text-amber-600" />
        ) : (
          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
        )}
        <span>Mesh:</span>
        <span className="font-mono">{isBlackout ? 'P2P BLE FALLBACK' : `${activeNodesCount} Nodes`}</span>
        {btStatus.connected && (
          <Bluetooth className="w-3 h-3 text-blue-600 fill-blue-600" />
        )}
      </motion.button>

      {/* 2. Modal Portaled to document.body so it NEVER clips or hides the header */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <div 
                className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setIsOpen(false);
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] my-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-indigo-300" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm tracking-tight flex items-center gap-2">
                          Way 2: Pre-Cached PWA & Bluetooth (BLE) Mesh
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                            {isBlackout ? 'BLE MESH ACTIVE' : 'ONLINE + MESH STANDBY'}
                          </span>
                        </h3>
                        <p className="text-[11px] text-slate-300">
                          100% Software-Only Disaster Mesh • Built-in Phone Bluetooth & Store-and-Forward
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Status Banner */}
                  {statusMessage && (
                    <div className="px-6 py-2.5 bg-blue-50 border-b border-blue-100 text-xs font-semibold text-blue-900 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>{statusMessage}</span>
                    </div>
                  )}

                  {/* Way 2 Visual Pipeline Banner */}
                  <div className="px-6 py-3 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between text-[11px] font-bold text-indigo-950 overflow-x-auto">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-black">1</span>
                      <span>Phone A (PWA)</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-black">2</span>
                      <span>Phone B (BLE Relay)</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-black">3</span>
                      <span>Ambulance (Vehicle Ingest)</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-black">4</span>
                      <span>Command HQ</span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-6 overflow-y-auto space-y-5">
                    {/* Simulation Control Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Bluetooth BLE Link Card */}
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <Bluetooth className="w-4 h-4 text-blue-600" />
                              Phone Bluetooth (BLE 5.0)
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                btStatus.connected
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {btStatus.connected ? 'BLE ACTIVE' : 'STANDBY'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Connect built-in device Bluetooth radio. Uses standard BLE advertisements with zero pairing codes needed.
                          </p>
                        </div>

                        <div className="mt-3 flex gap-2">
                          {!btStatus.connected ? (
                            <button
                              onClick={handlePairBluetooth}
                              className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Bluetooth className="w-3.5 h-3.5" />
                              Link Phone Bluetooth (BLE)
                            </button>
                          ) : (
                            <button
                              onClick={() => meshNetwork.disconnectBluetooth()}
                              className="flex-1 py-1.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              Disconnect BLE Link
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Cell Blackout Simulator Card */}
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <WifiOff className="w-4 h-4 text-amber-600" />
                              Cell Tower Blackout Test
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isBlackout
                                  ? 'bg-amber-100 text-amber-800 animate-pulse'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isBlackout ? '4G/5G OFFLINE' : '4G/5G NORMAL'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Simulate total cellular tower failure. Demonstrates how Way 2 BLE mesh routes dispatches without internet.
                          </p>
                        </div>

                        <div className="mt-3">
                          <button
                            onClick={handleToggleBlackout}
                            className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              isBlackout
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                : 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                            }`}
                          >
                            {isBlackout ? 'Restore Central Cellular' : 'Simulate Tower Blackout'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Active Way 2 Mesh Topology */}
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-600" />
                          Way 2 Bluetooth Mesh Topology ({nodes.length} Nodes)
                        </h4>
                        <span className="text-[11px] text-indigo-600 font-bold">Auto Hop-by-Hop Routing</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {nodes.map((node) => (
                          <div
                            key={node.id}
                            className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-slate-800">{node.name}</span>
                                {node.isLiveTab && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md">
                                    LIVE TAB
                                  </span>
                                )}
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                  {node.hops === 0 ? 'Direct IPC' : `${node.hops} hop`}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                                <span>Proto: <strong className="text-indigo-600">{node.protocol}</strong></span>
                                <span>Signal: <strong className="font-mono text-slate-700">{node.isLiveTab ? '0ms' : `${node.rssi} dBm`}</strong></span>
                              </div>
                            </div>

                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Offline Packet Buffer */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">
                            P2P Offline Packet Buffer ({packets.length} Queued)
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Distress signals stored locally on phones and forwarded when near an ambulance.
                          </p>
                        </div>

                        <button
                          onClick={handleSyncPackets}
                          disabled={syncing || packets.length === 0}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                          <span>Sync HQ</span>
                        </button>
                      </div>

                      {packets.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400 font-medium">
                          Buffer clean • All mesh packets dispatched to central grid.
                        </div>
                      ) : (
                        <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs font-mono">
                          {packets.slice(0, 5).map((pkt) => (
                            <div
                              key={pkt.id}
                              className="p-2 bg-white rounded-lg border border-slate-200 text-[11px] flex items-center justify-between text-slate-700"
                            >
                              <span className="font-bold text-indigo-700">[{pkt.type}]</span>
                              <span className="truncate max-w-[200px]">
                                {JSON.stringify(pkt.payload).substring(0, 45)}...
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(pkt.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      100% Software-Only • Progressive Web App + BLE 5.0 Standard
                    </span>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};
