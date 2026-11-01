export const SKILL_LEVELS = [
  'Newbie / 2.0',
  '2.25',
  '2.5',
  '2.75',
  '3.0',
  '3.25',
  '3.5',
  '3.75',
  '4.0',
  '4.25',
  '4.5',
  '4.75',
  '5.0+',
] as const;

export type SkillLevel = (typeof SKILL_LEVELS)[number];

export function parseSkillLevelNumber(level?: string): number {
  if (!level) return 3.0;
  if (level.includes('2.0') || level.toLowerCase().includes('newbie')) return 2.0;
  if (level.includes('5.0')) return 5.0;
  const num = parseFloat(level);
  return isNaN(num) ? 3.0 : num;
}

export interface RatingAdjustmentInput {
  teamARatings: number[];
  teamBRatings: number[];
  scoreA: number;
  scoreB: number;
  winningTeam: 'teamA' | 'teamB';
}

export interface RatingAdjustmentResult {
  deltaA: number; // e.g. +0.08
  deltaB: number; // e.g. -0.08
  newTeamARatings: number[];
  newTeamBRatings: number[];
}

/**
 * Calculates dynamic rating adjustments inspired by DUPR / Elo rating systems.
 * - Factors in rating difference between teams (expected outcome).
 * - Factors in score margin / point differential (blowout vs close match).
 * - Bounded between 1.50 and 8.00.
 */
export function calculateMatchRatingAdjustments({
  teamARatings,
  teamBRatings,
  scoreA,
  scoreB,
  winningTeam,
}: RatingAdjustmentInput): RatingAdjustmentResult {
  const avgA =
    teamARatings.reduce((sum, r) => sum + r, 0) / (teamARatings.length || 1);
  const avgB =
    teamBRatings.reduce((sum, r) => sum + r, 0) / (teamBRatings.length || 1);

  // Expected score for Team A based on logistic curve (scaled for 1.0 rating spread)
  // In pickleball, a 1.0 rating gap represents a very high likelihood of winning.
  const ratingDiff = avgB - avgA;
  const expectedA = 1 / (1 + Math.pow(10, ratingDiff / 1.5));
  const actualA = winningTeam === 'teamA' ? 1.0 : 0.0;

  // Point differential multiplier (winning 11-2 gives more credit than 11-9)
  const totalPoints = Math.max(1, scoreA + scoreB);
  const pointMargin = Math.abs(scoreA - scoreB);
  const marginFactor = 0.5 + (pointMargin / totalPoints) * 0.5; // range: ~0.5 to 1.0

  // Base K-factor in DUPR rating scale (e.g. ~0.15 max shift per match)
  const K = 0.16;

  // Calculate delta for Team A
  const deltaA = parseFloat(
    ((actualA - expectedA) * K * marginFactor).toFixed(3)
  );
  const deltaB = parseFloat((-deltaA).toFixed(3));

  const clamp = (val: number) => Math.max(1.5, Math.min(8.0, parseFloat(val.toFixed(2))));

  return {
    deltaA,
    deltaB,
    newTeamARatings: teamARatings.map((r) => clamp(r + deltaA)),
    newTeamBRatings: teamBRatings.map((r) => clamp(r + deltaB)),
  };
}
