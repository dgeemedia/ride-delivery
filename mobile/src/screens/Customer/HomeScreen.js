// src/screens/Customer/HomeScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import { request, PERMISSIONS } from 'react-native-permissions';

const HomeScreen = ({ navigation }) => {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    const result = await request(
      Platform.OS === 'ios'
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
    );

    if (result === 'granted') {
      getCurrentLocation();
    }
  };

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01
        });
      },
      (error) => console.log(error),
      { enableHighAccuracy: true }
    );
  };

  return (
    <View style={styles.container}>
      {location && (
        <MapView style={styles.map} initialRegion={location}>
          <Marker coordinate={location} title="You are here" />
        </MapView>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.serviceButton}
          onPress={() => navigation.navigate('RequestRide')}
        >
          <Text style={styles.serviceButtonText}>🚗 Request Ride</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.serviceButton}
          onPress={() => navigation.navigate('RequestDelivery')}
        >
          <Text style={styles.serviceButtonText}>📦 Request Delivery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  map: {
    flex: 1
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  serviceButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 5
  },
  serviceButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600'
  }
});

export default HomeScreen;