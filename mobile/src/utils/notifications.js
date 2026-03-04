// src/utils/notifications.js
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const requestUserPermission = async () => {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    getFCMToken();
  }
};

export const getFCMToken = async () => {
  const fcmToken = await messaging().getToken();
  await AsyncStorage.setItem('fcmToken', fcmToken);
  // Send to backend
  return fcmToken;
};

export const setupNotificationListeners = () => {
  // Foreground messages
  messaging().onMessage(async remoteMessage => {
    Alert.alert('New Notification', remoteMessage.notification.body);
  });

  // Background messages
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('Background message:', remoteMessage);
  });
};