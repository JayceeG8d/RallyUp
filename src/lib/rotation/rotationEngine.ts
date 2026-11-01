import { MatchFormat, RotationMode, SessionParticipant, Court, Match } from '@/types';
import { generateId } from '../db/repository';

export interface GeneratedMatchDraft {
  id: string;
  sessionId: string;
  roundNumber: number;
  courtNumber: number;
  matchFormat: MatchFormat;
  teamA: {
    playerIds: string[];
    playerNames: string[];
  };
  teamB: {
    playerIds: string[];
    playerNames: string[];
  };
}

export interface PairHistoryTracker {
  // Key: "id1-id2" sorted
  partnerships: Map<string, number>;
  opponents: Map<string, number>;
}

export function buildPairHistory(completedMatches: Match[]): PairHistoryTracker {
  const partnerships = new Map<string, number>();
  const opponents = new Map<string, number>();

  for (const m of completedMatches) {
    if (m.status !== 'completed') continue;

    // Record partners in Team A
    if (m.teamA.playerIds.length === 2) {
      const [p1, p2] = [...m.teamA.playerIds].sort();
      const key = `${p1}-${p2}`;
      partnerships.set(key, (partnerships.get(key) || 0) + 1);
    }

    // Record partners in Team B
    if (m.teamB.playerIds.length === 2) {
      const [p1, p2] = [...m.teamB.playerIds].sort();
      const key = `${p1}-${p2}`;
      partnerships.set(key, (partnerships.get(key) || 0) + 1);
    }

    // Record opponents
    for (const a of m.teamA.playerIds) {
      for (const b of m.teamB.playerIds) {
        const [p1, p2] = [a, b].sort();
        const key = `${p1}-${p2}`;
        opponents.set(key, (opponents.get(key) || 0) + 1);
      }
    }
  }

  return { partnerships, opponents };
}

/**
 * Generate next round matches for open courts
 */
export function generateNextRoundMatches({
  sessionId,
  roundNumber,
  matchFormat,
  rotationMode,
  availableCourts,
  activeMatches,
  participants,
  completedMatches = [],
}: {
  sessionId: string;
  roundNumber: number;
  matchFormat: MatchFormat;
  rotationMode: RotationMode;
  availableCourts: Court[];
  activeMatches: Match[];
  participants: SessionParticipant[];
  completedMatches?: Match[];
}): {
  matches: GeneratedMatchDraft[];
  updatedParticipants: SessionParticipant[];
} {
  const playersPerCourt = matchFormat === 'doubles' ? 4 : 2;

  // Filter out players already playing in any active match
  const currentlyPlayingIds = new Set<string>();
  for (const match of activeMatches) {
    if (match.status === 'in_progress') {
      match.teamA.playerIds.forEach((id) => currentlyPlayingIds.add(id));
      match.teamB.playerIds.forEach((id) => currentlyPlayingIds.add(id));
    }
  }

  // Available candidate pool (status 'waiting' and not currently playing)
  const availableCandidates = participants.filter(
    (p) => p.status === 'waiting' && !currentlyPlayingIds.has(p.playerId)
  );

  // Sort candidates according to rotation mode
  let sortedCandidates: SessionParticipant[] = [];

  if (rotationMode === 'fair') {
    // Fair rotation:
    // 1. Prioritize lowest gamesPlayed in this session
    // 2. Break tie by longest waiting time (waitingSince ascending, or currentQueueOrder ascending)
    sortedCandidates = [...availableCandidates].sort((a, b) => {
      const gamesDiff = (a.gamesPlayed || 0) - (b.gamesPlayed || 0);
      if (gamesDiff !== 0) return gamesDiff;

      const waitA = a.waitingSince || 0;
      const waitB = b.waitingSince || 0;
      if (waitA !== waitB) return waitA - waitB;

      return (a.currentQueueOrder || 0) - (b.currentQueueOrder || 0);
    });
  } else if (rotationMode === 'random') {
    // Random shuffle
    sortedCandidates = [...availableCandidates].sort(() => Math.random() - 0.5);
  } else {
    // Partner rotation:
    // First prioritize players with fewer games, then we optimize pairings
    sortedCandidates = [...availableCandidates].sort((a, b) => {
      const gamesDiff = (a.gamesPlayed || 0) - (b.gamesPlayed || 0);
      if (gamesDiff !== 0) return gamesDiff;
      return (a.waitingSince || 0) - (b.waitingSince || 0);
    });
  }

  const matches: GeneratedMatchDraft[] = [];
  const assignedPlayerIds = new Set<string>();
  const historyTracker = buildPairHistory(completedMatches);

  // Assign players to available courts
  for (const court of availableCourts) {
    // Remaining unassigned candidates
    const pool = sortedCandidates.filter((p) => !assignedPlayerIds.has(p.playerId));
    if (pool.length < playersPerCourt) {
      // Not enough players to fill this court
      break;
    }

    const selected = pool.slice(0, playersPerCourt);
    selected.forEach((p) => assignedPlayerIds.add(p.playerId));

    let teamAIds: string[] = [];
    let teamANames: string[] = [];
    let teamBIds: string[] = [];
    let teamBNames: string[] = [];

    if (matchFormat === 'singles') {
      teamAIds = [selected[0].playerId];
      teamANames = [selected[0].playerName];
      teamBIds = [selected[1].playerId];
      teamBNames = [selected[1].playerName];
    } else {
      // Doubles (4 players: p0, p1, p2, p3)
      if (rotationMode === 'partner') {
        // Optimize pairing among the 4 chosen players to minimize prior partnerships
        const permutations = [
          { a: [selected[0], selected[1]], b: [selected[2], selected[3]] },
          { a: [selected[0], selected[2]], b: [selected[1], selected[3]] },
          { a: [selected[0], selected[3]], b: [selected[1], selected[2]] },
        ];

        let bestPermutation = permutations[0];
        let lowestCost = Infinity;

        for (const perm of permutations) {
          const kA = [perm.a[0].playerId, perm.a[1].playerId].sort().join('-');
          const kB = [perm.b[0].playerId, perm.b[1].playerId].sort().join('-');
          const partnerCost = (historyTracker.partnerships.get(kA) || 0) + (historyTracker.partnerships.get(kB) || 0);

          let opponentCost = 0;
          for (const pa of perm.a) {
            for (const pb of perm.b) {
              const kOpp = [pa.playerId, pb.playerId].sort().join('-');
              opponentCost += historyTracker.opponents.get(kOpp) || 0;
            }
          }

          const totalCost = partnerCost * 10 + opponentCost;
          if (totalCost < lowestCost) {
            lowestCost = totalCost;
            bestPermutation = perm;
          }
        }

        teamAIds = bestPermutation.a.map((p) => p.playerId);
        teamANames = bestPermutation.a.map((p) => p.playerName);
        teamBIds = bestPermutation.b.map((p) => p.playerId);
        teamBNames = bestPermutation.b.map((p) => p.playerName);
      } else {
        // Standard pairing
        teamAIds = [selected[0].playerId, selected[1].playerId];
        teamANames = [selected[0].playerName, selected[1].playerName];
        teamBIds = [selected[2].playerId, selected[3].playerId];
        teamBNames = [selected[2].playerName, selected[3].playerName];
      }
    }

    matches.push({
      id: generateId(),
      sessionId,
      roundNumber,
      courtNumber: court.courtNumber,
      matchFormat,
      teamA: { playerIds: teamAIds, playerNames: teamANames },
      teamB: { playerIds: teamBIds, playerNames: teamBNames },
    });
  }

  // Update participant statuses and waiting order
  const updatedParticipants = participants.map((p) => {
    if (assignedPlayerIds.has(p.playerId)) {
      return {
        ...p,
        status: 'playing' as const,
      };
    }
    return p;
  });

  return { matches, updatedParticipants };
}
