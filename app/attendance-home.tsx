import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/theme';
import { AppConfig } from '../constants/config';
import { ClassSessionSummary } from '../types/attendance';
import { DeviceApiService } from '../services/DeviceApiService';

export default function AttendanceHomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ locationName?: string }>();
  const [activeLocation, setActiveLocation] = useState(params.locationName || '');
  const [orgName, setOrgName] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [sessions, setSessions] = useState<ClassSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load configuration (organisation name, location, device name)
        const config = await DeviceApiService.getDeviceConfig().catch(() => null);
        if (config?.organisationName) {
          setOrgName(config.organisationName);
        }
        if (config?.deviceName) {
          setDeviceName(config.deviceName);
        }

        const storedLocation = await SecureStore.getItemAsync(AppConfig.STORAGE_KEYS.ACTIVE_LOCATION);
        if (storedLocation) {
          const parsed = JSON.parse(storedLocation);
          if (parsed?.locationName) {
            setActiveLocation(parsed.locationName);
          }
        } else if (config?.locationName) {
          setActiveLocation(config.locationName);
        }
      } catch (err) {
        console.warn('Failed loading home data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View style={{ width: 40 }} />
          <View style={styles.brandCenter}>
            <Text style={styles.brandTitle}>NationSkills</Text>
            {orgName ? <Text style={styles.brandSubtitle}>{orgName}</Text> : null}
            {deviceName ? (
              <View style={styles.deviceChipRow}>
                <MaterialIcons name="tablet-android" size={13} color={Colors.primary} />
                <Text style={styles.deviceChipText}>{deviceName}</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => router.push('/staff-login' as any)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="settings" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {/* Location & Date Card */}
          <View style={styles.locationBanner}>
            <View style={styles.locationRow}>
              <MaterialIcons name="location-on" size={22} color={Colors.primary} />
              <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
                {activeLocation || 'Binley'}
              </Text>
            </View>
            <Text style={styles.dateText}>Today • {todayFormatted}</Text>
          </View>

          {/* Today's Sessions Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Today's sessions</Text>
            {sessions.length > 0 && (
              <View style={styles.sessionCountPill}>
                <Text style={styles.sessionCountText}>{sessions.length} Active</Text>
              </View>
            )}
          </View>

          {loading ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : sessions.length === 0 ? (
            <View style={styles.emptySessionsCard}>
              <MaterialIcons name="event-available" size={32} color={Colors.textSecondary} />
              <Text style={styles.emptySessionsTitle}>Ready to Record Attendance</Text>
              <Text style={styles.emptySessionsSubtitle}>
                No scheduled session limits configured. Tap 'Start Attendance' to scan student QR passes or enter PINs.
              </Text>
            </View>
          ) : (
            <View style={styles.sessionList}>
              {sessions.map((session) => (
                <View key={session.id} style={styles.sessionCard}>
                  <View style={styles.sessionIconBox}>
                    <MaterialIcons name="groups" size={24} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionTitle}>{session.className}</Text>
                    <Text style={styles.sessionTimeText}>
                      {session.startTime} – {session.endTime}
                    </Text>
                    {session.expectedCount !== undefined && (
                      <Text style={styles.sessionMembersText}>
                        {session.expectedCount} members
                      </Text>
                    )}
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color={Colors.textSecondary} />
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.startAttendanceBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/scanner' as any)}
          >
            <MaterialIcons name="qr-code-scanner" size={22} color={Colors.textWhite} />
            <Text style={styles.startAttendanceBtnText}>Start Attendance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.changeLocationBtn}
            onPress={() => router.push('/select-location' as any)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="swap-horiz" size={18} color={Colors.textSecondary} />
            <Text style={styles.changeLocationText}>Change location</Text>
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
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  brandCenter: {
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  brandSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  deviceChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  deviceChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollBody: {
    paddingVertical: 12,
    gap: 16,
  },
  locationBanner: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  liveOnlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  deviceLocationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  dateText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginLeft: 26,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  sessionCountPill: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sessionCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  sessionList: {
    gap: 12,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  sessionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  sessionTimeText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sessionMembersText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  bottomActions: {
    paddingVertical: 16,
    gap: 12,
  },
  startAttendanceBtn: {
    height: 54,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  startAttendanceBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  changeLocationBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 6,
  },
  changeLocationText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptySessionsCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    marginVertical: 8,
  },
  emptySessionsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  emptySessionsSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
