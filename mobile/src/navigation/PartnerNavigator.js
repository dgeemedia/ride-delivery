// mobile/src/navigation/PartnerNavigator.js
import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { ScrollProvider } from '../context/ScrollContext';
import AnimatedTabBar from '../components/AnimatedTabBar';

import PartnerDashboardScreen from '../screens/Partner/PartnerDashboardScreen';
import PartnerEarningsScreen from '../screens/Partner/PartnerEarningsScreen';
import PartnerHistoryScreen from '../screens/Partner/PartnerHistoryScreen';
import IncomingDeliveryScreen from '../screens/Partner/IncomingDeliveryScreen';
import ActiveDeliveryScreen from '../screens/Partner/ActiveDeliveryScreen';
import CourierFloorPriceScreen from '../screens/Partner/CourierFloorPriceScreen';
import PartnerDocumentsScreen from '../screens/Partner/PartnerDocumentsScreen';
import WalletTopUpScreen from '../screens/Shared/WalletTopUpScreen';
import WithdrawalScreen from '../screens/Shared/WithdrawalScreen';
import ProfileScreen from '../screens/Shared/ProfileScreen';
import EditProfileScreen from '../screens/Shared/EditProfileScreen';
import NotificationsScreen from '../screens/Shared/NotificationsScreen';
import ChangePasswordScreen from '../screens/Shared/ChangePasswordScreen';
import SupportScreen from '../screens/Shared/SupportScreen';
import SubmitTicketScreen from '../screens/Shared/SubmitTicketScreen';
import MyTicketsScreen from '../screens/Shared/MyTicketsScreen';
import TicketDetailScreen from '../screens/Shared/TicketDetailScreen';
import AppFeedbackScreen from '../screens/Shared/AppFeedbackScreen';
import LegalScreen from '../screens/Shared/LegalScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ── Stack definitions ─────────────────────────────────────────────────────────
const DashboardStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Dashboard"        component={PartnerDashboardScreen}  />
    <Stack.Screen name="IncomingDelivery" component={IncomingDeliveryScreen}  />
    <Stack.Screen name="ActiveDelivery"   component={ActiveDeliveryScreen}    />
    <Stack.Screen name="FloorPrice"       component={CourierFloorPriceScreen} />
    <Stack.Screen name="PartnerDocuments" component={PartnerDocumentsScreen}  />
    <Stack.Screen name="AppFeedback"      component={AppFeedbackScreen}       />
    <Stack.Screen name="Notifications"    component={NotificationsScreen}     />
    <Stack.Screen name="Support"          component={SupportScreen}           />
    <Stack.Screen name="SubmitTicket"     component={SubmitTicketScreen}      />
    <Stack.Screen name="MyTickets"        component={MyTicketsScreen}         />
    <Stack.Screen name="TicketDetail"     component={TicketDetailScreen}      />
  </Stack.Navigator>
);

const EarningsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="EarningsHome"   component={PartnerEarningsScreen}   />
    <Stack.Screen name="PartnerHistory" component={PartnerHistoryScreen}    />
    <Stack.Screen name="WalletTopUp"    component={WalletTopUpScreen}       />
    <Stack.Screen name="Withdrawal"     component={WithdrawalScreen}        />
    <Stack.Screen name="Support"        component={SupportScreen}           />
    <Stack.Screen name="SubmitTicket"   component={SubmitTicketScreen}      />
    <Stack.Screen name="MyTickets"      component={MyTicketsScreen}         />
    <Stack.Screen name="TicketDetail"   component={TicketDetailScreen}      />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileHome"    component={ProfileScreen}            />
    <Stack.Screen name="EditProfile"    component={EditProfileScreen}        />
    <Stack.Screen name="Notifications"  component={NotificationsScreen}      />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen}     />
    <Stack.Screen name="FloorPrice"     component={CourierFloorPriceScreen}  />
    <Stack.Screen name="AppFeedback"    component={AppFeedbackScreen}        />
    <Stack.Screen name="Support"        component={SupportScreen}            />
    <Stack.Screen name="SubmitTicket"   component={SubmitTicketScreen}       />
    <Stack.Screen name="MyTickets"      component={MyTicketsScreen}          />
    <Stack.Screen name="TicketDetail"   component={TicketDetailScreen}       />
    <Stack.Screen name="Legal"          component={LegalScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);

// ── PartnerNavigator ──────────────────────────────────────────────────────────
const PartnerNavigator = () => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const TAB_CONTENT_H = 54;
  const EXTRA_BOTTOM = Platform.OS === 'android' ? 16 : 0;
  const tabBarHeight = TAB_CONTENT_H + insets.bottom + EXTRA_BOTTOM;

  return (
    <ScrollProvider>
      <Tab.Navigator
        tabBar={props => <AnimatedTabBar {...props} />}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            const icons = {
              DashboardTab: focused ? 'cube'   : 'cube-outline',
              EarningsTab:  focused ? 'wallet' : 'wallet-outline',
              ProfileTab:   focused ? 'person' : 'person-outline',
            };
            return <Ionicons name={icons[route.name]} size={size} color={color} />;
          },
          tabBarActiveTintColor:   theme.accent,
          tabBarInactiveTintColor: theme.hint,
          tabBarStyle: {
            position: 'absolute',       // ← required for animation
            backgroundColor: theme.background,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            height: tabBarHeight,
            paddingBottom: EXTRA_BOTTOM + 4,
            paddingTop: 8,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        })}
      >
        <Tab.Screen name="DashboardTab" component={DashboardStack} options={{ title: 'Deliveries' }} />
        <Tab.Screen name="EarningsTab"  component={EarningsStack}  options={{ title: 'Earnings'   }} />
        <Tab.Screen name="ProfileTab"   component={ProfileStack}   options={{ title: 'Profile'    }} />
      </Tab.Navigator>
    </ScrollProvider>
  );
};

export default PartnerNavigator;