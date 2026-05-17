// mobile/src/navigation/CustomerNavigator.js
// ── 4-tab navigator with wallet balance badge ─────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import { Platform, View, Text, StyleSheet, Animated } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator }     from '@react-navigation/stack';
import { Ionicons }   from '@expo/vector-icons';
import { BlurView }   from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }   from '../context/ThemeContext';
import { ScrollProvider } from '../context/ScrollContext';
import AnimatedTabBar from '../components/AnimatedTabBar';
import { walletAPI }  from '../services/api';

import HomeScreen              from '../screens/Customer/HomeScreen';
import RequestRideScreen       from '../screens/Customer/RequestRideScreen';
import RequestDeliveryScreen   from '../screens/Customer/RequestDeliveryScreen';
import NearbyDriversScreen     from '../screens/Customer/NearbyDriversScreen';
import NearbyPartnersScreen    from '../screens/Customer/NearbyPartnersScreen'; // ← NEW
import RideTrackingScreen      from '../screens/Customer/RideTrackingScreen';
import DeliveryTrackingScreen  from '../screens/Customer/DeliveryTrackingScreen';
import HistoryScreen           from '../screens/Customer/HistoryScreen';
import WalletScreen            from '../screens/Customer/WalletScreen';
import RateRideScreen          from '../screens/Customer/RateRideScreen';
import RateDeliveryScreen      from '../screens/Customer/RateDeliveryScreen';
import ProfileScreen           from '../screens/Shared/ProfileScreen';
import EditProfileScreen       from '../screens/Shared/EditProfileScreen';
import NotificationsScreen     from '../screens/Shared/NotificationsScreen';
import ChangePasswordScreen    from '../screens/Shared/ChangePasswordScreen';
import SupportScreen           from '../screens/Shared/SupportScreen';
import SubmitTicketScreen      from '../screens/Shared/SubmitTicketScreen';
import MyTicketsScreen         from '../screens/Shared/MyTicketsScreen';
import TicketDetailScreen      from '../screens/Shared/TicketDetailScreen';
import TransferScreen          from '../screens/Shared/TransferScreen';
import WalletTopUpScreen       from '../screens/Shared/WalletTopUpScreen';
import WithdrawalScreen        from '../screens/Shared/WithdrawalScreen';
import AppFeedbackScreen       from '../screens/Shared/AppFeedbackScreen';
import LegalScreen             from '../screens/Shared/LegalScreen';
import TransactionHistoryScreen from '../screens/Shared/TransactionHistoryScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ── Stack navigators ──────────────────────────────────────────────────────────
const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Home"             component={HomeScreen}            />
    <Stack.Screen name="RequestRide"      component={RequestRideScreen}     />
    <Stack.Screen name="RequestDelivery"  component={RequestDeliveryScreen} />
    <Stack.Screen name="NearbyDrivers"    component={NearbyDriversScreen}   />
    <Stack.Screen name="NearbyPartners"   component={NearbyPartnersScreen}  />
    <Stack.Screen name="RideTracking"     component={RideTrackingScreen}    />
    <Stack.Screen name="DeliveryTracking" component={DeliveryTrackingScreen}/>
    <Stack.Screen name="RateRide"         component={RateRideScreen}        options={{ presentation: 'modal' }} />
    <Stack.Screen name="RateDelivery"     component={RateDeliveryScreen}    options={{ presentation: 'modal' }} />
    <Stack.Screen name="Notifications"    component={NotificationsScreen}   />
    <Stack.Screen name="Support"          component={SupportScreen}         />
    <Stack.Screen name="SubmitTicket"     component={SubmitTicketScreen}    />
    <Stack.Screen name="MyTickets"        component={MyTicketsScreen}       />
    <Stack.Screen name="TicketDetail"     component={TicketDetailScreen}    />
    <Stack.Screen name="Legal"            component={LegalScreen}           />
  </Stack.Navigator>
);

const HistoryStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="HistoryHome"  component={HistoryScreen}      />
    <Stack.Screen name="RideTracking"     component={RideTrackingScreen}     />
    <Stack.Screen name="DeliveryTracking" component={DeliveryTrackingScreen} />
    <Stack.Screen name="RateRide"     component={RateRideScreen}     options={{ presentation: 'modal' }} />
    <Stack.Screen name="RateDelivery" component={RateDeliveryScreen} options={{ presentation: 'modal' }} />
    <Stack.Screen name="Support"      component={SupportScreen}      />
    <Stack.Screen name="SubmitTicket" component={SubmitTicketScreen} />
    <Stack.Screen name="MyTickets"    component={MyTicketsScreen}    />
    <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
    <Stack.Screen name="Legal"        component={LegalScreen}        />
  </Stack.Navigator>
);

const WalletStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="WalletHome"   component={WalletScreen}       />
    <Stack.Screen name="WalletTopUp"  component={WalletTopUpScreen}  />
    <Stack.Screen name="Transfer"     component={TransferScreen}     />
    <Stack.Screen name="Withdraw"     component={WithdrawalScreen}   />
    <Stack.Screen name="TransactionHistory"  component={TransactionHistoryScreen}   />
    <Stack.Screen name="Support"      component={SupportScreen}      />
    <Stack.Screen name="SubmitTicket" component={SubmitTicketScreen} />
    <Stack.Screen name="MyTickets"    component={MyTicketsScreen}    />
    <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
    <Stack.Screen name="Legal"        component={LegalScreen}        />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileHome"    component={ProfileScreen}        />
    <Stack.Screen name="EditProfile"    component={EditProfileScreen}    />
    <Stack.Screen name="Notifications"  component={NotificationsScreen}  />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    <Stack.Screen name="AppFeedback"    component={AppFeedbackScreen}    />
    <Stack.Screen name="Support"        component={SupportScreen}        />
    <Stack.Screen name="SubmitTicket"   component={SubmitTicketScreen}   />
    <Stack.Screen name="MyTickets"      component={MyTicketsScreen}      />
    <Stack.Screen name="TicketDetail"   component={TicketDetailScreen}   />
    <Stack.Screen name="Legal"          component={LegalScreen}          options={{ headerShown: false }} />
  </Stack.Navigator>
);

// ── GlassTabBar background ────────────────────────────────────────────────────
const GlassTabBar = ({ mode }) => {
  const darkMode = mode === 'dark';
  const style = {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: darkMode ? 'rgba(4,4,4,0.94)' : 'rgba(252,252,252,0.96)',
  };
  if (Platform.OS === 'ios') {
    return <BlurView intensity={darkMode ? 80 : 60} tint={darkMode ? 'dark' : 'light'} style={style} />;
  }
  return <View style={style} />;
};

// ── WalletBadge ───────────────────────────────────────────────────────────────
const WalletBadge = ({ balance, focused, darkMode }) => {
  const scaleA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (balance !== null) {
      Animated.spring(scaleA, { toValue: 1, useNativeDriver: true, tension: 90, friction: 10 }).start();
    }
  }, [balance]);

  if (balance === null) return null;

  const fmt = (n) => {
    if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `₦${(n / 1_000).toFixed(1)}k`;
    return `₦${Math.round(n)}`;
  };

  const bgColor  = darkMode
    ? (focused ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.10)')
    : (focused ? 'rgba(0,0,0,0.11)'       : 'rgba(0,0,0,0.07)');
  const txtColor = darkMode
    ? (focused ? '#FFFFFF' : 'rgba(255,255,255,0.55)')
    : (focused ? '#000000' : 'rgba(0,0,0,0.45)');

  return (
    <Animated.View style={[wb.pill, { backgroundColor: bgColor, transform: [{ scale: scaleA }] }]}>
      <Text style={[wb.txt, { color: txtColor }]} numberOfLines={1}>{fmt(balance)}</Text>
    </Animated.View>
  );
};

const wb = StyleSheet.create({
  pill: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1.5, marginBottom: 2, alignSelf: 'center' },
  txt:  { fontSize: 9, fontWeight: '700', letterSpacing: 0.2 },
});

// ── CustomerNavigator ─────────────────────────────────────────────────────────
const CustomerNavigator = () => {
  const { theme, mode } = useTheme();
  const insets   = useSafeAreaInsets();
  const darkMode = mode === 'dark';

  const [walletBalance, setWalletBalance] = useState(null);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 60_000);
    return () => clearInterval(interval);
  }, []);

  const fetchBalance = async () => {
    try {
      const res = await walletAPI.getWallet();
      const bal = res?.data?.balance ?? res?.balance ?? null;
      if (bal !== null) setWalletBalance(Number(bal));
    } catch {
      // Silent — badge stays hidden
    }
  };

  const TAB_CONTENT_H = 54;
  const EXTRA_BOTTOM  = Platform.OS === 'android' ? 16 : 0;
  const tabBarHeight  = TAB_CONTENT_H + insets.bottom + EXTRA_BOTTOM;

  return (
    <ScrollProvider>
      <Tab.Navigator
        tabBar={props => <AnimatedTabBar {...props} />}
        screenOptions={({ route }) => ({
          headerShown: false,

          tabBarIcon: ({ focused, color }) => {
            const icons = {
              HomeTab:    focused ? 'home'   : 'home-outline',
              HistoryTab: focused ? 'time'   : 'time-outline',
              WalletTab:  focused ? 'wallet' : 'wallet-outline',
              ProfileTab: focused ? 'person' : 'person-outline',
            };

            if (route.name === 'WalletTab') {
              return (
                <View style={tb.walletWrap}>
                  <WalletBadge balance={walletBalance} focused={focused} darkMode={darkMode} />
                  <View style={focused
                    ? [tb.iconActive, { backgroundColor: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)' }]
                    : tb.icon
                  }>
                    <Ionicons name={icons[route.name]} size={focused ? 20 : 22} color={color} />
                  </View>
                </View>
              );
            }

            return (
              <View style={focused
                ? [tb.iconActive, { backgroundColor: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)' }]
                : tb.icon
              }>
                <Ionicons name={icons[route.name]} size={focused ? 20 : 22} color={color} />
              </View>
            );
          },

          tabBarActiveTintColor:   theme.foreground,
          tabBarInactiveTintColor: darkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',

          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.3,
            marginTop: 2,
          },

          tabBarStyle: {
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            borderTopWidth: StyleSheet.hairlineWidth,
            height: tabBarHeight,
            paddingBottom: EXTRA_BOTTOM + 4,
            paddingTop: 8,
            paddingHorizontal: 10,
            elevation: 0,
          },

          tabBarBackground: () => <GlassTabBar mode={mode} />,
        })}

        screenListeners={({ route }) => ({
          focus: () => {
            if (route.name === 'WalletTab') fetchBalance();
          },
        })}
      >
        <Tab.Screen name="HomeTab"    component={HomeStack}    options={{ title: 'Home'    }} />
        <Tab.Screen name="HistoryTab" component={HistoryStack} options={{ title: 'History' }} />
        <Tab.Screen name="WalletTab"  component={WalletStack}  options={{ title: 'Wallet'  }} />
        <Tab.Screen name="ProfileTab" component={ProfileStack} options={{ title: 'Profile' }} />
      </Tab.Navigator>
    </ScrollProvider>
  );
};

export default CustomerNavigator;

const tb = StyleSheet.create({
  icon:       { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  iconActive: { width: 40, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  walletWrap: { alignItems: 'center', justifyContent: 'flex-end' },
});