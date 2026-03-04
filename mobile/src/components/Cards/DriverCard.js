import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing } from '../../theme';

const DriverCard = ({ driver }) => {
  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Icon key={i} name="star" size={16} color={colors.warning} />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Icon key={i} name="star-half" size={16} color={colors.warning} />);
      } else {
        stars.push(<Icon key={i} name="star-border" size={16} color={colors.border} />);
      }
    }

    return stars;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.driverInfo}>
          {driver.profileImage ? (
            <Image source={{ uri: driver.profileImage }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Icon name="person" size={32} color={colors.textSecondary} />
            </View>
          )}

          <View style={styles.details}>
            <Text style={styles.name}>
              {driver.firstName} {driver.lastName}
            </Text>
            
            {driver.driverProfile && (
              <>
                <View style={styles.ratingContainer}>
                  <View style={styles.stars}>
                    {renderStars(driver.driverProfile.rating)}
                  </View>
                  <Text style={styles.ratingText}>
                    {driver.driverProfile.rating.toFixed(1)}
                  </Text>
                </View>

                <View style={styles.vehicleInfo}>
                  <Icon name="directions-car" size={16} color={colors.textSecondary} />
                  <Text style={styles.vehicleText}>
                    {driver.driverProfile.vehicleColor} {driver.driverProfile.vehicleMake} {driver.driverProfile.vehicleModel}
                  </Text>
                </View>

                <View style={styles.plateContainer}>
                  <View style={styles.plate}>
                    <Text style={styles.plateText}>{driver.driverProfile.vehiclePlate}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </View>

      {driver.driverProfile && (
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Icon name="local-taxi" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{driver.driverProfile.totalRides}</Text>
            <Text style={styles.statLabel}>Rides</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Icon name="verified" size={20} color={colors.success} />
            <Text style={styles.statLabel}>Verified Driver</Text>
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <View style={styles.actionButton}>
          <Icon name="phone" size={20} color={colors.primary} />
          <Text style={styles.actionText}>Call</Text>
        </View>
        <View style={styles.actionDivider} />
        <View style={styles.actionButton}>
          <Icon name="message" size={20} color={colors.primary} />
          <Text style={styles.actionText}>Message</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: spacing.md,
  },
  driverInfo: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    backgroundColor: colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  details: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  vehicleText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  plateContainer: {
    marginTop: 4,
  },
  plate: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  plateText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  stats: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  actionDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});

export default DriverCard;