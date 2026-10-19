import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/theme';
import { DeviceApiService } from '../services/DeviceApiService';
import { SoundService } from '../services/SoundService';

export default function PinAttendanceScreen() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
      const eligibility = await DeviceApiService.checkEligibility('PIN', completedPin);

      if (eligibility.status === 'CHECK_IN' && eligibility.classSessionId) {
        const requestId = DeviceApiService.generateRequestId();
        await DeviceApiService.checkIn({
          method: 'PIN',
          code: completedPin,
          classSessionId: eligibility.classSessionId,
          requestId,
        });

        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          SoundService.playSuccess();
        } catch {}

        alert(`Checked in successfully! Welcome ${eligibility.studentName || 'Student'}`);
        router.back();
      } else {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          SoundService.playError();
        } catch {}
        setErrorMessage(eligibility.message || 'Invalid PIN or no eligible session.');
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <Text style={styles.title}>Enter your PIN</Text>

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
            <View style={styles.keyPlaceholder} />
            <TouchableOpacity
              style={styles.keyBtn}
              onPress={() => handleKeyPress('0')}
              disabled={processing}
              activeOpacity={0.7}
            >
              <Text style={styles.keyText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.keyBtn}
              onPress={handleBackspace}
              disabled={processing}
              activeOpacity={0.7}
            >
              <MaterialIcons name="backspace" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => router.back()}
          disabled={processing}
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
  backBtn: {
    alignSelf: 'flex-start',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginVertical: 20,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  subText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    height: 24,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    fontWeight: '600',
    textAlign: 'center',
    height: 24,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 24,
  },
  verifyingText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  dialpad: {
    width: '100%',
    gap: 16,
    marginVertical: 12,
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
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  keyText: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
  },
  keyPlaceholder: {
    width: 72,
    height: 72,
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
