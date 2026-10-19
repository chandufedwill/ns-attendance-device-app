import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={Colors.background} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="setup-success" />
        <Stack.Screen name="select-location" />
        <Stack.Screen name="attendance-home" />
        <Stack.Screen name="scanner" />
        <Stack.Screen name="pin-attendance" />
        <Stack.Screen name="staff-login" />
        <Stack.Screen name="staff-dashboard" />
      </Stack>
    </SafeAreaProvider>
  );
}
