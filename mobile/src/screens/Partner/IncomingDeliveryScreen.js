import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { partnerAPI } from '../../services/api';
import { useDelivery } from '../../context/DeliveryContext';
import DeliveryCard from '../../components/Cards/DeliveryCard';
import Button from '../../components/Common/Button';
import { colors, spacing } from '../../theme';

const IncomingDeliveryScreen = ({ navigation }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { acceptDelivery } = useDelivery();

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const response = await partnerAPI.getNearbyRequests();
      setRequests(response.data.requests);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (deliveryId) => {
    try {
      await acceptDelivery(deliveryId);
      navigation.navigate('ActiveDelivery');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const renderRequest = ({ item }) => (
    <View style={styles.requestCard}>
      <DeliveryCard delivery={item} />
      <Button
        title="Accept Delivery"
        onPress={() => handleAccept(item.id)}
        fullWidth
        icon="check-circle"
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nearby Delivery Requests</Text>
      <FlatList
        data={requests}
        renderItem={renderRequest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No requests available</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: spacing.lg,
  },
  list: {
    padding: spacing.md,
  },
  requestCard: {
    marginBottom: spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },
});

export default IncomingDeliveryScreen;