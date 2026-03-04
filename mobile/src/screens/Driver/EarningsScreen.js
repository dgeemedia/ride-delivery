import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { driverAPI } from '../../services/api';
import { colors, spacing } from '../../theme';
import { formatCurrency } from '../../utils/helpers';

const EarningsScreen = () => {
  const [earnings, setEarnings] = useState(null);
  const [period, setPeriod] = useState('week');

  useEffect(() => {
    loadEarnings();
  }, [period]);

  const loadEarnings = async () => {
    try {
      const response = await driverAPI.getEarnings({ period });
      setEarnings(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  if (!earnings) return null;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Earnings</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Earnings</Text>
        <Text style={styles.summaryAmount}>
          {formatCurrency(earnings.totalEarnings)}
        </Text>
        <Text style={styles.summaryDetails}>
          {earnings.totalRides} rides • {period}
        </Text>
      </View>

      <View style={styles.breakdown}>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Gross Earnings</Text>
          <Text style={styles.breakdownValue}>
            {formatCurrency(earnings.totalEarnings)}
          </Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Platform Fee (20%)</Text>
          <Text style={[styles.breakdownValue, styles.negative]}>
            -{formatCurrency(earnings.platformFee)}
          </Text>
        </View>
        <View style={[styles.breakdownRow, styles.total]}>
          <Text style={styles.totalLabel}>Net Earnings</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(earnings.netEarnings)}
          </Text>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{earnings.totalRides}</Text>
          <Text style={styles.statLabel}>Total Rides</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {formatCurrency(earnings.averagePerRide)}
          </Text>
          <Text style={styles.statLabel}>Avg per Ride</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  summaryLabel: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  summaryAmount: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
    marginVertical: spacing.sm,
  },
  summaryDetails: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  breakdown: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  breakdownLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  negative: {
    color: colors.error,
  },
  total: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.success,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default EarningsScreen;