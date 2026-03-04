import React from 'react';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { StyleSheet } from 'react-native';

const CustomMapView = ({ children, initialRegion, onRegionChange, style, ...props }) => {
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={[styles.map, style]}
      initialRegion={initialRegion}
      onRegionChange={onRegionChange}
      showsUserLocation
      showsMyLocationButton
      showsCompass
      loadingEnabled
      {...props}
    >
      {children}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});

export default CustomMapView;