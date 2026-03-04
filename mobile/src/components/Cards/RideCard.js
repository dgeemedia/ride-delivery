import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing } from '../../theme';

const RideCard = ({ ride, onPress }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'REQUESTED':
        return colors.warning;
      case 'ACCEPTED':
      case 'ARRIVED':
        return colors.info;
      case 'IN_PROGRESS':
        return colors.primary;
      case 'COMPLETED':
        return colors.success;
      case 'CANCELLED':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'REQUESTED':
        return 'schedule';
      case 'ACCEPTED':
        return 'check-circle';
      case 'IN_PROGRESS':
        return 'directions-car';
      case 'COMPLETED':
        return 'done-all';
      case 'CANCELLED':
        return 'cancel';
      default:
        return 'info';
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ride.status) }]}>
          <Icon name={getStatusIcon(ride.status)} size={16} color="#fff" />
          <Text style={styles.statusText}>{ride.status}</Text>
        </View>
        <Text style={styles.date}>
          {new Date(ride.requestedAt).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.locationContainer}>
        <View style={styles.locationRow}>
          <Icon name="radio-button-checked" size={20} color={colors.primary} />
          <Text style={styles.addressText} numberOfLines={1}>
            {ride.pickupAddress}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.locationRow}>
          <Icon name="location-on" size={20} color={colors.error} />
          <Text style={styles.addressText} numberOfLines={1}>
            {ride.dropoffAddress}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.infoItem}>
          <Icon name="straighten" size={18} color={colors.textSecondary} />
          <Text style={styles.infoText}>{ride.distance?.toFixed(1)} km</Text>
        </View>

        {ride.actualFare && (
          <View style={styles.fareContainer}>
            <Text style={styles.fareLabel}>Fare:</Text>
            <Text style={styles.fareAmount}>${ride.actualFare.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {ride.driver && (
        <View style={styles.driverInfo}>
          <Icon name="person" size={18} color={colors.textSecondary} />
          <Text style={styles.driverName}>
            {ride.driver.firstName} {ride.driver.lastName}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  locationContainer: {
    marginBottom: spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  divider: {
    width: 2,
    height: 20,
    backgroundColor: colors.border,
    marginLeft: 9,
    marginVertical: 2,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  fareContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fareLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  fareAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  driverName: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});

export default RideCard;