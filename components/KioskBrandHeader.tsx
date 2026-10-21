import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

interface KioskBrandHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  showSettings?: boolean;
  onSettings?: () => void;
  rightComponent?: React.ReactNode;
  subtitle?: string;
  theme?: 'light' | 'dark';
}

export function KioskBrandHeader({
  showBack = false,
  onBack,
  showSettings = false,
  onSettings,
  rightComponent,
  subtitle = 'Attendance Kiosk',
  theme = 'light',
}: KioskBrandHeaderProps) {
  const isDark = theme === 'dark';

  return (
    <View style={styles.headerContainer}>
      {/* Left Slot */}
      <View style={styles.sideSlot}>
        {showBack && onBack ? (
          <TouchableOpacity
            style={[styles.circleBtn, isDark && styles.circleBtnDark]}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons
              name="arrow-back"
              size={22}
              color={isDark ? Colors.textWhite : Colors.text}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Center Brand Badge */}
      <View style={styles.centerSlot}>
        <View style={styles.logoBadgeContainer}>
          <Image
            source={require('../assets/images/nationskills-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        {subtitle ? (
          <Text style={[styles.subtitleText, isDark && styles.subtitleDark]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Right Slot */}
      <View style={[styles.sideSlot, styles.rightSlot]}>
        {rightComponent ? (
          rightComponent
        ) : showSettings && onSettings ? (
          <TouchableOpacity
            style={[styles.circleBtn, isDark && styles.circleBtnDark]}
            onPress={onSettings}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons
              name="settings"
              size={22}
              color={isDark ? Colors.textWhite : Colors.text}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
  },
  sideSlot: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  rightSlot: {
    alignItems: 'flex-end',
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 140,
    height: 44,
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  subtitleDark: {
    color: '#94A3B8',
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleBtnDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
});
