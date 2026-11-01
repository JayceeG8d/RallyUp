import { MatchFormat, ScoringFormat, WinCondition } from '@/types';

export interface CourtPositions {
  teamA: {
    rightPlayerIndex: number; // 0 or 1
    leftPlayerIndex: number; // 0 or 1
  };
  teamB: {
    rightPlayerIndex: number;
    leftPlayerIndex: number;
  };
}

export interface ScoreState {
  scoreA: number;
  scoreB: number;
  servingTeam: 'teamA' | 'teamB';
  serverNumber: 1 | 2; // For doubles sideout
  servingSide: 'right' | 'left';
  servingPlayerIndex: number; // 0 or 1
  scoreCall: string;
  positions: CourtPositions;
}

export interface ScoringSnapshot {
  state: ScoreState;
  actionDescription: string;
  timestamp: number;
}

export interface MatchRules {
  format: MatchFormat;
  scoringFormat: ScoringFormat;
  targetScore: number;
  winCondition: WinCondition;
}

export class ScoringEngine {
  public state: ScoreState;
  public history: ScoringSnapshot[] = [];
  public rules: MatchRules;

  constructor(rules: MatchRules, initialState?: ScoreState, initialHistory?: ScoringSnapshot[]) {
    this.rules = rules;

    if (initialState) {
      this.state = JSON.parse(JSON.stringify(initialState));
      this.history = initialHistory ? JSON.parse(JSON.stringify(initialHistory)) : [];
    } else {
      this.state = this.getInitialState();
      this.recordSnapshot('Match started');
    }
  }

  private getInitialState(): ScoreState {
    const isDoubles = this.rules.format === 'doubles';
    const isSideout = this.rules.scoringFormat === 'sideout';

    // In traditional doubles side-out scoring, initial service starts on server 2 (0-0-2)
    const initialServerNumber: 1 | 2 = isDoubles && isSideout ? 2 : 1;

    const state: ScoreState = {
      scoreA: 0,
      scoreB: 0,
      servingTeam: 'teamA',
      serverNumber: initialServerNumber,
      servingSide: 'right', // Match always starts serving from the right court
      servingPlayerIndex: 0, // Team A first player starts on the right
      scoreCall: this.generateScoreCall(0, 0, 'teamA', initialServerNumber),
      positions: {
        teamA: { rightPlayerIndex: 0, leftPlayerIndex: 1 },
        teamB: { rightPlayerIndex: 0, leftPlayerIndex: 1 },
      },
    };

    return state;
  }

  public generateScoreCall(
    scoreA: number,
    scoreB: number,
    servingTeam: 'teamA' | 'teamB',
    serverNumber: 1 | 2
  ): string {
    const servingScore = servingTeam === 'teamA' ? scoreA : scoreB;
    const receivingScore = servingTeam === 'teamA' ? scoreB : scoreA;

    if (this.rules.format === 'singles' || this.rules.scoringFormat === 'rally') {
      return `${servingScore} - ${receivingScore}`;
    }

    // Traditional doubles side-out format: Serving Score - Receiving Score - Server Number
    return `${servingScore} - ${receivingScore} - ${serverNumber}`;
  }

  private recordSnapshot(actionDescription: string) {
    this.history.push({
      state: JSON.parse(JSON.stringify(this.state)),
      actionDescription,
      timestamp: Date.now(),
    });
  }

  /**
   * Process a rally won by Team A or Team B
   */
  public rallyWonBy(winner: 'teamA' | 'teamB'): void {
    if (this.isMatchComplete()) {
      return; // Match already finished
    }

    if (this.rules.scoringFormat === 'rally') {
      this.handleRallyScoring(winner);
    } else {
      this.handleSideoutScoring(winner);
    }
  }

  /**
   * Traditional Side-Out scoring logic
   */
  private handleSideoutScoring(winner: 'teamA' | 'teamB'): void {
    const isServingTeamWinner = winner === this.state.servingTeam;
    const isDoubles = this.rules.format === 'doubles';

    if (isServingTeamWinner) {
      // Serving team scores a point!
      if (winner === 'teamA') {
        this.state.scoreA += 1;
      } else {
        this.state.scoreB += 1;
      }

      // In pickleball, when serving team scores, the servers switch court sides (right <-> left)
      const currentTeamPositions = this.state.positions[winner];
      const prevRight = currentTeamPositions.rightPlayerIndex;
      currentTeamPositions.rightPlayerIndex = currentTeamPositions.leftPlayerIndex;
      currentTeamPositions.leftPlayerIndex = prevRight;

      // Serving side alternates
      this.state.servingSide = this.state.servingSide === 'right' ? 'left' : 'right';

      // Update score call
      this.state.scoreCall = this.generateScoreCall(
        this.state.scoreA,
        this.state.scoreB,
        this.state.servingTeam,
        this.state.serverNumber
      );

      this.recordSnapshot(`Point for ${winner === 'teamA' ? 'Team A' : 'Team B'} (${this.state.scoreCall})`);
    } else {
      // Receiving team won the rally -> Fault on the serving team!
      if (isDoubles) {
        if (this.state.serverNumber === 1) {
          // Switch to Server 2 on the same team
          this.state.serverNumber = 2;

          // The second server serves from their current court side
          // Identify which player is Server 2 (the other player)
          const servingPositions = this.state.positions[this.state.servingTeam];
          // Determine who serves next
          if (this.state.servingPlayerIndex === servingPositions.rightPlayerIndex) {
            this.state.servingPlayerIndex = servingPositions.leftPlayerIndex;
            this.state.servingSide = 'left';
          } else {
            this.state.servingPlayerIndex = servingPositions.rightPlayerIndex;
            this.state.servingSide = 'right';
          }

          this.state.scoreCall = this.generateScoreCall(
            this.state.scoreA,
            this.state.scoreB,
            this.state.servingTeam,
            2
          );

          this.recordSnapshot(`Fault - Second Server (${this.state.scoreCall})`);
        } else {
          // Second server fault -> SIDEOUT!
          this.triggerSideout();
        }
      } else {
        // Singles: any fault is an immediate Sideout!
        this.triggerSideout();
      }
    }
  }

  /**
   * Rally scoring logic
   */
  private handleRallyScoring(winner: 'teamA' | 'teamB'): void {
    // In rally scoring, a point is awarded on every rally
    if (winner === 'teamA') {
      this.state.scoreA += 1;
    } else {
      this.state.scoreB += 1;
    }

    if (winner === this.state.servingTeam) {
      // Serving team scored -> switch sides
      const teamPositions = this.state.positions[winner];
      const prevRight = teamPositions.rightPlayerIndex;
      teamPositions.rightPlayerIndex = teamPositions.leftPlayerIndex;
      teamPositions.leftPlayerIndex = prevRight;

      this.state.servingSide = this.state.servingSide === 'right' ? 'left' : 'right';
      this.state.scoreCall = this.generateScoreCall(
        this.state.scoreA,
        this.state.scoreB,
        this.state.servingTeam,
        1
      );
      this.recordSnapshot(`Point for ${winner === 'teamA' ? 'Team A' : 'Team B'} (${this.state.scoreCall})`);
    } else {
      // Receiving team scored -> Sideout to receiving team!
      this.state.servingTeam = winner;
      this.state.serverNumber = 1;

      // Serving court based on receiving team's new score: Even = Right, Odd = Left
      const winnerScore = winner === 'teamA' ? this.state.scoreA : this.state.scoreB;
      const isEven = winnerScore % 2 === 0;
      this.state.servingSide = isEven ? 'right' : 'left';

      const teamPositions = this.state.positions[winner];
      this.state.servingPlayerIndex = isEven
        ? teamPositions.rightPlayerIndex
        : teamPositions.leftPlayerIndex;

      this.state.scoreCall = this.generateScoreCall(
        this.state.scoreA,
        this.state.scoreB,
        this.state.servingTeam,
        1
      );
      this.recordSnapshot(`Point & Sideout to ${winner === 'teamA' ? 'Team A' : 'Team B'} (${this.state.scoreCall})`);
    }
  }

  /**
   * Handle Side-out transition in traditional scoring
   */
  private triggerSideout(): void {
    const newServingTeam: 'teamA' | 'teamB' =
      this.state.servingTeam === 'teamA' ? 'teamB' : 'teamA';

    this.state.servingTeam = newServingTeam;
    this.state.serverNumber = 1;

    const newServingScore =
      newServingTeam === 'teamA' ? this.state.scoreA : this.state.scoreB;

    if (this.rules.format === 'singles') {
      // In singles: Even score = right court, Odd score = left court
      const isEven = newServingScore % 2 === 0;
      this.state.servingSide = isEven ? 'right' : 'left';
      this.state.servingPlayerIndex = 0;
    } else {
      // In doubles: The first server of the new serving turn serves from the right court
      // if their score is even, or from left if odd, according to standard starting positions
      const isEven = newServingScore % 2 === 0;
      this.state.servingSide = isEven ? 'right' : 'left';

      const positions = this.state.positions[newServingTeam];
      this.state.servingPlayerIndex = isEven
        ? positions.rightPlayerIndex
        : positions.leftPlayerIndex;
    }

    this.state.scoreCall = this.generateScoreCall(
      this.state.scoreA,
      this.state.scoreB,
      this.state.servingTeam,
      this.state.serverNumber
    );

    this.recordSnapshot(`Side-out to ${newServingTeam === 'teamA' ? 'Team A' : 'Team B'} (${this.state.scoreCall})`);
  }

  /**
   * Infallible Undo: pops previous state from history and restores it
   */
  public undo(): boolean {
    if (this.history.length <= 1) {
      return false; // Cannot undo past initial state
    }

    this.history.pop(); // Remove current state
    const previous = this.history[this.history.length - 1];
    this.state = JSON.parse(JSON.stringify(previous.state));
    return true;
  }

  /**
   * Check if match is won according to target score and win condition
   */
  public isMatchComplete(): boolean {
    return isMatchWon(
      this.state.scoreA,
      this.state.scoreB,
      this.rules.targetScore,
      this.rules.winCondition
    );
  }

  public getWinningTeam(): 'teamA' | 'teamB' | null {
    if (!this.isMatchComplete()) return null;
    return this.state.scoreA > this.state.scoreB ? 'teamA' : 'teamB';
  }
}

/**
 * Pure helper function to determine if a score qualifies as a win
 */
export function isMatchWon(
  scoreA: number,
  scoreB: number,
  targetScore: number,
  winCondition: WinCondition
): boolean {
  const maxScore = Math.max(scoreA, scoreB);
  const diff = Math.abs(scoreA - scoreB);

  if (maxScore < targetScore) {
    return false;
  }

  if (winCondition === 'win_by_2') {
    return diff >= 2;
  }

  // win_by_1
  return diff >= 1;
}

/**
 * Validate manually entered score
 */
export function validateManualScore(
  scoreA: number,
  scoreB: number,
  targetScore: number,
  winCondition: WinCondition
): { isValid: boolean; message?: string; winner?: 'teamA' | 'teamB' } {
  if (isNaN(scoreA) || isNaN(scoreB) || scoreA < 0 || scoreB < 0) {
    return { isValid: false, message: 'Scores must be valid non-negative numbers.' };
  }

  if (scoreA === scoreB) {
    return { isValid: false, message: 'Pickleball matches cannot end in a tie.' };
  }

  const won = isMatchWon(scoreA, scoreB, targetScore, winCondition);
  const winner = scoreA > scoreB ? 'teamA' : 'teamB';

  if (!won) {
    const requiredDiff = winCondition === 'win_by_2' ? 2 : 1;
    return {
      isValid: false,
      message: `Score does not meet win condition (Target: ${targetScore}, Lead required: ${requiredDiff} pts).`,
      winner,
    };
  }

  return { isValid: true, winner };
}
