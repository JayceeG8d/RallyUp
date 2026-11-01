'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { NewSessionWizard } from '@/components/session-wizard/NewSessionWizard';
import { LiveSessionDashboard } from '@/components/live-session/LiveSessionDashboard';
import { PlayerManager } from '@/components/players/PlayerManager';
import { RankingsView } from '@/components/rankings/RankingsView';
import { GameHistoryView } from '@/components/history/GameHistoryView';
import { SettingsView } from '@/components/settings/SettingsView';

import { db } from '@/lib/db/dexie';
import { Player, Session, Match, SessionParticipant } from '@/types';
import { PlayerRepo, SessionRepo } from '@/lib/db/repository';

// Default starter roster to seed if DB is empty on first boot
const DEFAULT_STARTER_PLAYERS = [
  { name: 'Ben Johns', skillLevel: '5.0+' },
  { name: 'Anna Leigh Waters', skillLevel: '5.0+' },
  { name: 'Collin Johns', skillLevel: '4.75' },
  { name: 'Catherine Parenteau', skillLevel: '4.5' },
  { name: 'Tyson McGuffin', skillLevel: '4.5' },
  { name: 'Lea Jansen', skillLevel: '4.0' },
  { name: 'Riley Newman', skillLevel: '4.25' },
  { name: 'JW Johnson', skillLevel: '4.75' },
];

export default function Home() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [activeSession, setActiveSession] = useState<Session | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // Load all Dexie data
  const loadDatabaseData = async () => {
    try {
      let allPlayers = await db.players.toArray();

      // Seed starter roster if empty
      if (allPlayers.length === 0) {
        for (const starter of DEFAULT_STARTER_PLAYERS) {
          await PlayerRepo.create({
            name: starter.name,
            skillLevel: starter.skillLevel,
          });
        }
        allPlayers = await db.players.toArray();
      }

      const allSessions = await db.sessions.orderBy('createdAt').reverse().toArray();
      const allMatches = await db.matches.toArray();
      const allParticipants = await db.sessionParticipants.toArray();
      const currentActive = allSessions.find((s) => s.status === 'active');

      setPlayers(allPlayers);
      setSessions(allSessions);
      setMatches(allMatches);
      setParticipants(allParticipants);
      setActiveSession(currentActive);
      setLoading(false);
    } catch (err) {
      console.error('Database load error:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabaseData();

    // Register Service Worker for PWA offline operation
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('Service Worker registered:', reg.scope))
        .catch((err) => console.warn('Service Worker registration failed:', err));
    }
  }, []);

  const handleSessionStarted = async (sessionId: string) => {
    await loadDatabaseData();
    setCurrentTab('live-session');
  };

  const handleSessionFinished = async () => {
    await loadDatabaseData();
    setCurrentTab('history');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-court-darkBg flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-pickle-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold tracking-wider text-pickle-400">Loading RallyUp...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-court-lightBg dark:bg-court-darkBg text-court-darkBg dark:text-white flex flex-col transition-colors duration-200">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onNavigate={setCurrentTab}
        hasActiveSession={Boolean(activeSession)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 pt-5">
        {currentTab === 'dashboard' && (
          <Dashboard
            onNavigate={setCurrentTab}
            players={players}
            sessions={sessions}
            matches={matches}
            activeSession={activeSession}
          />
        )}

        {currentTab === 'new-session' && (
          <NewSessionWizard
            savedPlayers={players}
            onSessionStarted={handleSessionStarted}
            onCancel={() => setCurrentTab('dashboard')}
            onPlayerCreated={loadDatabaseData}
          />
        )}

        {currentTab === 'live-session' && (
          activeSession ? (
            <LiveSessionDashboard
              session={activeSession}
              onSessionFinished={handleSessionFinished}
              onExit={() => setCurrentTab('dashboard')}
            />
          ) : (
            <div className="py-20 text-center space-y-4">
              <h3 className="text-xl font-bold">No active open play session</h3>
              <p className="text-xs text-gray-400">
                Start a new open play session to begin court rotation and scoring.
              </p>
              <button
                onClick={() => setCurrentTab('new-session')}
                className="px-6 py-3 rounded-xl bg-pickle-400 text-court-darkBg font-black text-xs uppercase"
              >
                Create New Session
              </button>
            </div>
          )
        )}

        {currentTab === 'players' && (
          <PlayerManager
            players={players}
            matches={matches}
            onPlayerUpdated={loadDatabaseData}
          />
        )}

        {currentTab === 'rankings' && (
          <RankingsView
            players={players}
            sessions={sessions}
            participants={participants}
            activeSession={activeSession}
          />
        )}

        {currentTab === 'history' && (
          <GameHistoryView
            sessions={sessions}
            matches={matches}
            participants={participants}
            onSessionDeleted={loadDatabaseData}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView onDataRestored={loadDatabaseData} />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onNavigate={setCurrentTab}
        hasActiveSession={Boolean(activeSession)}
      />
    </div>
  );
}
