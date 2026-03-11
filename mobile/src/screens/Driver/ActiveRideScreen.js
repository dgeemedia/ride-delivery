// mobile/src/screens/Driver/ActiveRideScreen.js
import React from 'react';
import {View, Text, StyleSheet, Alert, SafeAreaView, ScrollView} from 'react-native';
import MapView, {Marker} from 'react-native-maps';
import {useRide} from '../../context/RideContext';
import {useLocation} from '../../context/LocationContext';
import Button from '../../components/Common/Button';
import {colors, spacing, radius} from '../../theme';
import {formatCurrency, getStatusColor} from '../../utils/formatters';

const ActiveRideScreen = ({navigation}) => {
  const {activeRide, startRide, completeRide} = useRide();
  const {location} = useLocation();

  if (!activeRide) {
    navigation.goBack();
    return null;
  }

  const handleStart = async () => {
    try {
      await startRide(activeRide.id);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not start ride');
    }
  };

  const handleComplete = async () => {
    Alert.alert('Complete Ride', 'Mark this ride as completed?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Complete',
        onPress: async () => {
          try {
            await completeRide(activeRide.id, activeRide.fare);
            navigation.navigate('Dashboard');
          } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Could not complete ride');
          }
        },
      },
    ]);
  };

  const lat = activeRide.pickupLat ?? location?.latitude ?? 6.5244;
  const lng = activeRide.pickupLng ?? location?.longitude ?? 3.3792;

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={{latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02}}>
        {location && <Marker coordinate={location} title="You" />}
        <Marker coordinate={{latitude: activeRide.pickupLat ?? lat, longitude: activeRide.pickupLng ?? lng}} title="Pickup" pinColor={colors.primary} />
        <Marker coordinate={{latitude: activeRide.dropoffLat ?? lat + 0.01, longitude: activeRide.dropoffLng ?? lng + 0.01}} title="Dropoff" pinColor={colors.error} />
      </MapView>

      <SafeAreaView style={styles.sheet}>
        <ScrollView>
          <View style={[styles.badge, {backgroundColor: getStatusColor(activeRide.status)}]}>
            <Text style={styles.badgeText}>{activeRide.status}</Text>
          </View>
          <Text style={styles.customer}>
            {activeRide.customer?.firstName} {activeRide.customer?.lastName}
          </Text>
          <Text style={styles.addr}>↑ {activeRide.pickupAddress}</Text>
          <Text style={styles.addr}>↓ {activeRide.dropoffAddress}</Text>
          {activeRide.fare && <Text style={styles.fare}>{formatCurrency(activeRide.fare)}</Text>}

          <View style={styles.btns}>
            {activeRide.status === 'ACCEPTED' && (
              <Button title="Start Ride" onPress={handleStart} fullWidth />
            )}
            {activeRide.status === 'IN_PROGRESS' && (
              <Button title="Complete Ride" variant="secondary" onPress={handleComplete} fullWidth />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  map: {flex: 1},
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.lg, maxHeight: '50%',
  },
  badge: {paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full, alignSelf: 'flex-start', marginBottom: spacing.sm},
  badgeText: {color: '#fff', fontSize: 12, fontWeight: '700'},
  customer: {fontSize: 18, fontWeight: '700', marginBottom: spacing.sm},
  addr: {fontSize: 13, color: colors.textSecondary, marginBottom: 4},
  fare: {fontSize: 20, fontWeight: '700', color: colors.primary, marginVertical: spacing.sm},
  btns: {marginTop: spacing.md},
});

export default ActiveRideScreen;