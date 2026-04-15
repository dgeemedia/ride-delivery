// mobile/src/navigation/CustomerNavigator.js
// ── Premium Glass Tab Bar ─────────────────────────────────────────────────────
import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator }     from '@react-navigation/stack';
import { Ionicons }                 from '@expo/vector-icons';
import { BlurView }                 from 'expo-blur';
import { useSafeAreaInsets }        from 'react-native-safe-area-context';
import { useTheme }                 from '../context/ThemeContext';

import HomeScreen                from '../screens/Customer/HomeScreen';
import RequestRideScreen         from '../screens/Customer/RequestRideScreen';
import RequestDeliveryScreen     from '../screens/Customer/RequestDeliveryScreen';
import NearbyDriversScreen       from '../screens/Customer/NearbyDriversScreen';
import RideTrackingScreen        from '../screens/Customer/RideTrackingScreen';
import DeliveryTrackingScreen    from '../screens/Customer/DeliveryTrackingScreen';
import HistoryScreen             from '../screens/Customer/HistoryScreen';
import WalletScreen              from '../screens/Customer/WalletScreen';
import ShieldScreen              from '../screens/Customer/ShieldScreen';
import ShieldBeneficiariesScreen from '../screens/Customer/ShieldBeneficiariesScreen';
import CorporateScreen           from '../screens/Customer/CorporateScreen';
import DuoPayScreen              from '../screens/Customer/DuoPayScreen';
import RateRideScreen            from '../screens/Customer/RateRideScreen';
import RateDeliveryScreen        from '../screens/Customer/RateDeliveryScreen';
import ProfileScreen             from '../screens/Shared/ProfileScreen';
import EditProfileScreen         from '../screens/Shared/EditProfileScreen';
import NotificationsScreen       from '../screens/Shared/NotificationsScreen';
import ChangePasswordScreen      from '../screens/Shared/ChangePasswordScreen';
import SupportScreen             from '../screens/Shared/SupportScreen';
import SubmitTicketScreen        from '../screens/Shared/SubmitTicketScreen';
import MyTicketsScreen           from '../screens/Shared/MyTicketsScreen';
import TicketDetailScreen        from '../screens/Shared/TicketDetailScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ── Stack definitions ─────────────────────────────────────────────────────────
const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown:false }}>
    <Stack.Screen name="Home"                component={HomeScreen}                />
    <Stack.Screen name="RequestRide"         component={RequestRideScreen}         />
    <Stack.Screen name="RequestDelivery"     component={RequestDeliveryScreen}     />
    <Stack.Screen name="NearbyDrivers"       component={NearbyDriversScreen}       />
    <Stack.Screen name="RideTracking"        component={RideTrackingScreen}        />
    <Stack.Screen name="DeliveryTracking"    component={DeliveryTrackingScreen}    />
    <Stack.Screen name="RateRide"     component={RateRideScreen}     options={{ presentation:'modal' }} />
    <Stack.Screen name="RateDelivery" component={RateDeliveryScreen} options={{ presentation:'modal' }} />
    <Stack.Screen name="Shield"              component={ShieldScreen}              />
    <Stack.Screen name="ShieldBeneficiaries" component={ShieldBeneficiariesScreen} />
    <Stack.Screen name="Corporate"           component={CorporateScreen}           />
    <Stack.Screen name="DuoPay"              component={DuoPayScreen}              />
    <Stack.Screen name="Notifications"       component={NotificationsScreen}       />
    <Stack.Screen name="Support"             component={SupportScreen}             />
    <Stack.Screen name="SubmitTicket"        component={SubmitTicketScreen}        />
    <Stack.Screen name="MyTickets"           component={MyTicketsScreen}           />
    <Stack.Screen name="TicketDetail"        component={TicketDetailScreen}        />
  </Stack.Navigator>
);

const HistoryStack = () => (
  <Stack.Navigator screenOptions={{ headerShown:false }}>
    <Stack.Screen name="HistoryHome"  component={HistoryScreen}      />
    <Stack.Screen name="RateRide"     component={RateRideScreen}     options={{ presentation:'modal' }} />
    <Stack.Screen name="RateDelivery" component={RateDeliveryScreen} options={{ presentation:'modal' }} />
    <Stack.Screen name="Support"      component={SupportScreen}      />
    <Stack.Screen name="SubmitTicket" component={SubmitTicketScreen} />
    <Stack.Screen name="MyTickets"    component={MyTicketsScreen}    />
    <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
  </Stack.Navigator>
);

const WalletStack = () => (
  <Stack.Navigator screenOptions={{ headerShown:false }}>
    <Stack.Screen name="WalletHome"   component={WalletScreen}       />
    <Stack.Screen name="DuoPay"       component={DuoPayScreen}       />
    <Stack.Screen name="Support"      component={SupportScreen}      />
    <Stack.Screen name="SubmitTicket" component={SubmitTicketScreen} />
    <Stack.Screen name="MyTickets"    component={MyTicketsScreen}    />
    <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown:false }}>
    <Stack.Screen name="ProfileHome"    component={ProfileScreen}        />
    <Stack.Screen name="EditProfile"    component={EditProfileScreen}    />
    <Stack.Screen name="Notifications"  component={NotificationsScreen}  />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    <Stack.Screen name="Corporate"      component={CorporateScreen}      />
    <Stack.Screen name="DuoPay"         component={DuoPayScreen}         />
    <Stack.Screen name="Support"        component={SupportScreen}        />
    <Stack.Screen name="SubmitTicket"   component={SubmitTicketScreen}   />
    <Stack.Screen name="MyTickets"      component={MyTicketsScreen}      />
    <Stack.Screen name="TicketDetail"   component={TicketDetailScreen}   />
  </Stack.Navigator>
);

// ── Glass Tab Bar Background ──────────────────────────────────────────────────
const GlassTabBar = ({ mode }) => {
  const darkMode = mode === 'dark';
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={darkMode ? 80 : 60}
        tint={darkMode ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
    );
  }
  // Android: solid fallback — blur not supported
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: darkMode ? 'rgba(4,4,4,0.94)' : 'rgba(252,252,252,0.96)' },
      ]}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATOR
// ─────────────────────────────────────────────────────────────────────────────
const CustomerNavigator = () => {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const darkMode        = mode === 'dark';

  // ✅ FIX: Dynamic height = icon+label content row + device bottom inset.
  //         This is the same pattern used in DriverNavigator & PartnerNavigator.
  //         On Samsung gesture-nav phones, insets.bottom can be 24–48 px;
  //         the old hardcoded values (88/64) ignored this entirely.
  const TAB_CONTENT_H = 54;                          // icon + label row
  const tabBarHeight  = TAB_CONTENT_H + insets.bottom;
  const paddingBottom = insets.bottom + 4;           // push icons above gesture bar

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarIcon: ({ focused, color }) => {
          const icons = {
            HomeTab:    focused ? 'home'   : 'home-outline',
            HistoryTab: focused ? 'time'   : 'time-outline',
            WalletTab:  focused ? 'wallet' : 'wallet-outline',
            ProfileTab: focused ? 'person' : 'person-outline',
          };
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
        tabBarLabelStyle: { fontSize:10, fontWeight:'700', letterSpacing:0.3, marginTop:2 },

        tabBarStyle: {
          position:        'absolute',
          bottom:          0,
          left:            0,
          right:           0,
          elevation:       0,
          height:          tabBarHeight,   // ✅ dynamic
          paddingBottom:   paddingBottom,  // ✅ dynamic — clears Samsung gesture bar
          paddingTop:      10,
          backgroundColor: 'transparent',
          borderTopColor:  darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          borderTopWidth:  StyleSheet.hairlineWidth,
        },

        tabBarBackground: () => <GlassTabBar mode={mode} />,
      })}
    >
      <Tab.Screen name="HomeTab"    component={HomeStack}    options={{ title:'Home'    }} />
      <Tab.Screen name="HistoryTab" component={HistoryStack} options={{ title:'History' }} />
      <Tab.Screen name="WalletTab"  component={WalletStack}  options={{ title:'Wallet'  }} />
      <Tab.Screen name="ProfileTab" component={ProfileStack} options={{ title:'Profile' }} />
    </Tab.Navigator>
  );
};

export default CustomerNavigator;

const tb = StyleSheet.create({
  icon:       { width:32, height:32, justifyContent:'center', alignItems:'center' },
  iconActive: { width:40, height:32, borderRadius:10, justifyContent:'center', alignItems:'center' },
});