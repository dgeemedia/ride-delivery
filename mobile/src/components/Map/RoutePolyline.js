import React from 'react';
import { Polyline } from 'react-native-maps';
import { colors } from '../../theme';

const RoutePolyline = ({ coordinates, strokeWidth = 4, strokeColor = colors.primary }) => {
  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  return (
    <Polyline
      coordinates={coordinates}
      strokeWidth={strokeWidth}
      strokeColor={strokeColor}
      lineDashPattern={[1]}
    />
  );
};

export default RoutePolyline;