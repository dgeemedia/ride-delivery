import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useRide } from '../../context/RideContext';
import { useLocation } from '../../context/LocationContext';
import Button from '../../components/Common/Button';
import { colors, spacing } from '../../theme';
import socketService from '../../services/socket';

const ActiveRideScreen = ({ navigation }) => {
  const { activeRide, startRide, completeRide } = useRide();
  const { location } = useLocation();

  useEffect(() => {
    if (location && activeRide) {
      socketService.updateDriverLocation(location);
    }
  }, [location]);

  const handleStart = async () => {
    try {
      await startRide(activeRide.id);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleComplete = async () => {
    try {
      await completeRide(activeRide.id, activeRide.estimatedFare);
      navigation.navigate('Dashboard');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  if (!activeRide) {
    navigation.goBack();
    return null;
  }

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
        showsUserLocation
      >
        <Marker
          coordinate={{
            latitude: activeRide.pickupLat,
            longitude: activeRide.pickupLng,
          }}
          title="Pickup"
        />
        <Marker
          coordinate={{
            latitude: activeRide.dropoffLat,
            longitude: activeRide.dropoffLng,
          }}
          title="Dropoff"
        />
      </MapView>

      <View style={styles.bottomSheet}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>
            {activeRide.customer.firstName} {activeRide.customer.lastName}
          </Text>
          <Text style={styles.customerPhone}>{activeRide.customer.phone}</Text>
        </View>

        <View style={styles.addressInfo}>
          <Text style={styles.label}>Pickup</Text>
          <Text style={styles.address}>{activeRide.pickupAddress}</Text>
          <Text style={styles.label}>Dropoff</Text>
          <Text style={styles.address}>{activeRide.dropoffAddress}</Text>
        </View>

        {activeRide.status === 'ACCEPTED' && (
          <Button title="Start Ride" onPress={handleStart} fullWidth />
        )}

        {activeRide.status === 'IN_PROGRESS' && (
          <Button title="Complete Ride" onPress={handleComplete} fullWidth />
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
  },
  customerInfo: {
    marginBottom: spacing.md,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  customerPhone: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  addressInfo: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  address: {
    fontSize: 14,
    color: colors.textPrimary,
  },
});

export default ActiveRideScreen;