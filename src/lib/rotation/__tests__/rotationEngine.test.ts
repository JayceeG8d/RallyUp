import { describe, it, expect } from 'vitest';
import { generateNextRoundMatches, buildPairHistory } from '../rotationEngine';
import { SessionParticipant, Court, Match } from '@/types';

function createMockParticipant(
  id: string,
  name: string,
  gamesPlayed = 0,
  waitingSince = 1000,
  order = 1
): SessionParticipant {
  return {
    id: `part-${id}`,
    sessionId: 'session-1',
    playerId: id,
    playerName: name,
    joinedAt: 1000,
    status: 'waiting',
    currentQueueOrder: order,
    waitingSince,
    gamesPlayed,
    wins: 0,
    losses: 0,
    pointsScored: 0,
    pointsConceded: 0,
  };
}

describe('Rotation Engine', () => {
  it('assigns exactly 4 players per court for doubles and leaves excess in queue', () => {
    const participants: SessionParticipant[] = [
      createMockParticipant('p1', 'Alice', 0, 1000, 1),
      createMockParticipant('p2', 'Bob', 0, 1001, 2),
      createMockParticipant('p3', 'Charlie', 0, 1002, 3),
      createMockParticipant('p4', 'Diana', 0, 1003, 4),
      createMockParticipant('p5', 'Evan', 0, 1004, 5),
      createMockParticipant('p6', 'Fiona', 0, 1005, 6),
    ];

    const courts: Court[] = [
      { id: 'c1', sessionId: 'session-1', courtNumber: 1, courtName: 'Court 1', status: 'available' },
    ];

    const { matches, updatedParticipants } = generateNextRoundMatches({
      sessionId: 'session-1',
      roundNumber: 1,
      matchFormat: 'doubles',
      rotationMode: 'fair',
      availableCourts: courts,
      activeMatches: [],
      participants,
    });

    expect(matches.length).toBe(1);
    expect(matches[0].teamA.playerIds.length).toBe(2);
    expect(matches[0].teamB.playerIds.length).toBe(2);

    const playing = updatedParticipants.filter((p) => p.status === 'playing');
    const waiting = updatedParticipants.filter((p) => p.status === 'waiting');

    expect(playing.length).toBe(4);
    expect(waiting.length).toBe(2);
  });

  it('assigns exactly 2 players per court for singles', () => {
    const participants: SessionParticipant[] = [
      createMockParticipant('p1', 'Alice', 0, 1000, 1),
      createMockParticipant('p2', 'Bob', 0, 1001, 2),
      createMockParticipant('p3', 'Charlie', 0, 1002, 3),
    ];

    const courts: Court[] = [
      { id: 'c1', sessionId: 'session-1', courtNumber: 1, courtName: 'Court 1', status: 'available' },
    ];

    const { matches, updatedParticipants } = generateNextRoundMatches({
      sessionId: 'session-1',
      roundNumber: 1,
      matchFormat: 'singles',
      rotationMode: 'fair',
      availableCourts: courts,
      activeMatches: [],
      participants,
    });

    expect(matches.length).toBe(1);
    expect(matches[0].teamA.playerIds.length).toBe(1);
    expect(matches[0].teamB.playerIds.length).toBe(1);
    expect(updatedParticipants.filter((p) => p.status === 'playing').length).toBe(2);
    expect(updatedParticipants.filter((p) => p.status === 'waiting').length).toBe(1);
  });

  it('fair rotation prioritizes players with fewer games played', () => {
    // 5 players, 1 court doubles (4 play, 1 waits)
    // p1 has played 2 games; p2, p3, p4, p5 have played 0 or 1 games
    const participants: SessionParticipant[] = [
      createMockParticipant('p1', 'Alice', 2, 900, 1), // played 2 games
      createMockParticipant('p2', 'Bob', 1, 1000, 2),
      createMockParticipant('p3', 'Charlie', 0, 1000, 3),
      createMockParticipant('p4', 'Diana', 0, 1000, 4),
      createMockParticipant('p5', 'Evan', 1, 1000, 5),
    ];

    const courts: Court[] = [
      { id: 'c1', sessionId: 'session-1', courtNumber: 1, courtName: 'Court 1', status: 'available' },
    ];

    const { matches } = generateNextRoundMatches({
      sessionId: 'session-1',
      roundNumber: 2,
      matchFormat: 'doubles',
      rotationMode: 'fair',
      availableCourts: courts,
      activeMatches: [],
      participants,
    });

    const assignedIds = [
      ...matches[0].teamA.playerIds,
      ...matches[0].teamB.playerIds,
    ];

    // Alice (p1) has played 2 games while others have 0 or 1, so Alice should wait!
    expect(assignedIds).not.toContain('p1');
    expect(assignedIds).toContain('p3'); // played 0 games
    expect(assignedIds).toContain('p4'); // played 0 games
  });

  it('never assigns a player who is already in an active match', () => {
    const participants: SessionParticipant[] = [
      createMockParticipant('p1', 'Alice', 0, 1000, 1),
      createMockParticipant('p2', 'Bob', 0, 1000, 2),
      createMockParticipant('p3', 'Charlie', 0, 1000, 3),
      createMockParticipant('p4', 'Diana', 0, 1000, 4),
    ];

    const activeMatch: Match = {
      id: 'm-active',
      sessionId: 'session-1',
      roundNumber: 1,
      courtNumber: 1,
      matchFormat: 'singles',
      scoringMethod: 'live',
      scoringFormat: 'sideout',
      targetScore: 11,
      winCondition: 'win_by_2',
      teamA: { playerIds: ['p1'], playerNames: ['Alice'] },
      teamB: { playerIds: ['p2'], playerNames: ['Bob'] },
      scoreA: 5,
      scoreB: 4,
      status: 'in_progress',
      winningTeam: null,
    };

    const courts: Court[] = [
      { id: 'c2', sessionId: 'session-1', courtNumber: 2, courtName: 'Court 2', status: 'available' },
    ];

    const { matches } = generateNextRoundMatches({
      sessionId: 'session-1',
      roundNumber: 1,
      matchFormat: 'singles',
      rotationMode: 'fair',
      availableCourts: courts,
      activeMatches: [activeMatch],
      participants,
    });

    expect(matches.length).toBe(1);
    expect(matches[0].teamA.playerIds[0]).toBe('p3');
    expect(matches[0].teamB.playerIds[0]).toBe('p4');
  });

  it('partner rotation minimizes repeated partnerships', () => {
    const completedMatches: Match[] = [
      {
        id: 'm1',
        sessionId: 'session-1',
        roundNumber: 1,
        courtNumber: 1,
        matchFormat: 'doubles',
        scoringMethod: 'live',
        scoringFormat: 'sideout',
        targetScore: 11,
        winCondition: 'win_by_2',
        teamA: { playerIds: ['p1', 'p2'], playerNames: ['Alice', 'Bob'] },
        teamB: { playerIds: ['p3', 'p4'], playerNames: ['Charlie', 'Diana'] },
        scoreA: 11,
        scoreB: 7,
        status: 'completed',
        winningTeam: 'teamA',
      },
    ];

    const participants: SessionParticipant[] = [
      createMockParticipant('p1', 'Alice', 1),
      createMockParticipant('p2', 'Bob', 1),
      createMockParticipant('p3', 'Charlie', 1),
      createMockParticipant('p4', 'Diana', 1),
    ];

    const courts: Court[] = [
      { id: 'c1', sessionId: 'session-1', courtNumber: 1, courtName: 'Court 1', status: 'available' },
    ];

    const { matches } = generateNextRoundMatches({
      sessionId: 'session-1',
      roundNumber: 2,
      matchFormat: 'doubles',
      rotationMode: 'partner',
      availableCourts: courts,
      activeMatches: [],
      participants,
      completedMatches,
    });

    // In previous match, p1 was partnered with p2.
    // In partner rotation, p1 should NOT be partnered with p2 if alternative exists!
    const p1Team = matches[0].teamA.playerIds.includes('p1')
      ? matches[0].teamA.playerIds
      : matches[0].teamB.playerIds;

    expect(p1Team).not.toEqual(['p1', 'p2']);
  });
});
