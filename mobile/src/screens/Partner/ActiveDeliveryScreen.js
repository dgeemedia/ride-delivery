// mobile/src/screens/Partner/ActiveDeliveryScreen.js
import React from 'react';
import {View, Text, StyleSheet, Alert, SafeAreaView, ScrollView} from 'react-native';
import MapView, {Marker} from 'react-native-maps';
import {useDelivery} from '../../context/DeliveryContext';
import {useLocation} from '../../context/LocationContext';
import Button from '../../components/Common/Button';
import {colors, spacing, radius} from '../../theme';
import {getStatusColor} from '../../utils/formatters';

const ActiveDeliveryScreen = ({navigation}) => {
  const {activeDelivery, pickupDelivery, startTransit} = useDelivery();
  const {location} = useLocation();

  if (!activeDelivery) { navigation.goBack(); return null; }

  const lat = activeDelivery.pickupLat ?? location?.latitude ?? 6.5244;
  const lng = activeDelivery.pickupLng ?? location?.longitude ?? 3.3792;

  const handlePickup = async () => {
    try { await pickupDelivery(activeDelivery.id); }
    catch (err) { Alert.alert('Error', err.response?.data?.message || 'Error'); }
  };

  const handleTransit = async () => {
    try { await startTransit(activeDelivery.id); }
    catch (err) { Alert.alert('Error', err.response?.data?.message || 'Error'); }
  };

  const handleComplete = () => navigation.navigate('ProofOfDelivery');

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={{latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02}}>
        {location && <Marker coordinate={location} title="You" />}
        <Marker coordinate={{latitude: lat, longitude: lng}} title="Pickup" pinColor={colors.primary} />
        <Marker coordinate={{latitude: activeDelivery.dropoffLat ?? lat + 0.01, longitude: activeDelivery.dropoffLng ?? lng + 0.01}} title="Dropoff" pinColor={colors.error} />
      </MapView>

      <SafeAreaView style={styles.sheet}>
        <ScrollView>
          <View style={[styles.badge, {backgroundColor: getStatusColor(activeDelivery.status)}]}>
            <Text style={styles.badgeText}>{activeDelivery.status}</Text>
          </View>
          <Text style={styles.addr}>↑ {activeDelivery.pickupAddress}</Text>
          <Text style={styles.addr}>↓ {activeDelivery.dropoffAddress}</Text>
          {activeDelivery.recipientName && <Text style={styles.recipient}>Recipient: {activeDelivery.recipientName}</Text>}

          <View style={styles.btns}>
            {activeDelivery.status === 'ASSIGNED' && <Button title="Picked Up Package" onPress={handlePickup} fullWidth />}
            {activeDelivery.status === 'PICKED_UP' && <Button title="Start Transit" onPress={handleTransit} fullWidth />}
            {activeDelivery.status === 'IN_TRANSIT' && <Button title="Complete Delivery" variant="secondary" onPress={handleComplete} fullWidth />}
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
  addr: {fontSize: 13, color: colors.textSecondary, marginBottom: 4},
  recipient: {fontSize: 14, fontWeight: '600', marginVertical: spacing.sm},
  btns: {marginTop: spacing.md},
});

export default ActiveDeliveryScreen;