import type { StageType } from './order';

export interface ServicePackage {
  id: string;
  name: string;
  level: 'undergraduate' | 'master' | 'phd';
  description: string;
  basePrice: number;
  depositRatio: number;
  includedStages: StageType[];
  revisionRoundsLimit: number;
  estimatedDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

