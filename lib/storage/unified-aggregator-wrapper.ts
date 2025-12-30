// /lib/storage/unified-aggregator-wrapper.ts
// Wrapper module to provide consistent exports for unified-aggregator

import ClientSafeUnifiedAggregator from './client-safe-unified-aggregator';

// Named exports for consistency - these are static methods of the ClientSafeUnifiedAggregator class
// Use wrapper functions to preserve the 'this' context
export const getWeeklyStats = (userId: string, date?: Date) => ClientSafeUnifiedAggregator.getWeeklyStats(userId, date);
export const getDailyStats = (userId: string, date?: Date) => ClientSafeUnifiedAggregator.getDailyStats(userId, date);
export const getMonthlyStats = (userId: string, date?: Date) => ClientSafeUnifiedAggregator.getMonthlyStats(userId, date);
export const getInsightsData = (userId: string) => ClientSafeUnifiedAggregator.getInsightsData(userId);
export const getSummaryStats = (userId: string) => ClientSafeUnifiedAggregator.getSummaryStats(userId);
export const getAdaptiveGoals = (userId: string, date?: Date) => ClientSafeUnifiedAggregator.getAdaptiveGoals(userId, date);

// Default export
export default ClientSafeUnifiedAggregator;