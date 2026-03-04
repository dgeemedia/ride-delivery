import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useDelivery } from '../../context/DeliveryContext';
import { useLocation } from '../../context/LocationContext';
import Button from '../../components/Common/Button';
import { colors, spacing } from '../../theme';
import socketService from '../../services/socket';

const ActiveDeliveryScreen = ({ navigation }) => {
  const { activeDelivery, pickupDelivery, startTransit } = useDelivery();
  const { location } = useLocation();

  useEffect(() => {
    if (location && activeDelivery) {
      socketService.updatePartnerLocation(location);
    }
  }, [location]);

  const handlePickup = async () => {
    try {
      await pickupDelivery(activeDelivery.id);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleStartTransit = async () => {
    try {
      await startTransit(activeDelivery.id);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleComplete = () => {
    navigation.navigate('ProofOfDelivery');
  };

  if (!activeDelivery) {
    navigation.goBack();
    return null;
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: activeDelivery.pickupLat,
          longitude: activeDelivery.pickupLng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
      >
        <Marker
          coordinate={{
            latitude: activeDelivery.pickupLat,
            longitude: activeDelivery.pickupLng,
          }}
          title="Pickup"
        />
        <Marker
          coordinate={{
            latitude: activeDelivery.dropoffLat,
            longitude: activeDelivery.dropoffLng,
          }}
          title="Dropoff"
        />
      </MapView>

      <View style={styles.bottomSheet}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{activeDelivery.status}</Text>
        </View>

        <View style={styles.packageInfo}>
          <Text style={styles.packageLabel}>Package:</Text>
          <Text style={styles.packageDescription}>
            {activeDelivery.packageDescription}
          </Text>
        </View>

        <View style={styles.addressInfo}>
          <Text style={styles.label}>Pickup</Text>
          <Text style={styles.address}>{activeDelivery.pickupAddress}</Text>
          <Text style={styles.contact}>{activeDelivery.pickupContact}</Text>

          <Text style={[styles.label, { marginTop: spacing.md }]}>Dropoff</Text>
          <Text style={styles.address}>{activeDelivery.dropoffAddress}</Text>
          <Text style={styles.contact}>{activeDelivery.dropoffContact}</Text>
        </View>

        {activeDelivery.status === 'ASSIGNED' && (
          <Button title="Confirm Pickup" onPress={handlePickup} fullWidth />
        )}

        {activeDelivery.status === 'PICKED_UP' && (
          <Button title="Start Transit" onPress={handleStartTransit} fullWidth />
        )}

        {activeDelivery.status === 'IN_TRANSIT' && (
          <Button title="Complete Delivery" onPress={handleComplete} fullWidth />
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
    maxHeight: '70%',
  },
  statusBadge: {
    backgroundColor: colors.warning,
    padding: spacing.sm,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  packageInfo: {
    backgroundColor: colors.backgroundLight,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  packageLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  packageDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  addressInfo: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  contact: {
    fontSize: 12,
    color: colors.primary,
  },
});

export default ActiveDeliveryScreen;