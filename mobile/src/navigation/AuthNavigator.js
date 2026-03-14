// mobile/src/navigation/AuthNavigator.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen      from '../screens/Auth/LoginScreen';
import RegisterScreen   from '../screens/Auth/RegisterScreen';
import OnboardingScreen from '../screens/Auth/OnboardingScreen';

const Stack = createStackNavigator();

const AuthNavigator = () => {
  return (
    // initialRouteName="Login" means logout always lands on the sign-in screen.
    // Onboarding is still reachable for new users via RegisterScreen or deep link.
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Login"      component={LoginScreen} />
      <Stack.Screen name="Register"   component={RegisterScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;