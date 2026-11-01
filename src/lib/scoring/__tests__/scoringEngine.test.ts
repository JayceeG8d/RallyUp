import { describe, it, expect } from 'vitest';
import { ScoringEngine, isMatchWon, validateManualScore } from '../scoringEngine';

describe('Scoring Engine - Traditional Side-Out Scoring', () => {
  it('initializes doubles with 0-0-2 (second server rule)', () => {
    const engine = new ScoringEngine({
      format: 'doubles',
      scoringFormat: 'sideout',
      targetScore: 11,
      winCondition: 'win_by_2',
    });

    expect(engine.state.scoreA).toBe(0);
    expect(engine.state.scoreB).toBe(0);
    expect(engine.state.servingTeam).toBe('teamA');
    expect(engine.state.serverNumber).toBe(2);
    expect(engine.state.scoreCall).toBe('0 - 0 - 2');
  });

  it('awards point only when serving team wins rally in sideout mode', () => {
    const engine = new ScoringEngine({
      format: 'doubles',
      scoringFormat: 'sideout',
      targetScore: 11,
      winCondition: 'win_by_2',
    });

    // Team A is serving and wins rally
    engine.rallyWonBy('teamA');
    expect(engine.state.scoreA).toBe(1);
    expect(engine.state.scoreB).toBe(0);
    expect(engine.state.scoreCall).toBe('1 - 0 - 2');
    expect(engine.state.servingSide).toBe('left'); // switched from right to left
  });

  it('triggers immediate side-out on initial server fault (server 2 starts match)', () => {
    const engine = new ScoringEngine({
      format: 'doubles',
      scoringFormat: 'sideout',
      targetScore: 11,
      winCondition: 'win_by_2',
    });

    // Team A is on server 2 at start; Team B wins rally -> Side-out to Team B!
    engine.rallyWonBy('teamB');
    expect(engine.state.scoreA).toBe(0);
    expect(engine.state.scoreB).toBe(0);
    expect(engine.state.servingTeam).toBe('teamB');
    expect(engine.state.serverNumber).toBe(1);
    expect(engine.state.scoreCall).toBe('0 - 0 - 1');
  });

  it('transitions from Server 1 to Server 2 on regular fault', () => {
    const engine = new ScoringEngine({
      format: 'doubles',
      scoringFormat: 'sideout',
      targetScore: 11,
      winCondition: 'win_by_2',
    });

    // Start: Team A server 2 faults -> Side-out to Team B (server 1)
    engine.rallyWonBy('teamB');
    expect(engine.state.servingTeam).toBe('teamB');
    expect(engine.state.serverNumber).toBe(1);

    // Team B scores a point -> 1 - 0 - 1
    engine.rallyWonBy('teamB');
    expect(engine.state.scoreB).toBe(1);
    expect(engine.state.scoreCall).toBe('1 - 0 - 1');

    // Team A wins rally -> Fault for Team B! Now Team B Server 2 serves!
    engine.rallyWonBy('teamA');
    expect(engine.state.scoreB).toBe(1);
    expect(engine.state.servingTeam).toBe('teamB');
    expect(engine.state.serverNumber).toBe(2);
    expect(engine.state.scoreCall).toBe('1 - 0 - 2');

    // Team A wins rally again -> Second fault -> Side-out to Team A!
    engine.rallyWonBy('teamA');
    expect(engine.state.servingTeam).toBe('teamA');
    expect(engine.state.serverNumber).toBe(1);
    expect(engine.state.scoreCall).toBe('0 - 1 - 1');
  });

  it('handles singles side-out scoring correctly', () => {
    const engine = new ScoringEngine({
      format: 'singles',
      scoringFormat: 'sideout',
      targetScore: 11,
      winCondition: 'win_by_2',
    });

    expect(engine.state.scoreCall).toBe('0 - 0');

    // Team A wins rally
    engine.rallyWonBy('teamA');
    expect(engine.state.scoreA).toBe(1);
    expect(engine.state.scoreCall).toBe('1 - 0');
    expect(engine.state.servingSide).toBe('left'); // 1 is odd -> left court

    // Team B wins rally -> Immediate side-out in singles
    engine.rallyWonBy('teamB');
    expect(engine.state.servingTeam).toBe('teamB');
    expect(engine.state.scoreCall).toBe('0 - 1'); // Serving score (0) - Receiving score (1)
  });
});

describe('Scoring Engine - Rally Scoring', () => {
  it('awards points on every rally regardless of server', () => {
    const engine = new ScoringEngine({
      format: 'doubles',
      scoringFormat: 'rally',
      targetScore: 15,
      winCondition: 'win_by_2',
    });

    // Team A serving, but Team B wins rally
    engine.rallyWonBy('teamB');
    expect(engine.state.scoreA).toBe(0);
    expect(engine.state.scoreB).toBe(1);
    expect(engine.state.servingTeam).toBe('teamB'); // Serve moves to winning team
    expect(engine.state.scoreCall).toBe('1 - 0');
  });
});

describe('Scoring Engine - Undo Functionality', () => {
  it('undo restores exact prior score, server, and positions', () => {
    const engine = new ScoringEngine({
      format: 'doubles',
      scoringFormat: 'sideout',
      targetScore: 11,
      winCondition: 'win_by_2',
    });

    // Initial state
    expect(engine.state.scoreA).toBe(0);

    // Score point
    engine.rallyWonBy('teamA');
    expect(engine.state.scoreA).toBe(1);
    expect(engine.state.servingSide).toBe('left');

    // Undo
    const undone = engine.undo();
    expect(undone).toBe(true);
    expect(engine.state.scoreA).toBe(0);
    expect(engine.state.scoreB).toBe(0);
    expect(engine.state.servingSide).toBe('right');
    expect(engine.state.serverNumber).toBe(2);
    expect(engine.state.scoreCall).toBe('0 - 0 - 2');
  });

  it('cannot undo past start of match', () => {
    const engine = new ScoringEngine({
      format: 'doubles',
      scoringFormat: 'sideout',
      targetScore: 11,
      winCondition: 'win_by_2',
    });

    const undone = engine.undo();
    expect(undone).toBe(false);
  });
});

describe('Win Condition Validation', () => {
  it('validates win by 2 correctly', () => {
    expect(isMatchWon(11, 9, 11, 'win_by_2')).toBe(true);
    expect(isMatchWon(11, 10, 11, 'win_by_2')).toBe(false);
    expect(isMatchWon(12, 10, 11, 'win_by_2')).toBe(true);
    expect(isMatchWon(9, 7, 11, 'win_by_2')).toBe(false); // below target
  });

  it('validates win by 1 correctly', () => {
    expect(isMatchWon(11, 10, 11, 'win_by_1')).toBe(true);
    expect(isMatchWon(10, 10, 11, 'win_by_1')).toBe(false);
  });

  it('validates manual score entries properly', () => {
    const valid = validateManualScore(11, 9, 11, 'win_by_2');
    expect(valid.isValid).toBe(true);
    expect(valid.winner).toBe('teamA');

    const tie = validateManualScore(11, 11, 11, 'win_by_2');
    expect(tie.isValid).toBe(false);

    const insufficientLead = validateManualScore(11, 10, 11, 'win_by_2');
    expect(insufficientLead.isValid).toBe(false);
  });
});
