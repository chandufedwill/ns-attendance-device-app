import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { KioskBrandHeader } from './KioskBrandHeader';

interface CheckInSuccessViewProps {
  studentName?: string;
  profileImageUrl?: string | null;
  className?: string;
  locationName?: string;
  checkInTime?: string;
  onDismiss: () => void;
  autoCloseDurationMs?: number;
}

export function CheckInSuccessView({
  studentName = 'Student Member',
  profileImageUrl,
  className = 'General Session',
  locationName = 'Active Location',
  checkInTime,
  onDismiss,
  autoCloseDurationMs = 2800,
}: CheckInSuccessViewProps) {
  const [imageFailed, setImageFailed] = React.useState(false);
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Extract initials for fallback avatar
  const getInitials = (nameStr: string) => {
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameStr.substring(0, 2).toUpperCase();
  };

  const getFirstName = (nameStr: string) => {
    const parts = nameStr.trim().split(/\s+/);
    return parts[0] || 'Student';
  };

  const initials = getInitials(studentName);
  const firstName = getFirstName(studentName);

  // Formatted date string (e.g. "Fri 16 Oct 2026 • 5:56 PM")
  const dateFormatted = (() => {
    try {
      const now = new Date();
      const datePart = now.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const timePart = checkInTime || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${datePart} • ${timePart}`;
    } catch {
      return 'Today • Recorded';
    }
  })();

  useEffect(() => {
    // Pop-in animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: autoCloseDurationMs,
      useNativeDriver: false,
    }).start();

    // Auto-dismiss timer
    const timer = setTimeout(() => {
      onDismiss();
    }, autoCloseDurationMs);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <KioskBrandHeader subtitle="Attendance Kiosk" />

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={{ opacity: opacityAnim, transform: [{ scale: scaleAnim }], width: '100%' }}
      >
        {/* Success Icon & Heading */}
        <View style={styles.successHeadingBlock}>
          {/* Confetti / Sparkle Accents */}
          <View style={styles.sparkleRow}>
            <View style={[styles.sparkleDot, { top: -4, left: 18 }]} />
            <View style={[styles.sparkleDot, { top: 6, right: 14, width: 8, height: 8 }]} />
            <View style={[styles.sparkleDiamond, { top: -10, right: 28 }]} />
            <View style={[styles.sparkleDiamond, { bottom: 0, left: 10 }]} />

            <View style={styles.bigCheckCircle}>
              <MaterialIcons name="check" size={44} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.mainTitle}>Checked in successfully!</Text>
        </View>

        {/* Member Card */}
        <View style={styles.memberCard}>
          {/* Profile Photo / Avatar */}
          <View style={styles.avatarContainer}>
            {profileImageUrl && !imageFailed ? (
              <Image
                source={{ uri: profileImageUrl }}
                style={styles.avatarImage}
                onError={() => setImageFailed(true)}
              />
            ) : (
              <View style={styles.avatarFallback}>
                {initials ? (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                ) : (
                  <MaterialIcons name="person" size={38} color={Colors.primary} />
                )}
              </View>
            )}
          </View>

          {/* Student Name & Class */}
          <Text style={styles.studentNameText} numberOfLines={1}>
            {studentName}
          </Text>
          <Text style={styles.classNameText} numberOfLines={1}>
            {className}
          </Text>

          {/* Date & Time Row Card */}
          <View style={styles.detailRowCard}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="calendar-today" size={18} color="#0F766E" />
            </View>
            <View style={styles.detailTextCol}>
              <Text style={styles.detailLabel}>Date & Time</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {dateFormatted}
              </Text>
            </View>
          </View>

          {/* Location Row Card */}
          <View style={styles.detailRowCard}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="location-on" size={20} color="#0F766E" />
            </View>
            <View style={styles.detailTextCol}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {locationName}
              </Text>
            </View>
          </View>

          {/* Bottom Green Status Pill */}
          <View style={styles.recordedBanner}>
            <View style={styles.recordedCheckCircle}>
              <MaterialIcons name="check" size={16} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recordedTitle}>Attendance recorded</Text>
              <Text style={styles.recordedSubtitle}>Welcome, {firstName}!</Text>
            </View>
          </View>
        </View>

        {/* Auto Return Indicator & Manual Dismiss */}
        <TouchableOpacity
          style={styles.dismissPill}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissPillText}>Returning to Home...</Text>
          <View style={styles.progressBarBg}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </TouchableOpacity>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  successHeadingBlock: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  sparkleRow: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 12,
  },
  bigCheckCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  sparkleDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
    opacity: 0.8,
  },
  sparkleDiamond: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#6EE7B7',
    transform: [{ rotate: '45deg' }],
    opacity: 0.8,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  memberCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    gap: 12,
  },
  avatarContainer: {
    marginBottom: 4,
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: '#E2E8F0',
  },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#E6F4F4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0D3838',
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0D3838',
  },
  studentNameText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  classNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 4,
  },
  detailRowCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTextCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  recordedBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 4,
  },
  recordedCheckCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  recordedSubtitle: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '500',
    marginTop: 1,
  },
  dismissPill: {
    marginTop: 18,
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
  },
  dismissPillText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 6,
  },
  progressBarBg: {
    width: 140,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
});
