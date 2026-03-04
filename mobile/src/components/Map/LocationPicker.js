import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing } from '../../theme';
import Button from '../Common/Button';

const LocationPicker = ({ onLocationSelected, initialLocation }) => {
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [region, setRegion] = useState({
    latitude: initialLocation?.latitude || 37.78825,
    longitude: initialLocation?.longitude || -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationSelected(selectedLocation);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={region}
        onRegionChange={setRegion}
        onPress={handleMapPress}
      >
        {selectedLocation && (
          <Marker coordinate={selectedLocation} />
        )}
      </MapView>

      <View style={styles.centerMarker}>
        <Icon name="place" size={48} color={colors.primary} />
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Confirm Location"
          onPress={handleConfirm}
          disabled={!selectedLocation}
          fullWidth
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  centerMarker: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -24,
    marginTop: -48,
    pointerEvents: 'none',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
  },
});

export default LocationPicker;