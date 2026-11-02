'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
  Moon,
  Sun,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Info,
  Cloud,
  RefreshCw,
  Copy,
  Zap,
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { BackupService } from '@/lib/backup/backupService';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  isSupabaseConfigured,
} from '@/lib/supabase/supabaseClient';
import { SupabaseSync, SUPABASE_SCHEMA_SQL } from '@/lib/supabase/syncService';

interface SettingsViewProps {
  onDataRestored: () => void;
}

export function SettingsView({ onDataRestored }: SettingsViewProps) {
  const { theme, toggleTheme } = useTheme();
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [importing, setImporting] = useState(false);

  // Supabase Cloud Sync State
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [configSource, setConfigSource] = useState<'env' | 'local' | 'none'>('none');
  const [syncingCloud, setSyncingCloud] = useState(false);

  useEffect(() => {
    const cfg = getSupabaseConfig();
    setSupabaseUrl(cfg.url);
    setSupabaseAnonKey(cfg.anonKey);
    setConfigSource(cfg.source);
  }, []);

  const handleSaveSupabaseConfig = () => {
    saveSupabaseConfig(supabaseUrl, supabaseAnonKey);
    const cfg = getSupabaseConfig();
    setConfigSource(cfg.source);
    if (cfg.url && cfg.anonKey) {
      SupabaseSync.subscribeToRealtime(() => onDataRestored());
      setStatusMessage({
        type: 'success',
        text: 'Supabase PostgreSQL + Realtime WebSockets connected!',
      });
    } else {
      setStatusMessage({
        type: 'success',
        text: 'Supabase credentials cleared. Running in local IndexedDB mode.',
      });
    }
  };

  const handlePushToCloud = async () => {
    setSyncingCloud(true);
    setStatusMessage(null);
    const res = await SupabaseSync.pushAllToCloud();
    setSyncingCloud(false);
    setStatusMessage({
      type: res.success ? 'success' : 'error',
      text: res.message,
    });
  };

  const handlePullFromCloud = async () => {
    setSyncingCloud(true);
    setStatusMessage(null);
    const res = await SupabaseSync.pullAllFromCloud();
    setSyncingCloud(false);
    setStatusMessage({
      type: res.success ? 'success' : 'error',
      text: res.message,
    });
    if (res.success) {
      onDataRestored();
    }
  };

  const handleCopySqlSchema = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setStatusMessage({
      type: 'success',
      text: 'Supabase SQL Schema copied to clipboard! Paste & Run it in your Supabase SQL Editor.',
    });
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export JSON Backup
  const handleExportJSON = async () => {
    try {
      const json = await BackupService.exportJSON();
      const dateStr = new Date().toISOString().split('T')[0];
      downloadFile(json, `rallyup-backup-${dateStr}.json`, 'application/json');
      setStatusMessage({ type: 'success', text: 'Backup file exported successfully!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to export backup.' });
    }
  };

  // Import JSON Backup
  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setStatusMessage(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const result = await BackupService.importJSON(content);
        if (result.success) {
          setStatusMessage({
            type: 'success',
            text: `Restored successfully! (${result.recordCounts?.players || 0} players, ${result.recordCounts?.sessions || 0} sessions, ${result.recordCounts?.matches || 0} matches)`,
          });
          onDataRestored();
        } else {
          setStatusMessage({ type: 'error', text: result.message });
        }
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: err.message || 'Failed to parse file.' });
      } finally {
        setImporting(false);
        e.target.value = ''; // reset file input
      }
    };
    reader.readAsText(file);
  };

  // Export CSVs
  const handleExportPlayersCSV = async () => {
    try {
      const csv = await BackupService.exportPlayersCSV();
      downloadFile(csv, `rallyup-players-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      setStatusMessage({ type: 'success', text: 'Players CSV exported!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleExportMatchesCSV = async () => {
    try {
      const csv = await BackupService.exportMatchesCSV();
      downloadFile(csv, `rallyup-matches-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      setStatusMessage({ type: 'success', text: 'Matches CSV exported!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleExportSessionsCSV = async () => {
    try {
      const csv = await BackupService.exportSessionsCSV();
      downloadFile(csv, `rallyup-sessions-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      setStatusMessage({ type: 'success', text: 'Sessions CSV exported!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  // Factory Reset
  const handleConfirmReset = async () => {
    if (resetInput !== 'DELETE ALL') {
      setStatusMessage({ type: 'error', text: 'Please type "DELETE ALL" to confirm reset.' });
      return;
    }

    try {
      await BackupService.resetDatabase();
      setShowResetConfirm(false);
      setResetInput('');
      setStatusMessage({ type: 'success', text: 'All database records have been reset.' });
      onDataRestored();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to reset database.' });
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-court-lightBorder dark:border-court-darkBorder pb-4">
        <h2 className="text-2xl font-black text-court-darkBg dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-pickle-500" />
          Settings & Local Data Backup
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Manage offline storage, backup JSON snapshots, export CSVs, and adjust preferences.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Offline Storage + Supabase Cloud Sync Notice Card */}
      <div className="p-4 rounded-xl bg-pickle-400/10 border border-pickle-400/20 text-xs text-pickle-800 dark:text-pickle-300 flex items-start gap-3">
        <HardDrive className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-extrabold text-sm">Hybrid Local-First IndexedDB + Supabase Realtime Architecture</p>
          <p className="text-[11px] leading-relaxed opacity-90">
            Every action writes to your device&apos;s local IndexedDB in &lt;1ms for zero-lag court performance, and automatically syncs in real-time via Supabase PostgreSQL + WebSockets when connected.
          </p>
        </div>
      </div>

      {/* Supabase PostgreSQL + Realtime WebSockets Configuration */}
      <div className="p-5 rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-court-darkBg dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-pickle-400" />
              Supabase (PostgreSQL + Realtime WebSockets)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Connect your Supabase project for live multi-device scoreboards and cloud sync.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
              isSupabaseConfigured()
                ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                : 'bg-gray-500/15 text-gray-400 border border-gray-500/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isSupabaseConfigured() ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'
              }`}
            />
            {isSupabaseConfigured()
              ? configSource === 'env'
                ? 'Connected (Env)'
                : 'Connected (Live)'
              : 'Local Mode'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Supabase Project URL
            </label>
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              disabled={configSource === 'env'}
              placeholder="https://xyzcompany.supabase.co"
              className="w-full px-3.5 py-2.5 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-xs text-court-darkBg dark:text-white focus:outline-none focus:border-pickle-400"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Supabase Anon Public Key
            </label>
            <input
              type="password"
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              disabled={configSource === 'env'}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-xs text-court-darkBg dark:text-white focus:outline-none focus:border-pickle-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {configSource !== 'env' && (
            <button
              onClick={handleSaveSupabaseConfig}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pickle-400 hover:bg-pickle-300 text-court-darkBg font-black text-xs uppercase tracking-wider shadow-sm transition-all"
            >
              <Cloud className="w-4 h-4" />
              <span>Save & Connect</span>
            </button>
          )}

          <button
            onClick={handlePushToCloud}
            disabled={!isSupabaseConfigured() || syncingCloud}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-court-lightBg dark:bg-court-darkBg hover:bg-pickle-400/20 disabled:opacity-40 border border-court-lightBorder dark:border-court-darkBorder text-xs font-bold text-court-darkBg dark:text-white transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-pickle-400 ${syncingCloud ? 'animate-spin' : ''}`} />
            <span>Push Local to Cloud</span>
          </button>

          <button
            onClick={handlePullFromCloud}
            disabled={!isSupabaseConfigured() || syncingCloud}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-court-lightBg dark:bg-court-darkBg hover:bg-pickle-400/20 disabled:opacity-40 border border-court-lightBorder dark:border-court-darkBorder text-xs font-bold text-court-darkBg dark:text-white transition-all"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Pull from Cloud</span>
          </button>

          <button
            onClick={handleCopySqlSchema}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-court-lightBg dark:bg-court-darkBg hover:bg-pickle-400/20 border border-court-lightBorder dark:border-court-darkBorder text-xs font-bold text-court-darkBg dark:text-white transition-all ml-auto"
          >
            <Copy className="w-3.5 h-3.5 text-amber-400" />
            <span>Copy SQL Schema</span>
          </button>
        </div>
      </div>

      {/* Appearance Settings */}
      <div className="p-5 rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-court-darkBg dark:text-white">
          Appearance & Theme
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-court-darkBg dark:text-white">Color Theme</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Toggle between deep pickleball dark mode and high-contrast light mode.
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-court-lightBorder dark:border-court-darkBorder text-xs font-bold text-court-darkBg dark:text-white shadow-sm hover:scale-105 transition-transform"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-pickle-400" />
                <span>Dark Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-emerald-800" />
                <span>Light Mode</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Backup and Restore (JSON) */}
      <div className="p-5 rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-court-darkBg dark:text-white">
            Full App Data Backup & Restore
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Save a full snapshot of your app database to transfer to another device or restore later.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            onClick={handleExportJSON}
            className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-pickle-400 hover:bg-pickle-300 text-court-darkBg font-black text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Export JSON Backup</span>
          </button>

          <label className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-court-lightBg dark:bg-court-darkBg hover:bg-gray-200 dark:hover:bg-court-darkCardHover border border-court-lightBorder dark:border-court-darkBorder text-court-darkBg dark:text-white font-bold text-xs uppercase tracking-wider cursor-pointer transition-all">
            <Upload className="w-4 h-4 text-pickle-500" />
            <span>{importing ? 'Importing...' : 'Restore JSON Backup'}</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              disabled={importing}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* CSV Exports */}
      <div className="p-5 rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-court-darkBg dark:text-white">
            Export to Spreadsheet (CSV)
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Download individual CSV spreadsheets for record keeping or external analysis.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <button
            onClick={handleExportPlayersCSV}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-court-lightBg dark:bg-court-darkBg hover:bg-pickle-400/20 border border-court-lightBorder dark:border-court-darkBorder text-xs font-bold text-court-darkBg dark:text-white transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>Export Players CSV</span>
          </button>

          <button
            onClick={handleExportMatchesCSV}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-court-lightBg dark:bg-court-darkBg hover:bg-pickle-400/20 border border-court-lightBorder dark:border-court-darkBorder text-xs font-bold text-court-darkBg dark:text-white transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-500" />
            <span>Export Matches CSV</span>
          </button>

          <button
            onClick={handleExportSessionsCSV}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-court-lightBg dark:bg-court-darkBg hover:bg-pickle-400/20 border border-court-lightBorder dark:border-court-darkBorder text-xs font-bold text-court-darkBg dark:text-white transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-sky-500" />
            <span>Export Sessions CSV</span>
          </button>
        </div>
      </div>

      {/* Danger Zone: Factory Reset */}
      <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Danger Zone
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Permanently delete all sessions, matches, and players from your local device.
          </p>
        </div>

        <button
          onClick={() => setShowResetConfirm(true)}
          className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all"
        >
          Reset All Data
        </button>
      </div>

      {/* Double Confirmation Modal for Reset */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-court-lightCard dark:bg-court-darkCard border border-court-lightBorder dark:border-court-darkBorder p-6 space-y-4 shadow-2xl text-court-darkBg dark:text-white">
            <h4 className="font-black text-lg text-red-500 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Reset All Application Data?
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              This will permanently wipe all local database tables (players, matches, sessions). Please make sure you have downloaded a JSON backup if you wish to keep your records.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-600 dark:text-gray-300 block">
                Type <strong>DELETE ALL</strong> to confirm:
              </label>
              <input
                type="text"
                value={resetInput}
                onChange={(e) => setResetInput(e.target.value)}
                placeholder="DELETE ALL"
                className="w-full px-3 py-2 rounded-xl bg-court-lightBg dark:bg-court-darkBg border border-red-500/40 text-xs font-mono font-bold text-red-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetInput('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={resetInput !== 'DELETE ALL'}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-red-600 hover:bg-red-700 text-white shadow-md disabled:opacity-50"
              >
                Confirm Complete Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
