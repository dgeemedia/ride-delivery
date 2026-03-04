import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { rideAPI, deliveryAPI } from '../../services/api';
import RideCard from '../../components/Cards/RideCard';
import DeliveryCard from '../../components/Cards/DeliveryCard';
import Loading from '../../components/Common/Loading';
import { colors, spacing } from '../../theme';

const HistoryScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('rides');
  const [rides, setRides] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [activeTab]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      if (activeTab === 'rides') {
        const response = await rideAPI.getRideHistory();
        setRides(response.data.rides);
      } else {
        const response = await deliveryAPI.getDeliveryHistory();
        setDeliveries(response.data.deliveries);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderRide = ({ item }) => (
    <RideCard
      ride={item}
      onPress={() => navigation.navigate('RideDetails', { rideId: item.id })}
    />
  );

  const renderDelivery = ({ item }) => (
    <DeliveryCard
      delivery={item}
      onPress={() =>
        navigation.navigate('DeliveryDetails', { deliveryId: item.id })
      }
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'rides' && styles.activeTab]}
          onPress={() => setActiveTab('rides')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'rides' && styles.activeTabText,
            ]}
          >
            Rides
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'deliveries' && styles.activeTab]}
          onPress={() => setActiveTab('deliveries')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'deliveries' && styles.activeTabText,
            ]}
          >
            Deliveries
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Loading visible={true} />
      ) : (
        <FlatList
          data={activeTab === 'rides' ? rides : deliveries}
          renderItem={activeTab === 'rides' ? renderRide : renderDelivery}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No history yet</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  list: {
    padding: spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },
});

export default HistoryScreen;