// mobile/src/screens/Partner/IncomingDeliveryScreen.js
import React, {useState} from 'react';
import {View, Text, StyleSheet, Alert, SafeAreaView} from 'react-native';
import {useDelivery} from '../../context/DeliveryContext';
import Button from '../../components/Common/Button';
import {colors, spacing, radius} from '../../theme';
import {formatCurrency} from '../../utils/formatters';

const IncomingDeliveryScreen = ({route, navigation}) => {
  const delivery = route.params?.delivery ?? {};
  const {acceptDelivery} = useDelivery();
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await acceptDelivery(delivery.id);
      navigation.navigate('ActiveDelivery');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not accept delivery');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>New Delivery 📦</Text>
        <View style={styles.card}>
          <Row label="Pickup" value={delivery.pickupAddress} />
          <Row label="Dropoff" value={delivery.dropoffAddress} />
          {delivery.packageDescription && <Row label="Package" value={delivery.packageDescription} />}
          {delivery.recipientName && <Row label="Recipient" value={delivery.recipientName} />}
          {delivery.price && <Row label="Earnings" value={formatCurrency(delivery.price)} highlight />}
        </View>
        <View style={styles.actions}>
          <Button title="Decline" variant="outline" onPress={() => navigation.goBack()} style={{flex: 1}} />
          <Button title="Accept" onPress={handleAccept} loading={loading} style={{flex: 1}} />
        </View>
      </View>
    </SafeAreaView>
  );
};

const Row = ({label, value, highlight}) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowVal, highlight && {color: colors.primary, fontWeight: '700'}]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#fff'},
  container: {flex: 1, padding: spacing.lg},
  title: {fontSize: 22, fontWeight: '700', marginBottom: spacing.lg},
  card: {backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl},
  row: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border},
  rowLabel: {fontSize: 14, color: colors.textSecondary},
  rowVal: {fontSize: 14, color: colors.textPrimary, flexShrink: 1, textAlign: 'right'},
  actions: {flexDirection: 'row', gap: 12},
});

export default IncomingDeliveryScreen;