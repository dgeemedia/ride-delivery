import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, FlatList, TouchableOpacity} from 'react-native';
import {rideAPI} from '../../services/api';
import {colors} from '../../theme/colors';
import {spacing} from '../../theme/spacing';

const HistoryScreen = () => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await rideAPI.getRideHistory();
      setRides(response.data.rides || []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderRide = ({item}) => (
    <TouchableOpacity style={styles.rideCard}>
      <View style={styles.rideHeader}>
        <Text style={styles.rideDate}>
          {new Date(item.completedAt).toLocaleDateString()}
        </Text>
        <Text style={[styles.rideStatus, {color: getStatusColor(item.status)}]}>
          {item.status}
        </Text>
      </View>
      <Text style={styles.rideAddress}>{item.pickupAddress}</Text>
      <Text style={styles.rideAddress}>↓</Text>
      <Text style={styles.rideAddress}>{item.dropoffAddress}</Text>
      <Text style={styles.rideFare}>₦{item.actualFare?.toFixed(2)}</Text>
    </TouchableOpacity>
  );

  const getStatusColor = (status) => {
    return status === 'COMPLETED' ? colors.success : colors.error;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rides}
        renderItem={renderRide}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No ride history yet</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: spacing.lg,
  },
  rideCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  rideDate: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  rideStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  rideAddress: {
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 4,
  },
  rideFare: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
});

export default HistoryScreen;