import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
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
  const [pin, setPin] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [orgName, setOrgName] = useState('');
  const [activeLocation, setActiveLocation] = useState('');
  const [successData, setSuccessData] = useState<SuccessState | null>(null);

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
  }, []);

  const handleKeyPress = (num: string) => {
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
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMessage('');
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  };

  const submitPin = async (completedPin: string) => {
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

  const handleReturnToReady = () => {
    setSuccessData(null);
    router.replace('/attendance-home' as any);
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
          autoCloseDurationMs={2800}
          onDismiss={handleReturnToReady}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header with NationSkills Logo */}
        <KioskBrandHeader
          subtitle="Attendance Kiosk"
          showBack
          onBack={handleReturnToReady}
        />

        {/* Location & Context Subtitle */}
        <View style={styles.subHeaderBox}>
          {orgName ? <Text style={styles.subHeaderOrg}>{orgName}</Text> : null}
          <Text style={styles.subHeaderLoc}>
            {activeLocation ? `${activeLocation} • PIN Attendance` : 'PIN Attendance'}
          </Text>
        </View>

        {/* 6-dot indicator */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const isFilled = index < pin.length;
            return (
              <View
                key={index}
                style={[styles.dot, isFilled && styles.dotFilled]}
              />
            );
          })}
        </View>

        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : processing ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.verifyingText}>Verifying PIN...</Text>
          </View>
        ) : (
          <Text style={styles.subText}>Enter your 6-digit student membership PIN</Text>
        )}

        {/* Numeric Dialpad */}
        <View style={styles.dialpad}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
            <View key={rIdx} style={styles.dialpadRow}>
              {row.map((digit) => (
                <TouchableOpacity
                  key={digit}
                  style={styles.keyBtn}
                  onPress={() => handleKeyPress(digit)}
                  disabled={processing}
                  activeOpacity={0.7}
                >
                  <Text style={styles.keyText}>{digit}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* Bottom Dialpad Row */}
          <View style={styles.dialpadRow}>
            <TouchableOpacity
              style={styles.keyBtnSecondary}
              onPress={() => {
                setPin('');
                setErrorMessage('');
              }}
              disabled={processing || pin.length === 0}
              activeOpacity={0.7}
            >
              <Text style={styles.keyTextSecondary}>Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.keyBtn}
              onPress={() => handleKeyPress('0')}
              disabled={processing}
              activeOpacity={0.7}
            >
              <Text style={styles.keyText}>0</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.keyBtnSecondary}
              onPress={handleBackspace}
              disabled={processing || pin.length === 0}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name="backspace"
                size={22}
                color={pin.length > 0 ? Colors.text : Colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelPillBtn}
          onPress={handleReturnToReady}
          activeOpacity={0.8}
        >
          <MaterialIcons name="close" size={18} color="#64748B" />
          <Text style={styles.cancelPillBtnText}>Cancel</Text>
        </TouchableOpacity>
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
});
