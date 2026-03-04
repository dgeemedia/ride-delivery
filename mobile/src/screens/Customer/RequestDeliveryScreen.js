import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useDelivery } from '../../context/DeliveryContext';
import AddressInput from '../../components/Inputs/AddressInput';
import Input from '../../components/Common/Input';
import Button from '../../components/Common/Button';
import { colors, spacing } from '../../theme';

const RequestDeliveryScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    pickupAddress: '',
    pickupLat: 0,
    pickupLng: 0,
    pickupContact: '',
    dropoffAddress: '',
    dropoffLat: 0,
    dropoffLng: 0,
    dropoffContact: '',
    packageDescription: '',
    packageWeight: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const { requestDelivery } = useDelivery();

  const handleSubmit = async () => {
    if (!formData.pickupLat || !formData.dropoffLat) {
      Alert.alert('Error', 'Please select both locations');
      return;
    }

    setLoading(true);
    try {
      await requestDelivery(formData);
      navigation.navigate('Tracking');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Request Delivery</Text>

      <Text style={styles.sectionTitle}>Pickup Details</Text>
      <AddressInput
        label="Pickup Address"
        placeholder="Where to pickup?"
        value={formData.pickupAddress}
        onSelectAddress={(addr) =>
          setFormData({ ...formData, pickupAddress: addr.description })
        }
      />
      <Input
        label="Pickup Contact"
        value={formData.pickupContact}
        onChangeText={(text) => setFormData({ ...formData, pickupContact: text })}
        placeholder="+1234567890"
      />

      <Text style={styles.sectionTitle}>Dropoff Details</Text>
      <AddressInput
        label="Dropoff Address"
        placeholder="Delivery destination"
        value={formData.dropoffAddress}
        onSelectAddress={(addr) =>
          setFormData({ ...formData, dropoffAddress: addr.description })
        }
      />
      <Input
        label="Dropoff Contact"
        value={formData.dropoffContact}
        onChangeText={(text) => setFormData({ ...formData, dropoffContact: text })}
        placeholder="+1234567890"
      />

      <Text style={styles.sectionTitle}>Package Details</Text>
      <Input
        label="Package Description"
        value={formData.packageDescription}
        onChangeText={(text) =>
          setFormData({ ...formData, packageDescription: text })
        }
        placeholder="What's in the package?"
      />
      <Input
        label="Weight (kg) - Optional"
        value={formData.packageWeight}
        onChangeText={(text) => setFormData({ ...formData, packageWeight: text })}
        placeholder="5"
        keyboardType="numeric"
      />
      <Input
        label="Notes (Optional)"
        value={formData.notes}
        onChangeText={(text) => setFormData({ ...formData, notes: text })}
        placeholder="Special instructions"
        multiline
        numberOfLines={3}
      />

      <Button
        title="Request Delivery"
        onPress={handleSubmit}
        loading={loading}
        fullWidth
        style={styles.button}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  button: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});

export default RequestDeliveryScreen;