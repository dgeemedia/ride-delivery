import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { request, PERMISSIONS, RESULTS, check, openSettings } from 'react-native-permissions';

export const requestLocationPermission = async () => {
  try {
    if (Platform.OS === 'ios') {
      const permission = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
      
      if (permission === RESULTS.GRANTED) {
        return true;
      } else if (permission === RESULTS.BLOCKED) {
        showSettingsAlert('Location');
        return false;
      }
      return false;
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'DuoRide needs access to your location',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      } else if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        showSettingsAlert('Location');
        return false;
      }
      return false;
    }
  } catch (err) {
    console.warn(err);
    return false;
  }
};

export const checkLocationPermission = async () => {
  const permission = Platform.OS === 'ios'
    ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
    : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

  const result = await check(permission);
  return result === RESULTS.GRANTED;
};

export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  });
};

export const watchPosition = (callback, errorCallback) => {
  return Geolocation.watchPosition(
    callback,
    errorCallback,
    {
      enableHighAccuracy: true,
      distanceFilter: 10,
      interval: 5000,
      fastestInterval: 2000,
    }
  );
};

export const clearWatch = (watchId) => {
  if (watchId !== null) {
    Geolocation.clearWatch(watchId);
  }
};

export const requestCameraPermission = async () => {
  try {
    if (Platform.OS === 'ios') {
      const permission = await request(PERMISSIONS.IOS.CAMERA);
      return permission === RESULTS.GRANTED;
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch (err) {
    console.warn(err);
    return false;
  }
};

export const requestNotificationPermission = async () => {
  try {
    if (Platform.OS === 'ios') {
      const permission = await request(PERMISSIONS.IOS.NOTIFICATIONS);
      return permission === RESULTS.GRANTED;
    }
    // Android doesn't need permission for notifications
    return true;
  } catch (err) {
    console.warn(err);
    return false;
  }
};

const showSettingsAlert = (permissionName) => {
  Alert.alert(
    `${permissionName} Permission`,
    `DuoRide needs ${permissionName.toLowerCase()} permission. Please enable it in Settings.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => openSettings() },
    ]
  );
};

export const checkAllPermissions = async () => {
  const location = await checkLocationPermission();
  
  return {
    location,
    camera: false, // Check when needed
    notifications: false, // Check when needed
  };
};