import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/theme';
import { AppConfig } from '../constants/config';
import { DeviceApiService } from '../services/DeviceApiService';
import { SoundService } from '../services/SoundService';
import { KioskBrandHeader } from '../components/KioskBrandHeader';
import { CheckInSuccessView } from '../components/CheckInSuccessView';

interface SuccessState {
  studentName: string;
  profileImageUrl?: string | null;
  className: string;
  locationName: string;
  checkInTime: string;
}

export default function PinAttendanceScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isTablet = Math.min(screenWidth, screenHeight) >= 600 || screenWidth >= 600;

  const [pin, setPin] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [orgName, setOrgName] = useState('');
  const [activeLocation, setActiveLocation] = useState('');
  const [successData, setSuccessData] = useState<SuccessState | null>(null);

  // Inactivity / Idle return timer (25s grace period as requested by Jovin)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleReturnToReady = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setPin('');
    setErrorMessage('');
    setSuccessData(null);
    router.replace('/attendance-home' as any);
  }, [router]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      console.log('⏱️ [PIN Attendance] Inactivity timeout (30s) reached. Returning to Home.');
      handleReturnToReady();
    }, 30000);
  }, [handleReturnToReady]);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const config = await DeviceApiService.getDeviceConfig().catch(() => null);
        if (config?.organisationName) setOrgName(config.organisationName);
        if (config?.locationName) setActiveLocation(config.locationName);

        const stored = await SecureStore.getItemAsync(AppConfig.STORAGE_KEYS.ACTIVE_LOCATION);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.locationName) setActiveLocation(parsed.locationName);
        }
      } catch {}
    };
    loadMetadata();
    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  const handleKeyPress = (num: string) => {
    resetIdleTimer();
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      setErrorMessage('');
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}

      if (newPin.length === 6) {
        submitPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    resetIdleTimer();
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMessage('');
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  };

  const submitPin = async (completedPin: string) => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setProcessing(true);
    try {
      console.log(`\n🔑 [PIN Attendance] Identifying via PIN: [${completedPin}]`);
      const eligibility = await DeviceApiService.checkEligibility('PIN', completedPin);
      console.log('📡 [PIN Attendance] Eligibility Result:', eligibility);

      if (eligibility.status === 'CHECK_IN' && eligibility.classSessionId) {
        const requestId = DeviceApiService.generateRequestId();
        const checkInRes = await DeviceApiService.checkIn({
          method: 'PIN',
          code: completedPin,
          classSessionId: eligibility.classSessionId,
          requestId,
        });

        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          SoundService.playSuccess();
        } catch {}

        // Show Screen 3: Check-In Successful
        setSuccessData({
          studentName: checkInRes.studentName || eligibility.studentName || 'Student Member',
          profileImageUrl: checkInRes.profileImageUrl || eligibility.profileImageUrl,
          className: checkInRes.className || eligibility.className || 'Class Session',
          locationName: activeLocation || orgName || 'Attendance Station',
          checkInTime: checkInRes.checkInTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      } else {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          SoundService.playError();
        } catch {}

        let msg = eligibility.message || 'Invalid PIN or no eligible active session.';
        if (eligibility.status === 'NO_SESSION' && eligibility.studentName) {
          msg = `Hi ${eligibility.studentName}, no active sessions scheduled right now.`;
        } else if ((eligibility.status === 'TOO_EARLY' || eligibility.status === 'CHECKIN_CLOSED') && eligibility.studentName) {
          msg = `Hi ${eligibility.studentName}, outside permitted check-in window for ${eligibility.className || 'session'}.`;
        } else if (eligibility.status === 'ALREADY_CHECKED_IN') {
          msg = `Already checked in for ${eligibility.className || 'this session'}.`;
        } else if (eligibility.status === 'ALREADY_ATTENDED') {
          msg = `Attendance already completed for ${eligibility.className || 'today'}.`;
        }

        setErrorMessage(msg);
        setPin('');
      }
    } catch (err: any) {
      try {
        SoundService.playError();
      } catch {}
      setErrorMessage(err?.message || 'Could not verify student PIN.');
      setPin('');
    } finally {
      setProcessing(false);
    }
  };

  // If check-in successful, show Screen 3 CheckInSuccessView
  if (successData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <CheckInSuccessView
          studentName={successData.studentName}
          profileImageUrl={successData.profileImageUrl}
          className={successData.className}
          locationName={successData.locationName}
          checkInTime={successData.checkInTime}
          autoCloseDurationMs={3200}
          onDismiss={handleReturnToReady}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isTablet && styles.containerTablet]}>
        {/* Top Header with NationSkills Logo */}
        <KioskBrandHeader
          subtitle="Attendance Kiosk"
          showBack
          onBack={handleReturnToReady}
        />

        {/* Center Content Area: Vertically centers naturally on tall tablet screens */}
        <View style={[styles.keypadBodyWrapper, isTablet && styles.keypadBodyWrapperTablet]}>
          {/* Location & Context Subtitle */}
          <View style={[styles.subHeaderBox, isTablet && styles.subHeaderBoxTablet]}>
            {orgName ? <Text style={[styles.subHeaderOrg, isTablet && styles.subHeaderOrgTablet]}>{orgName}</Text> : null}
            <Text style={[styles.subHeaderLoc, isTablet && styles.subHeaderLocTablet]}>
              {activeLocation ? `${activeLocation} • PIN Attendance` : 'PIN Attendance'}
            </Text>
          </View>

          {/* 6-dot indicator */}
          <View style={[styles.dotsRow, isTablet && styles.dotsRowTablet]}>
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const isFilled = index < pin.length;
              return (
                <View
                  key={index}
                  style={[styles.dot, isTablet && styles.dotTablet, isFilled && styles.dotFilled]}
                />
              );
            })}
          </View>

          {errorMessage ? (
            <Text style={[styles.errorText, isTablet && styles.errorTextTablet]}>{errorMessage}</Text>
          ) : processing ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={[styles.verifyingText, isTablet && styles.verifyingTextTablet]}>Verifying PIN...</Text>
            </View>
          ) : (
            <Text style={[styles.subText, isTablet && styles.subTextTablet]}>Enter your 6-digit student membership PIN</Text>
          )}

          {/* Numeric Dialpad */}
          <View style={[styles.dialpad, isTablet && styles.dialpadTablet]}>
            {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
              <View key={rIdx} style={[styles.dialpadRow, isTablet && styles.dialpadRowTablet]}>
                {row.map((digit) => (
                  <TouchableOpacity
                    key={digit}
                    style={[styles.keyBtn, isTablet && styles.keyBtnTablet]}
                    onPress={() => handleKeyPress(digit)}
                    disabled={processing}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.keyText, isTablet && styles.keyTextTablet]}>{digit}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Bottom Dialpad Row */}
            <View style={[styles.dialpadRow, isTablet && styles.dialpadRowTablet]}>
              <TouchableOpacity
                style={[styles.keyBtnSecondary, isTablet && styles.keyBtnSecondaryTablet]}
                onPress={() => {
                  setPin('');
                  setErrorMessage('');
                }}
                disabled={processing || pin.length === 0}
                activeOpacity={0.7}
              >
                <Text style={[styles.keyTextSecondary, isTablet && styles.keyTextSecondaryTablet]}>Clear</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.keyBtn, isTablet && styles.keyBtnTablet]}
                onPress={() => handleKeyPress('0')}
                disabled={processing}
                activeOpacity={0.7}
              >
                <Text style={[styles.keyText, isTablet && styles.keyTextTablet]}>0</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.keyBtnSecondary, isTablet && styles.keyBtnSecondaryTablet]}
                onPress={handleBackspace}
                disabled={processing || pin.length === 0}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name="backspace"
                  size={isTablet ? 30 : 22}
                  color={pin.length > 0 ? Colors.text : Colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={[styles.cancelPillBtn, isTablet && styles.cancelPillBtnTablet]}
            onPress={handleReturnToReady}
            activeOpacity={0.8}
          >
            <MaterialIcons name="close" size={isTablet ? 22 : 18} color="#64748B" />
            <Text style={[styles.cancelPillBtnText, isTablet && styles.cancelPillBtnTextTablet]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  keypadBodyWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadBodyWrapperTablet: {
    paddingVertical: 12,
  },
  subHeaderBox: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  subHeaderOrg: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  subHeaderLoc: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
    justifyContent: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#0D3838',
    borderColor: '#0D3838',
  },
  subText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  verifyingText: {
    fontSize: 13,
    color: '#0D3838',
    fontWeight: '600',
  },
  dialpad: {
    width: '100%',
    maxWidth: 320,
    gap: 12,
    marginBottom: 24,
  },
  dialpadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  keyBtn: {
    flex: 1,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  keyBtnSecondary: {
    flex: 1,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyTextSecondary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  cancelPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cancelPillBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 'auto',
    marginBottom: 8,
  },
  demoPinPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E6F4F4',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  demoPinPillBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D9488',
  },
  // Tablet specific scaling rules
  containerTablet: {
    maxWidth: 620,
    paddingHorizontal: 36,
  },
  subHeaderBoxTablet: {
    marginTop: 18,
    marginBottom: 32,
  },
  subHeaderOrgTablet: {
    fontSize: 24,
  },
  subHeaderLocTablet: {
    fontSize: 16,
    marginTop: 4,
  },
  dotsRowTablet: {
    gap: 20,
    marginBottom: 24,
  },
  dotTablet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
  },
  subTextTablet: {
    fontSize: 16,
    marginBottom: 36,
  },
  errorTextTablet: {
    fontSize: 16,
    marginBottom: 36,
  },
  verifyingTextTablet: {
    fontSize: 16,
  },
  dialpadTablet: {
    maxWidth: 540,
    gap: 18,
    marginBottom: 28,
  },
  dialpadRowTablet: {
    gap: 18,
  },
  keyBtnTablet: {
    height: 94,
    borderRadius: 24,
  },
  keyTextTablet: {
    fontSize: 38,
  },
  keyBtnSecondaryTablet: {
    height: 94,
    borderRadius: 24,
  },
  keyTextSecondaryTablet: {
    fontSize: 20,
  },
  cancelPillBtnTablet: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    marginTop: 8,
  },
  cancelPillBtnTextTablet: {
    fontSize: 18,
  },
});
