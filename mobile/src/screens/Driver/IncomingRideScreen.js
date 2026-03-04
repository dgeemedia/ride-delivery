import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { driverAPI } from '../../services/api';
import { useRide } from '../../context/RideContext';
import RideCard from '../../components/Cards/RideCard';
import Button from '../../components/Common/Button';
import { colors, spacing } from '../../theme';

const IncomingRideScreen = ({ navigation }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { acceptRide } = useRide();

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const response = await driverAPI.getNearbyRequests();
      setRequests(response.data.requests);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (rideId) => {
    try {
      await acceptRide(rideId);
      navigation.navigate('ActiveRide');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const renderRequest = ({ item }) => (
    <View style={styles.requestCard}>
      <RideCard ride={item} />
      <Button
        title="Accept Ride"
        onPress={() => handleAccept(item.id)}
        fullWidth
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nearby Ride Requests</Text>
      <FlatList
        data={requests}
        renderItem={renderRequest}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No requests nearby</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.md,
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

export default IncomingRideScreen;