import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/theme';
import { SoundService } from '../services/SoundService';

export default function StaffLoginScreen() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      setErrorMessage('');
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}

      if (newPin.length === 6 || (newPin.length === 4 && (newPin === '1234' || newPin === '0000'))) {
        verifyStaffPin(newPin);
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

  const verifyStaffPin = (completedPin: string) => {
    // Accepted staff PINs for testing: any 4-6 digit PIN (e.g. 2255, 1234, 0000)
    if (completedPin.length >= 4) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        SoundService.playSuccess();
      } catch {}

      router.replace('/staff-dashboard' as any);
    } else {
      setErrorMessage('Incorrect staff PIN. Try again.');
      setPin('');
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        SoundService.playError();
      } catch {}
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.headerBox}>
          <Text style={styles.title}>Staff Access</Text>
          <Text style={styles.subText}>Enter attendance admin PIN</Text>
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
        ) : (
          <View style={{ height: 20 }} />
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
                  activeOpacity={0.7}
                >
                  <Text style={styles.keyText}>{digit}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          <View style={styles.dialpadRow}>
            <View style={styles.keyPlaceholder} />
            <TouchableOpacity
              style={styles.keyBtn}
              onPress={() => handleKeyPress('0')}
              activeOpacity={0.7}
            >
              <Text style={styles.keyText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.keyBtn}
              onPress={handleBackspace}
              activeOpacity={0.7}
            >
              <MaterialIcons name="backspace" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
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
  headerBox: {
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  subText: {
    fontSize: 14,
    color: Colors.textSecondary,
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
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    fontWeight: '600',
    height: 20,
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
    shadowOpacity: 0.04,
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
