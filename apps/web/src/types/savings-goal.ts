export type SavingsGoalStatus = "ACTIVE" | "COMPLETED" | "ABANDONED";

export interface GoalProgress {
  savedSoFar: number;
  remainingAmount: number;
  progressPercent: number;
  monthlyContributionNeeded: number | null;
  expectedSavedByNow: number;
  deviation: number;
  isOnTrack: boolean;
  projectedCompletionDate: string | null;
  isComplete: boolean;
}

export interface SavingsGoal {
  id: string;
  userId: string;
  accountId: string | null;
  name: string;
  targetAmount: string;
  initialAmount: string;
  currentAmount: string;
  startDate: string;
  targetDate: string;
  status: SavingsGoalStatus;
  createdAt: string;
  updatedAt: string;
  progress: GoalProgress;
}

export interface SavingsGoalInput {
  name: string;
  targetAmount: number;
  initialAmount?: number;
  startDate?: string;
  targetDate: string;
  accountId?: string;
}

export interface UpdateSavingsGoalInput {
  name?: string;
  targetAmount?: number;
  targetDate?: string;
  accountId?: string | null;
  currentAmount?: number;
  status?: SavingsGoalStatus;
}
