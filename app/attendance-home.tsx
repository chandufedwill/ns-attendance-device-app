import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/theme';
import { AppConfig } from '../constants/config';
import { DeviceApiService } from '../services/DeviceApiService';
import { KioskBrandHeader } from '../components/KioskBrandHeader';
import { KioskService } from '../services/KioskService';

export default function AttendanceHomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ locationName?: string }>();
  const [activeLocation, setActiveLocation] = useState(params.locationName || '');
  const [orgName, setOrgName] = useState('');
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    KioskService.init();

    const loadData = async () => {
      setLoading(true);
      try {
        const config = await DeviceApiService.getDeviceConfig().catch(() => null);
        if (config?.organisationName) {
          setOrgName(config.organisationName);
        }
        if (config?.deviceName) {
          setDeviceName(config.deviceName);
        }
        if (config?.organisationLogoUrl) {
          setOrgLogoUrl(config.organisationLogoUrl);
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
        console.warn('Failed loading home config:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [params.locationName]);

  // Formatted date string (e.g. "Today • Friday 16 Oct 2026")
  const todayFormatted = (() => {
    try {
      const d = new Date();
      const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
      const day = d.getDate();
      const month = d.toLocaleDateString('en-GB', { month: 'short' });
      const year = d.getFullYear();
      return `Today • ${weekday} ${day} ${month} ${year}`;
    } catch {
      return 'Today';
    }
  })();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Screen 1: Top Brand Header */}
        <KioskBrandHeader
          subtitle="Attendance Kiosk"
          showSettings
          onSettings={() => router.push('/staff-login' as any)}
        />

        <ScrollView
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
        >
          {/* Organisation & Location Card */}
          <TouchableOpacity
            style={styles.orgCard}
            onPress={() => router.push('/select-location' as any)}
            activeOpacity={0.8}
          >
            {/* Org Logo / Icon */}
            <View style={styles.orgLogoBox}>
              {orgLogoUrl && !logoFailed ? (
                <Image
                  source={{ uri: orgLogoUrl }}
                  style={styles.orgLogoImage}
                  onError={() => setLogoFailed(true)}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.orgLogoFallback}>
                  <MaterialIcons name="fitness-center" size={24} color="#BE185D" />
                </View>
              )}
            </View>

            {/* Org Details */}
            <View style={styles.orgDetailsCol}>
              <Text style={styles.orgNameText} numberOfLines={1}>
                {orgName || 'NationSkills Partner'}
              </Text>
              <View style={styles.orgLocationRow}>
                <MaterialIcons name="location-on" size={15} color="#0D9488" />
                <Text style={styles.orgLocationText} numberOfLines={1}>
                  {activeLocation || 'Attendance Station'}
                </Text>
              </View>
            </View>

            <MaterialIcons name="chevron-right" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Date Subtitle */}
          <Text style={styles.dateLabel}>{todayFormatted}</Text>

          {/* Ready For Attendance Heading Banner */}
          <View style={styles.readyBanner}>
            <View style={styles.readyIconCircle}>
              <MaterialIcons name="groups" size={22} color="#0F766E" />
            </View>
            <View style={styles.readyTextCol}>
              <Text style={styles.readyTitle}>Ready for Attendance</Text>
              <Text style={styles.readySubtitle}>Choose how you want to check in</Text>
            </View>
          </View>

          {/* Option 1: Scan QR Code (Deep Teal) */}
          <TouchableOpacity
            style={styles.qrOptionCard}
            onPress={() => router.push('/scanner' as any)}
            activeOpacity={0.85}
          >
            <View style={styles.qrIconBox}>
              <MaterialIcons name="qr-code-2" size={32} color="#FFFFFF" />
            </View>
            <View style={styles.optionTextCol}>
              <Text style={styles.qrOptionTitle}>Scan QR Code</Text>
              <Text style={styles.qrOptionSubtitle}>
                Scan your member QR code to mark attendance
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Option 2: Enter PIN */}
          <TouchableOpacity
            style={styles.pinOptionCard}
            onPress={() => router.push('/pin-attendance' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.pinIconBox}>
              <MaterialIcons name="dialpad" size={26} color="#0D3838" />
            </View>
            <View style={styles.optionTextCol}>
              <Text style={styles.pinOptionTitle}>Enter PIN</Text>
              <Text style={styles.pinOptionSubtitle}>
                Enter your 6-digit PIN to mark attendance
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Option 3: Face Recognition (Coming Soon) */}
          <View style={styles.faceOptionCard}>
            <View style={styles.faceIconBox}>
              <MaterialIcons name="face" size={26} color="#94A3B8" />
            </View>
            <View style={styles.optionTextCol}>
              <Text style={styles.faceOptionTitle}>Face Recognition</Text>
              <Text style={styles.faceOptionSubtitle}>Coming soon</Text>
            </View>
          </View>

          {/* Bottom Help Card */}
          <View style={styles.helpCard}>
            <MaterialIcons name="info-outline" size={20} color="#64748B" />
            <View style={styles.helpTextCol}>
              <Text style={styles.helpTitle}>Need help?</Text>
              <Text style={styles.helpSubtitle}>Ask an instructor for assistance.</Text>
            </View>
          </View>
        </ScrollView>
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
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
  },
  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  orgLogoBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDF2F8',
  },
  orgLogoImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  orgLogoFallback: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgDetailsCol: {
    flex: 1,
  },
  orgNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  orgLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  orgLocationText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginVertical: 2,
  },
  readyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  readyIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E6F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyTextCol: {
    flex: 1,
  },
  readyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  readySubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  qrOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D3838', // Deep teal from Jovin blueprint
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 14,
    shadowColor: '#0D3838',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  qrIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextCol: {
    flex: 1,
  },
  qrOptionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  qrOptionSubtitle: {
    fontSize: 12,
    color: '#D1E7E7',
    fontWeight: '500',
    marginTop: 3,
    lineHeight: 16,
  },
  pinOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  pinIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E6F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinOptionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  pinOptionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16,
  },
  faceOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
    opacity: 0.65,
  },
  faceIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  faceOptionSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 2,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    marginTop: 4,
  },
  helpTextCol: {
    flex: 1,
  },
  helpTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  helpSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
});
