// mobile/src/navigation/AuthNavigator.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen            from '../screens/Auth/LoginScreen';
import RegisterScreen         from '../screens/Auth/RegisterScreen';
import OnboardingScreen       from '../screens/Auth/OnboardingScreen';
import OtpVerificationScreen  from '../screens/Auth/OtpVerificationScreen';
import ForgotPasswordScreen   from '../screens/Auth/ForgotPasswordScreen';

const Stack = createStackNavigator();

const AuthNavigator = () => (
  <Stack.Navigator
    initialRouteName="Login"
    screenOptions={{ headerShown: false }}
  >
    <Stack.Screen name="Login"           component={LoginScreen}           />
    <Stack.Screen name="Register"        component={RegisterScreen}        />
    <Stack.Screen name="Onboarding"      component={OnboardingScreen}      />

    {/*
      ForgotPassword — entered from LoginScreen's "Forgot password?" link.
      Handles both the email form and the post-send success state internally.
    */}
    <Stack.Screen
      name="ForgotPassword"
      component={ForgotPasswordScreen}
      options={{ gestureEnabled: true }}
    />

    {/*
      OtpVerification — pushed by LoginScreen when the backend signals
      requiresOtp: true. It receives { tempToken, method, maskedContact }
      as route.params.
    */}
    <Stack.Screen
      name="OtpVerification"
      component={OtpVerificationScreen}
      options={{ gestureEnabled: false }} // prevent swipe-back bypassing 2FA
    />
  </Stack.Navigator>
);

export default AuthNavigator;