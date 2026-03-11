// mobile/src/components/Cards/DriverCard.js
import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, spacing, radius} from '../../theme';

const DriverCard = ({driver}) => {
  if (!driver) return null;
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {driver.firstName?.[0]}{driver.lastName?.[0]}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>
          {driver.firstName} {driver.lastName}
        </Text>
        {driver.driverProfile?.vehicleModel ? (
          <Text style={styles.vehicle}>
            {driver.driverProfile.vehicleModel} · {driver.driverProfile.vehiclePlate}
          </Text>
        ) : null}
      </View>
      {driver.driverProfile?.rating ? (
        <View style={styles.rating}>
          <Text style={styles.star}>⭐</Text>
          <Text style={styles.ratingText}>
            {Number(driver.driverProfile.rating).toFixed(1)}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {color: '#fff', fontWeight: '700', fontSize: 16},
  info: {flex: 1},
  name: {fontSize: 16, fontWeight: '600', color: colors.textPrimary},
  vehicle: {fontSize: 13, color: colors.textSecondary, marginTop: 2},
  rating: {flexDirection: 'row', alignItems: 'center'},
  star: {fontSize: 14},
  ratingText: {fontSize: 14, fontWeight: '600', marginLeft: 4},
});

export default DriverCard;