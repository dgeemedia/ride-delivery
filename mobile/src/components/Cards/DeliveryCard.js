import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing } from '../../theme';

const DeliveryCard = ({ delivery, onPress }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING':
        return colors.warning;
      case 'ASSIGNED':
      case 'PICKED_UP':
        return colors.info;
      case 'IN_TRANSIT':
        return colors.primary;
      case 'DELIVERED':
        return colors.success;
      case 'CANCELLED':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING':
        return 'schedule';
      case 'ASSIGNED':
        return 'assignment-ind';
      case 'PICKED_UP':
        return 'shopping-bag';
      case 'IN_TRANSIT':
        return 'local-shipping';
      case 'DELIVERED':
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
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(delivery.status) }]}>
          <Icon name={getStatusIcon(delivery.status)} size={16} color="#fff" />
          <Text style={styles.statusText}>{delivery.status}</Text>
        </View>
        <Text style={styles.date}>
          {new Date(delivery.requestedAt).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.packageInfo}>
        <Icon name="inventory" size={20} color={colors.primary} />
        <View style={styles.packageDetails}>
          <Text style={styles.packageDescription} numberOfLines={1}>
            {delivery.packageDescription}
          </Text>
          {delivery.packageWeight && (
            <Text style={styles.packageWeight}>
              Weight: {delivery.packageWeight} kg
            </Text>
          )}
        </View>
      </View>

      <View style={styles.locationContainer}>
        <View style={styles.locationRow}>
          <Icon name="radio-button-checked" size={18} color={colors.primary} />
          <View style={styles.locationDetails}>
            <Text style={styles.locationLabel}>Pickup</Text>
            <Text style={styles.addressText} numberOfLines={1}>
              {delivery.pickupAddress}
            </Text>
            <Text style={styles.contactText}>{delivery.pickupContact}</Text>
          </View>
        </View>

        <View style={styles.routeLine} />

        <View style={styles.locationRow}>
          <Icon name="location-on" size={18} color={colors.error} />
          <View style={styles.locationDetails}>
            <Text style={styles.locationLabel}>Dropoff</Text>
            <Text style={styles.addressText} numberOfLines={1}>
              {delivery.dropoffAddress}
            </Text>
            <Text style={styles.contactText}>{delivery.dropoffContact}</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.infoItem}>
          <Icon name="straighten" size={18} color={colors.textSecondary} />
          <Text style={styles.infoText}>{delivery.distance?.toFixed(1)} km</Text>
        </View>

        {delivery.actualFee && (
          <View style={styles.feeContainer}>
            <Text style={styles.feeLabel}>Fee:</Text>
            <Text style={styles.feeAmount}>${delivery.actualFee.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {delivery.partner && (
        <View style={styles.partnerInfo}>
          <Icon name="delivery-dining" size={18} color={colors.textSecondary} />
          <Text style={styles.partnerName}>
            {delivery.partner.firstName} {delivery.partner.lastName}
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
  packageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.backgroundLight,
    borderRadius: 8,
  },
  packageDetails: {
    flex: 1,
  },
  packageDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  packageWeight: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  locationContainer: {
    marginBottom: spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  locationDetails: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  addressText: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  contactText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: colors.border,
    marginLeft: 8,
    marginVertical: 4,
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
  feeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feeLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  feeAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  partnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  partnerName: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});

export default DeliveryCard;