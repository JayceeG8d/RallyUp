import { describe, it, expect } from 'vitest';
import {
  parseSkillLevelNumber,
  calculateMatchRatingAdjustments,
  SKILL_LEVELS,
} from '../ratingEngine';

describe('Rating Engine (DUPR-style Dynamic Rating)', () => {
  it('correctly parses skill levels to initial numbers', () => {
    expect(parseSkillLevelNumber('Newbie / 2.0')).toBe(2.0);
    expect(parseSkillLevelNumber('2.5')).toBe(2.5);
    expect(parseSkillLevelNumber('3.25')).toBe(3.25);
    expect(parseSkillLevelNumber('3.75')).toBe(3.75);
    expect(parseSkillLevelNumber('5.0+')).toBe(5.0);
    expect(parseSkillLevelNumber(undefined)).toBe(3.0);
  });

  it('increases rating for winning team and decreases for losing team', () => {
    const result = calculateMatchRatingAdjustments({
      teamARatings: [3.5, 3.5],
      teamBRatings: [3.5, 3.5],
      scoreA: 11,
      scoreB: 9,
      winningTeam: 'teamA',
    });

    expect(result.deltaA).toBeGreaterThan(0);
    expect(result.deltaB).toBeLessThan(0);
    expect(result.newTeamARatings[0]).toBeGreaterThan(3.5);
    expect(result.newTeamBRatings[0]).toBeLessThan(3.5);
  });

  it('awards a bigger rating gain for blowout wins than close games', () => {
    const blowout = calculateMatchRatingAdjustments({
      teamARatings: [3.5, 3.5],
      teamBRatings: [3.5, 3.5],
      scoreA: 11,
      scoreB: 1,
      winningTeam: 'teamA',
    });

    const closeMatch = calculateMatchRatingAdjustments({
      teamARatings: [3.5, 3.5],
      teamBRatings: [3.5, 3.5],
      scoreA: 12,
      scoreB: 10,
      winningTeam: 'teamA',
    });

    expect(blowout.deltaA).toBeGreaterThan(closeMatch.deltaA);
  });

  it('awards a higher gain when an underdog wins an upset', () => {
    // Underdogs (3.0s) beat favorites (4.0s)
    const upset = calculateMatchRatingAdjustments({
      teamARatings: [3.0, 3.0],
      teamBRatings: [4.0, 4.0],
      scoreA: 11,
      scoreB: 8,
      winningTeam: 'teamA',
    });

    // Favorites (4.0s) beat underdogs (3.0s)
    const expectedWin = calculateMatchRatingAdjustments({
      teamARatings: [4.0, 4.0],
      teamBRatings: [3.0, 3.0],
      scoreA: 11,
      scoreB: 8,
      winningTeam: 'teamA',
    });

    expect(upset.deltaA).toBeGreaterThan(expectedWin.deltaA);
  });
});
