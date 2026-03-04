import React from 'react';
import { Marker } from 'react-native-maps';
import { Image } from 'react-native';

const carIcon = require('../../assets/car-marker.png'); // Add this asset

const DriverMarker = ({ coordinate, rotation = 0, driver }) => {
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      rotation={rotation}
      title={driver ? `${driver.firstName} ${driver.lastName}` : 'Driver'}
    >
      <Image
        source={carIcon}
        style={{ width: 40, height: 40, transform: [{ rotate: `${rotation}deg` }] }}
        resizeMode="contain"
      />
    </Marker>
  );
};

export default DriverMarker;