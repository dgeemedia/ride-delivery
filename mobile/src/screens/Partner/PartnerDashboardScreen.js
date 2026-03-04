import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { partnerAPI } from '../../services/api';
import socketService from '../../services/socket';
import Button from '../../components/Common/Button';
import { colors, spacing } from '../../theme';

const PartnerDashboardScreen = ({ navigation }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadStats();
    socketService.connect();
  }, []);

  const loadStats = async () => {
    try {
      const response = await partnerAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleOnlineStatus = async (value) => {
    try {
      await partnerAPI.updateStatus({ isOnline: value });
      if (value) {
        socketService.goOnlinePartner({ latitude: 0, longitude: 0 });
      } else {
        socketService.goOffline();
      }
      setIsOnline(value);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Delivery Partner</Text>
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
          <Switch value={isOnline} onValueChange={toggleOnlineStatus} />
        </View>
      </View>

      {stats && (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalDeliveries}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.rating}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.completionRate}%</Text>
            <Text style={styles.statLabel}>Completion</Text>
          </View>
        </View>
      )}

      {isOnline && (
        <Button
          title="View Nearby Requests"
          onPress={() => navigation.navigate('IncomingDelivery')}
          fullWidth
          icon="local-shipping"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default PartnerDashboardScreen;