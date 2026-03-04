// src/screens/Driver/DriverDashboardScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity } from 'react-native';
import { driverAPI } from '../../services/api';
import socketService from '../../services/socket';

const DriverDashboardScreen = ({ navigation }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadStats();
    socketService.connect();
  }, []);

  const loadStats = async () => {
    try {
      const response = await driverAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const toggleOnlineStatus = async (value) => {
    try {
      await driverAPI.updateStatus({ isOnline: value });
      
      if (value) {
        // Get current location and send to server
        socketService.goOnline({ latitude: 0, longitude: 0 });
      } else {
        socketService.goOffline();
      }
      
      setIsOnline(value);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Driver Dashboard</Text>
        <View style={styles.statusContainer}>
          <Text>Online Status</Text>
          <Switch value={isOnline} onValueChange={toggleOnlineStatus} />
        </View>
      </View>

      {stats && (
        <View style={styles.statsContainer}>
          <StatCard title="Total Rides" value={stats.totalRides} />
          <StatCard title="Rating" value={stats.rating} />
          <StatCard title="Acceptance Rate" value={`${stats.acceptanceRate}%`} />
        </View>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Earnings')}
      >
        <Text style={styles.buttonText}>View Earnings</Text>
      </TouchableOpacity>
    </View>
  );
};

const StatCard = ({ title, value }) => (
  <View style={styles.statCard}>
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

// Styles here...

export default DriverDashboardScreen;