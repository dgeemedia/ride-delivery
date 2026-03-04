import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useRide } from '../../context/RideContext';
import DriverCard from '../../components/Cards/DriverCard';
import Button from '../../components/Common/Button';
import { colors, spacing } from '../../theme';

const TrackingScreen = ({ navigation }) => {
  const { activeRide, driverLocation, cancelRide } = useRide();

  useEffect(() => {
    if (!activeRide) {
      navigation.goBack();
    }
  }, [activeRide]);

  const handleCancel = () => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            await cancelRide(activeRide.id);
            navigation.navigate('Home');
          },
        },
      ]
    );
  };

  if (!activeRide) return null;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: activeRide.pickupLat,
          longitude: activeRide.pickupLng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker
          coordinate={{
            latitude: activeRide.pickupLat,
            longitude: activeRide.pickupLng,
          }}
          title="Pickup"
          pinColor={colors.primary}
        />
        <Marker
          coordinate={{
            latitude: activeRide.dropoffLat,
            longitude: activeRide.dropoffLng,
          }}
          title="Dropoff"
          pinColor={colors.error}
        />
        {driverLocation && (
          <Marker coordinate={driverLocation} title="Driver" />
        )}
      </MapView>

      <View style={styles.bottomSheet}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{activeRide.status}</Text>
        </View>

        {activeRide.driver && <DriverCard driver={activeRide.driver} />}

        <View style={styles.routeInfo}>
          <Text style={styles.routeLabel}>Pickup</Text>
          <Text style={styles.routeAddress}>{activeRide.pickupAddress}</Text>
          <Text style={styles.routeLabel}>Dropoff</Text>
          <Text style={styles.routeAddress}>{activeRide.dropoffAddress}</Text>
        </View>

        {activeRide.status === 'REQUESTED' && (
          <Button
            title="Cancel Ride"
            variant="danger"
            onPress={handleCancel}
            fullWidth
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    maxHeight: '60%',
  },
  statusBadge: {
    backgroundColor: colors.primary,
    padding: spacing.sm,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
  },
  routeInfo: {
    marginVertical: spacing.md,
  },
  routeLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  routeAddress: {
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
  },
});

export default TrackingScreen;