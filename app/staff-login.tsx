import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/theme';
import { SoundService } from '../services/SoundService';
import { DeviceApiService } from '../services/DeviceApiService';

export default function StaffLoginScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isTablet = Math.min(screenWidth, screenHeight) >= 600 || screenWidth >= 600;

  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleKeyPress = (num: string) => {
    if (verifying) return;
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      setErrorMessage('');
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}

      // Auto-submit once 6 digits are reached
      if (newPin.length === 6) {
        verifyStaffPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (verifying) return;
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMessage('');
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  };

  const verifyStaffPin = async (completedPin: string) => {
    if (verifying || completedPin.length < 4) return;
    setVerifying(true);
    setErrorMessage('');

    try {
      console.log(`🔒 [StaffLogin] Verifying staff PIN against backend...`);
      const res = await DeviceApiService.verifyStaffPin({
        pin: completedPin,
        purpose: 'LOCATION_SWITCH',
      });

      if (res.verified) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          SoundService.playSuccess();
        } catch {}

        router.replace('/staff-dashboard' as any);
      } else {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          SoundService.playError();
        } catch {}
        setErrorMessage(res.message || 'Incorrect staff PIN. Try again.');
        setPin('');
      }
    } catch (err: any) {
      console.error('❌ [StaffLogin] Verification error:', err);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        SoundService.playError();
      } catch {}
      setErrorMessage(err?.message || 'Server error verifying staff PIN.');
      setPin('');
    } finally {
      setVerifying(false);
    }
  };

  const canSubmit = pin.length >= 4 && !verifying;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isTablet && styles.tabletContainer]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          disabled={verifying}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.headerBox}>
          <View style={styles.lockIconContainer}>
            <MaterialIcons name="admin-panel-settings" size={32} color={Colors.primary} />
          </View>
          <Text style={[styles.title, isTablet && styles.tabletTitle]}>Staff Access</Text>
          <Text style={[styles.subText, isTablet && styles.tabletSubText]}>
            Enter authorized staff or instructor PIN
          </Text>
        </View>

        {/* 6-dot indicator */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const isFilled = index < pin.length;
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  isTablet && styles.tabletDot,
                  isFilled && styles.dotFilled,
                ]}
              />
            );
          })}
        </View>

        {/* Status / Error or Verifying Loader */}
        <View style={styles.statusBox}>
          {verifying ? (
            <View style={styles.verifyingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.verifyingText}>Verifying PIN with server...</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.errorRow}>
              <MaterialIcons name="error-outline" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : (
            <Text style={styles.hintText}>
              {pin.length >= 4 ? 'Tap checkmark to confirm or enter all 6 digits' : ' '}
            </Text>
          )}
        </View>

        {/* Numeric Dialpad */}
        <View style={[styles.dialpad, isTablet && styles.tabletDialpad]}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
            <View key={rIdx} style={styles.dialpadRow}>
              {row.map((digit) => (
                <TouchableOpacity
                  key={digit}
                  style={[styles.keyBtn, isTablet && styles.tabletKeyBtn]}
                  onPress={() => handleKeyPress(digit)}
                  activeOpacity={0.7}
                  disabled={verifying}
                >
                  <Text style={[styles.keyText, isTablet && styles.tabletKeyText]}>{digit}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          <View style={styles.dialpadRow}>
            {/* Submit checkmark button if >= 4 digits entered */}
            {canSubmit ? (
              <TouchableOpacity
                style={[styles.keyBtn, styles.submitKeyBtn, isTablet && styles.tabletKeyBtn]}
                onPress={() => verifyStaffPin(pin)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="check" size={isTablet ? 32 : 28} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <View style={[styles.keyPlaceholder, isTablet && styles.tabletKeyPlaceholder]} />
            )}

            <TouchableOpacity
              style={[styles.keyBtn, isTablet && styles.tabletKeyBtn]}
              onPress={() => handleKeyPress('0')}
              activeOpacity={0.7}
              disabled={verifying}
            >
              <Text style={[styles.keyText, isTablet && styles.tabletKeyText]}>0</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.keyBtn, isTablet && styles.tabletKeyBtn]}
              onPress={handleBackspace}
              activeOpacity={0.7}
              disabled={verifying || pin.length === 0}
            >
              <MaterialIcons
                name="backspace"
                size={isTablet ? 28 : 24}
                color={pin.length === 0 ? Colors.border : Colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => router.back()}
          disabled={verifying}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
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
    padding: 24,
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  tabletContainer: {
    maxWidth: 520,
    paddingVertical: 36,
  },
  backBtn: {
    alignSelf: 'flex-start',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBox: {
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  lockIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  tabletTitle: {
    fontSize: 28,
  },
  subText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  tabletSubText: {
    fontSize: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 20,
    marginVertical: 16,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  tabletDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusBox: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifyingText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  dialpad: {
    width: '100%',
    gap: 16,
    marginVertical: 12,
  },
  tabletDialpad: {
    maxWidth: 460,
    gap: 20,
  },
  dialpadRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  keyBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  tabletKeyBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  submitKeyBtn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  keyText: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
  },
  tabletKeyText: {
    fontSize: 32,
  },
  keyPlaceholder: {
    width: 72,
    height: 72,
  },
  tabletKeyPlaceholder: {
    width: 88,
    height: 88,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});
