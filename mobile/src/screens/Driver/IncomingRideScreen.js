// mobile/src/screens/Driver/IncomingRideScreen.js
import React, {useState} from 'react';
import {View, Text, StyleSheet, SafeAreaView, Alert} from 'react-native';
import {useRide} from '../../context/RideContext';
import Button from '../../components/Common/Button';
import {colors, spacing, radius} from '../../theme';
import {formatCurrency} from '../../utils/formatters';

const IncomingRideScreen = ({route, navigation}) => {
  const ride = route.params?.ride ?? {};
  const {acceptRide} = useRide();
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await acceptRide(ride.id);
      navigation.navigate('ActiveRide');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not accept ride');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = () => navigation.goBack();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>New Ride Request 🚗</Text>

        <View style={styles.card}>
          <Row label="Pickup" value={ride.pickupAddress} />
          <Row label="Dropoff" value={ride.dropoffAddress} />
          {ride.distance && <Row label="Distance" value={`${(ride.distance / 1000).toFixed(1)} km`} />}
          {ride.fare && <Row label="Fare" value={formatCurrency(ride.fare)} highlight />}
        </View>

        <View style={styles.actions}>
          <Button title="Decline" variant="outline" onPress={handleDecline} style={{flex: 1}} />
          <Button title="Accept" onPress={handleAccept} loading={loading} style={{flex: 1}} />
        </View>
      </View>
    </SafeAreaView>
  );
};

const Row = ({label, value, highlight}) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, highlight && {color: colors.primary, fontWeight: '700'}]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#fff'},
  container: {flex: 1, padding: spacing.lg},
  title: {fontSize: 22, fontWeight: '700', marginBottom: spacing.lg},
  card: {backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl},
  row: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border},
  rowLabel: {fontSize: 14, color: colors.textSecondary},
  rowValue: {fontSize: 14, color: colors.textPrimary, flexShrink: 1, textAlign: 'right'},
  actions: {flexDirection: 'row', gap: 12},
});

export default IncomingRideScreen;