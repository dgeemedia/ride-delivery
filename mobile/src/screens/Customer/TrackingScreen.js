// mobile/src/screens/Customer/TrackingScreen.js
import React, {useEffect} from 'react';
import {View, Text, StyleSheet, Alert, ScrollView} from 'react-native';
import MapView, {Marker} from 'react-native-maps'; // resolved by Metro mock on web
import {useRide} from '../../context/RideContext';
import {useDelivery} from '../../context/DeliveryContext';
import DriverCard from '../../components/Cards/DriverCard';
import Button from '../../components/Common/Button';
import {colors, spacing, radius} from '../../theme';
import {getStatusColor} from '../../utils/formatters';

const TrackingScreen = ({navigation}) => {
  const {activeRide, driverLocation, cancelRide} = useRide();
  const {activeDelivery, partnerLocation} = useDelivery();

  const active = activeRide || activeDelivery;
  const isRide = !!activeRide;

  useEffect(() => {
    if (!active) navigation.goBack();
  }, [active]);

  if (!active) return null;

  const pickupLat = active.pickupLat ?? 6.5244;
  const pickupLng = active.pickupLng ?? 3.3792;
  const dropoffLat = active.dropoffLat ?? 6.53;
  const dropoffLng = active.dropoffLng ?? 3.39;

  const handleCancel = () => {
    Alert.alert('Cancel', `Cancel this ${isRide ? 'ride' : 'delivery'}?`, [
      {text: 'No', style: 'cancel'},
      {
        text: 'Yes',
        onPress: async () => {
          if (isRide) await cancelRide(activeRide.id);
          navigation.navigate('Home');
        },
      },
    ]);
  };

  const moverLocation = isRide ? driverLocation : partnerLocation;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: pickupLat,
          longitude: pickupLng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}>
        <Marker coordinate={{latitude: pickupLat, longitude: pickupLng}} title="Pickup" pinColor={colors.primary} />
        <Marker coordinate={{latitude: dropoffLat, longitude: dropoffLng}} title="Dropoff" pinColor={colors.error} />
        {moverLocation && (
          <Marker coordinate={moverLocation} title={isRide ? 'Driver' : 'Partner'} />
        )}
      </MapView>

      <View style={styles.sheet}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={[styles.badge, {backgroundColor: getStatusColor(active.status)}]}>
            <Text style={styles.badgeText}>{active.status}</Text>
          </View>

          {activeRide?.driver && <DriverCard driver={activeRide.driver} />}

          <View style={styles.route}>
            <Text style={styles.routeLabel}>Pickup</Text>
            <Text style={styles.routeAddr}>{active.pickupAddress}</Text>
            <Text style={styles.routeLabel}>Dropoff</Text>
            <Text style={styles.routeAddr}>{active.dropoffAddress}</Text>
          </View>

          {active.status === 'REQUESTED' && (
            <Button title={`Cancel ${isRide ? 'Ride' : 'Delivery'}`} variant="danger" onPress={handleCancel} fullWidth />
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  map: {flex: 1},
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.lg, maxHeight: '55%',
  },
  badge: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.full, alignSelf: 'flex-start', marginBottom: spacing.md,
  },
  badgeText: {color: '#fff', fontWeight: '700', fontSize: 12},
  route: {marginVertical: spacing.md},
  routeLabel: {fontSize: 11, color: colors.textSecondary, marginTop: spacing.sm, textTransform: 'uppercase'},
  routeAddr: {fontSize: 14, color: colors.textPrimary, marginTop: 2},
});

export default TrackingScreen;