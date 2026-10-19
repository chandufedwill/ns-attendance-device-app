import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

export default function SetupSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deviceName?: string; organisationName?: string }>();

  const deviceName = params.deviceName || 'Attendance Device';
  const organisationName = params.organisationName || '';

  const handleContinue = () => {
    // Navigate to Screen 3: Select Location
    router.replace('/select-location' as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.card}>
          {/* Green Check Badge */}
          <View style={styles.checkCircle}>
            <MaterialIcons name="check" size={54} color={Colors.textWhite} />
          </View>

          <Text style={styles.title}>Device connected</Text>

          <View style={styles.infoBox}>
            {organisationName ? <Text style={styles.orgName}>{organisationName}</Text> : null}
            <Text style={styles.deviceName}>{deviceName}</Text>
          </View>

          <Text style={styles.subtitle}>This device is ready to record attendance.</Text>

          {/* Continue Button */}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: Colors.cardBackground,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    gap: 16,
  },
  checkCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  infoBox: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  orgName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  deviceName: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  continueButton: {
    width: '100%',
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
});
