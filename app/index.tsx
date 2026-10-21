import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { AppConfig } from '../constants/config';
import { DeviceApiService } from '../services/DeviceApiService';

export default function DeviceSetupScreen() {
  const router = useRouter();
  const [setupCode, setSetupCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingInitialState, setCheckingInitialState] = useState(true);

  // Check if device is already activated
  useEffect(() => {
    const checkActivation = async () => {
      try {
        const token = await DeviceApiService.getStoredToken();
        if (token) {
          router.replace('/attendance-home' as any);
          return;
        }
      } catch (err) {
        console.warn('Initial token check error:', err);
      } finally {
        setCheckingInitialState(false);
      }
    };

    checkActivation();
  }, []);

  const handleConnectDevice = async () => {
    if (!setupCode.trim()) {
      Alert.alert('Activation Code Required', 'Please enter the 6-character setup code.');
      return;
    }

    setLoading(true);
    try {
      const result = await DeviceApiService.activateDevice(setupCode.trim());
      console.log('✅ Device Activated:', result);

      router.replace({
        pathname: '/setup-success' as any,
        params: {
          deviceName: deviceName.trim() || result.deviceName,
          organisationName: result.organisationName,
        },
      });
    } catch (error: any) {
      console.error('Device activation error:', error);
      Alert.alert(
        'Activation Failed',
        error?.message || 'Could not verify activation code with server. Please check the code and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingInitialState) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Brand Header with Official Logo Banner */}
          <View style={styles.header}>
            <Image
              source={require('../assets/images/nationskills-logo.png')}
              style={styles.logoBanner}
              resizeMode="contain"
            />
            <Text style={styles.appSubtitle}>Attendance Device Setup</Text>
          </View>

          {/* Setup Card */}
          <View style={styles.setupCard}>
            <Text style={styles.cardHeading}>Set up this device for your organisation</Text>

            {/* Field: Setup Code */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Setup Code</Text>
              <View style={styles.codeRow}>
                <TextInput
                  style={styles.codeInput}
                  value={setupCode}
                  onChangeText={(text) => setSetupCode(text.toUpperCase())}
                  placeholder="A B C D 1 2"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                  maxLength={12}
                />
              </View>
            </View>

            {/* Field: Device Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Device Name</Text>
              <TextInput
                style={styles.textInput}
                value={deviceName}
                onChangeText={setDeviceName}
                placeholder="e.g. Attendance Tablet"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Action Button: Connect Device */}
            <TouchableOpacity
              style={[styles.connectButton, loading && styles.buttonDisabled]}
              onPress={handleConnectDevice}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={Colors.textWhite} />
              ) : (
                <Text style={styles.connectButtonText}>Connect Device</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              Setup code provided by your organisation administrator.
            </Text>

            {/* Developer Testing Bypass (Never get locked out during UI testing) */}
            <TouchableOpacity
              style={styles.devBypassBtn}
              onPress={async () => {
                await DeviceApiService.saveToken('test_dev_device_token');
                router.replace('/attendance-home' as any);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="developer-mode" size={16} color={Colors.textSecondary} />
              <Text style={styles.devBypassText}>Test Mode: Skip to Scanner & Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBanner: {
    width: 220,
    height: 60,
    marginBottom: 8,
  },
  appSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  setupCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    gap: 20,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  codeRow: {
    flexDirection: 'row',
  },
  codeInput: {
    flex: 1,
    height: 56,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 4,
  },
  textInput: {
    height: 52,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    fontSize: 15,
    color: Colors.text,
  },
  connectButton: {
    height: 54,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  footerNote: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  devBypassBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
    gap: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSubtle,
  },
  devBypassText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
