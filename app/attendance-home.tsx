import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/theme';
import { AppConfig } from '../constants/config';
import { DeviceApiService } from '../services/DeviceApiService';
import { KioskBrandHeader } from '../components/KioskBrandHeader';
import { KioskService } from '../services/KioskService';
import { DeviceSettingsService } from '../services/DeviceSettingsService';
import { AttendanceLocation } from '../types/attendance';

// Fast In-Memory Cache to prevent flash of dummy data on remount / back navigation
const memoryCache = {
  orgName: '',
  orgLogoUrl: null as string | null,
  activeLocation: '',
  activeLocationId: '',
  deviceName: '',
};

export default function AttendanceHomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= 600 || width >= 600;
  const params = useLocalSearchParams<{ locationName?: string }>();
  const [activeLocation, setActiveLocation] = useState(params.locationName || memoryCache.activeLocation || '');
  const [activeLocationId, setActiveLocationId] = useState<string>(memoryCache.activeLocationId || '');
  const [orgName, setOrgName] = useState(memoryCache.orgName || '');
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(memoryCache.orgLogoUrl);
  const [logoFailed, setLogoFailed] = useState(false);
  const [deviceName, setDeviceName] = useState(memoryCache.deviceName || '');
  const [loading, setLoading] = useState(!memoryCache.orgName && !memoryCache.activeLocation);

  // In-place Location Picker Modal states
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locations, setLocations] = useState<AttendanceLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState('');

  // Check-in Methods enabled/disabled from Staff Settings
  const [qrEnabled, setQrEnabled] = useState(true);
  const [pinEnabled, setPinEnabled] = useState(true);

  // Initialize kiosk mode on mount
  useEffect(() => {
    KioskService.init();
  }, []);

  // Fetch permitted locations for the dropdown modal
  const fetchLocationsList = async () => {
    setLocationsLoading(true);
    setLocationsError('');
    try {
      const list = await DeviceApiService.getLocations();
      setLocations(list);

      // Auto-select if device has exactly 1 permitted location and none selected yet
      if (list.length === 1 && !activeLocation) {
        handleSelectLocation(list[0]);
      }
    } catch (err: any) {
      setLocationsError(err?.message || 'Could not load permitted locations.');
    } finally {
      setLocationsLoading(false);
    }
  };

  const handleSelectLocation = async (loc: AttendanceLocation) => {
    setActiveLocation(loc.locationName);
    setActiveLocationId(loc.id);
    memoryCache.activeLocation = loc.locationName;
    memoryCache.activeLocationId = loc.id;
    setLocationModalVisible(false);

    try {
      await SecureStore.setItemAsync(AppConfig.STORAGE_KEYS.ACTIVE_LOCATION, JSON.stringify(loc));
      console.log(`📍 [attendance-home] Switched active location to ${loc.locationName} (${loc.id})`);
      await DeviceApiService.switchLocation({ locationId: loc.id }).catch((err) =>
        console.warn('switchLocation server warning:', err)
      );
    } catch (e) {
      console.warn('Failed saving active location:', e);
    }
  };

  const openLocationSelector = () => {
    setLocationModalVisible(true);
    fetchLocationsList();
  };

  // Reload settings and active location whenever the screen gains focus
  const loadSettingsAndData = useCallback(async () => {
    try {
      // 1. Load method toggles from settings
      const settings = await DeviceSettingsService.getSettings();
      setQrEnabled(settings.qrEnabled);
      setPinEnabled(settings.pinEnabled);

      // 2. Load device config
      const config = await DeviceApiService.getDeviceConfig().catch(() => null);
      if (config?.organisationName) {
        setOrgName(config.organisationName);
        memoryCache.orgName = config.organisationName;
      }
      if (config?.deviceName) {
        setDeviceName(config.deviceName);
        memoryCache.deviceName = config.deviceName;
      }
      if (config?.organisationLogoUrl) {
        setOrgLogoUrl(config.organisationLogoUrl);
        memoryCache.orgLogoUrl = config.organisationLogoUrl;
      }

      // 3. Load active location
      const storedLocation = await SecureStore.getItemAsync(AppConfig.STORAGE_KEYS.ACTIVE_LOCATION);
      if (storedLocation) {
        const parsed = JSON.parse(storedLocation);
        if (parsed?.locationName) {
          setActiveLocation(parsed.locationName);
          memoryCache.activeLocation = parsed.locationName;
        }
        if (parsed?.id) {
          setActiveLocationId(parsed.id);
          memoryCache.activeLocationId = parsed.id;
        }
      } else if (config?.locationName) {
        setActiveLocation(config.locationName);
        memoryCache.activeLocation = config.locationName;
        if (config?.locationId) {
          setActiveLocationId(config.locationId);
          memoryCache.activeLocationId = config.locationId;
        }
      }
    } catch (err) {
      console.warn('Failed loading home config & settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettingsAndData();
    }, [loadSettingsAndData])
  );

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

  // If cold-booting with no cached details yet, show clean sync loader instead of dummy flash
  if (loading && !orgName && !activeLocation) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <KioskBrandHeader subtitle="Attendance Kiosk" />
          <View style={styles.fullScreenLoader}>
            <ActivityIndicator size="large" color="#0D9488" />
            <Text style={styles.fullScreenLoaderText}>Syncing kiosk station...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isTablet && styles.tabletContainer]}>
        {/* Screen 1: Top Brand Header */}
        <KioskBrandHeader
          subtitle="Attendance Kiosk"
          showSettings
          onSettings={() => router.push('/staff-login' as any)}
        />

        <ScrollView
          contentContainerStyle={[styles.scrollBody, isTablet && styles.tabletScrollBody]}
          showsVerticalScrollIndicator={false}
        >
          {/* Organisation & Location Dropdown Card */}
          <TouchableOpacity
            style={[styles.orgCard, isTablet && styles.tabletOrgCard]}
            onPress={openLocationSelector}
            activeOpacity={0.8}
          >
            {/* Org Logo / Icon */}
            <View style={[styles.orgLogoBox, isTablet && styles.tabletOrgLogoBox]}>
              {orgLogoUrl && !logoFailed ? (
                <Image
                  source={{ uri: orgLogoUrl }}
                  style={[styles.orgLogoImage, isTablet && styles.tabletOrgLogoImage]}
                  onError={() => setLogoFailed(true)}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.orgLogoFallback, isTablet && styles.tabletOrgLogoBox]}>
                  <MaterialIcons name="fitness-center" size={isTablet ? 30 : 24} color="#BE185D" />
                </View>
              )}
            </View>

            {/* Org Details */}
            <View style={styles.orgDetailsCol}>
              <Text style={[styles.orgNameText, isTablet && styles.tabletOrgNameText]} numberOfLines={1}>
                {orgName || 'Partner Centre'}
              </Text>
              <View style={styles.orgLocationRow}>
                <MaterialIcons name="location-on" size={isTablet ? 18 : 15} color="#0D9488" />
                <Text
                  style={[
                    styles.orgLocationText,
                    isTablet && styles.tabletOrgLocationText,
                    !activeLocation && styles.orgLocationPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {activeLocation || 'Tap to Select Location'}
                </Text>
              </View>
            </View>

            <View style={[styles.dropdownBadge, isTablet && styles.tabletDropdownBadge]}>
              <MaterialIcons name="keyboard-arrow-down" size={isTablet ? 26 : 22} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* Date Subtitle */}
          <Text style={[styles.dateLabel, isTablet && styles.tabletDateLabel]}>{todayFormatted}</Text>

          {/* Ready For Attendance Heading Banner */}
          <View style={[styles.readyBanner, isTablet && styles.tabletReadyBanner]}>
            <View style={[styles.readyIconCircle, isTablet && styles.tabletReadyIconCircle]}>
              <MaterialIcons name="groups" size={isTablet ? 28 : 22} color="#0F766E" />
            </View>
            <View style={styles.readyTextCol}>
              <Text style={[styles.readyTitle, isTablet && styles.tabletReadyTitle]}>Ready for Attendance</Text>
              <Text style={[styles.readySubtitle, isTablet && styles.tabletReadySubtitle]}>Choose how you want to check in</Text>
            </View>
          </View>

          {/* Option 1: Scan QR Code (Conditional on qrEnabled) */}
          {qrEnabled && (
            <TouchableOpacity
              style={[styles.qrOptionCard, isTablet && styles.tabletOptionCard]}
              onPress={() => router.push('/scanner' as any)}
              activeOpacity={0.85}
            >
              <View style={[styles.qrIconBox, isTablet && styles.tabletIconBox]}>
                <MaterialIcons name="qr-code-2" size={isTablet ? 40 : 32} color="#FFFFFF" />
              </View>
              <View style={styles.optionTextCol}>
                <Text style={[styles.qrOptionTitle, isTablet && styles.tabletOptionTitle]}>Scan QR Code</Text>
                <Text style={[styles.qrOptionSubtitle, isTablet && styles.tabletOptionSubtitle]}>
                  Scan your member QR code to mark attendance
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={isTablet ? 32 : 26} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Option 2: Enter PIN (Conditional on pinEnabled) */}
          {pinEnabled && (
            <TouchableOpacity
              style={[styles.pinOptionCard, isTablet && styles.tabletOptionCard]}
              onPress={() => router.push('/pin-attendance' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.pinIconBox, isTablet && styles.tabletIconBox]}>
                <MaterialIcons name="dialpad" size={isTablet ? 34 : 26} color="#0D3838" />
              </View>
              <View style={styles.optionTextCol}>
                <Text style={[styles.pinOptionTitle, isTablet && styles.tabletOptionTitle]}>Enter PIN</Text>
                <Text style={[styles.pinOptionSubtitle, isTablet && styles.tabletOptionSubtitle]}>
                  Enter your 6-digit PIN to mark attendance
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={isTablet ? 30 : 24} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Fallback if both methods are disabled by staff */}
          {!qrEnabled && !pinEnabled && (
            <View style={styles.disabledCard}>
              <MaterialIcons name="pause-circle-outline" size={28} color="#D97706" />
              <View style={{ flex: 1 }}>
                <Text style={styles.disabledCardTitle}>Check-in Paused</Text>
                <Text style={styles.disabledCardSub}>
                  QR and PIN attendance are currently disabled in Staff Settings.
                </Text>
              </View>
            </View>
          )}

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

        {/* In-Place Location Selector Modal */}
        <Modal
          visible={locationModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLocationModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.dropdownModalCard}>
              {/* Modal Header */}
              <View style={styles.dropdownModalHeader}>
                <View style={{ gap: 2 }}>
                  <Text style={styles.dropdownModalTitle}>Select Today's Location</Text>
                  <Text style={styles.dropdownModalSub}>Choose the active station for this device</Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setLocationModalVisible(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="close" size={22} color={Colors.text} />
                </TouchableOpacity>
              </View>

              {/* Modal Content */}
              {locationsLoading ? (
                <View style={styles.dropdownLoadingBox}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.dropdownLoadingText}>Fetching locations...</Text>
                </View>
              ) : locationsError ? (
                <View style={styles.dropdownErrorBox}>
                  <MaterialIcons name="error-outline" size={30} color={Colors.error} />
                  <Text style={styles.dropdownErrorText}>{locationsError}</Text>
                  <TouchableOpacity style={styles.dropdownRetryBtn} onPress={fetchLocationsList}>
                    <Text style={styles.dropdownRetryBtnText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : locations.length === 0 ? (
                <View style={styles.dropdownEmptyBox}>
                  <MaterialIcons name="location-off" size={30} color={Colors.textSecondary} />
                  <Text style={styles.dropdownEmptyText}>
                    No permitted locations assigned to this device.
                  </Text>
                  <TouchableOpacity style={styles.dropdownRetryBtn} onPress={fetchLocationsList}>
                    <Text style={styles.dropdownRetryBtnText}>Refresh</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                  <View style={{ gap: 10 }}>
                    {locations.map((loc) => {
                      const isSelected =
                        loc.id === activeLocationId || loc.locationName === activeLocation;
                      return (
                        <TouchableOpacity
                          key={loc.id}
                          style={[
                            styles.locationItemCard,
                            isSelected && styles.locationItemCardSelected,
                          ]}
                          onPress={() => handleSelectLocation(loc)}
                          activeOpacity={0.75}
                        >
                          <View
                            style={[
                              styles.locationItemPin,
                              isSelected && styles.locationItemPinSelected,
                            ]}
                          >
                            <MaterialIcons
                              name="location-on"
                              size={20}
                              color={isSelected ? Colors.textWhite : Colors.primary}
                            />
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text
                              style={[
                                styles.locationItemName,
                                isSelected && styles.locationItemNameSelected,
                              ]}
                            >
                              {loc.locationName}
                            </Text>
                            {(loc.address || loc.city) && (
                              <Text style={styles.locationItemSub} numberOfLines={1}>
                                {loc.address || loc.city}
                              </Text>
                            )}
                          </View>
                          {isSelected && (
                            <MaterialIcons name="check-circle" size={22} color={Colors.success} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
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
  fullScreenLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingTop: 80,
  },
  fullScreenLoaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
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
    color: '#0D9488',
    fontWeight: '700',
  },
  orgLocationPlaceholder: {
    color: '#D97706',
    fontWeight: '600',
  },
  dropdownBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
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
  disabledCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 14,
  },
  disabledCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  disabledCardSub: {
    fontSize: 12,
    color: '#B45309',
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

  /* In-Place Dropdown Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 460,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    gap: 16,
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  dropdownModalSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownLoadingBox: {
    padding: 30,
    alignItems: 'center',
    gap: 10,
  },
  dropdownLoadingText: {
    fontSize: 13,
    color: '#64748B',
  },
  dropdownErrorBox: {
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  dropdownErrorText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
  },
  dropdownRetryBtn: {
    marginTop: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dropdownRetryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  dropdownEmptyBox: {
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  dropdownEmptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  locationItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  locationItemCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight + '35',
  },
  locationItemPin: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationItemPinSelected: {
    backgroundColor: Colors.primary,
  },
  locationItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  locationItemNameSelected: {
    color: Colors.primary,
    fontWeight: '800',
  },
  locationItemSub: {
    fontSize: 12,
    color: '#64748B',
  },
  tabletContainer: {
    maxWidth: 680,
    paddingHorizontal: 16,
  },
  tabletScrollBody: {
    paddingHorizontal: 28,
    paddingTop: 16,
    gap: 18,
  },
  tabletOrgCard: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 20,
    gap: 16,
  },
  tabletOrgLogoBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
  },
  tabletOrgLogoImage: {
    width: 60,
    height: 60,
    borderRadius: 16,
  },
  tabletOrgNameText: {
    fontSize: 19,
  },
  tabletOrgLocationText: {
    fontSize: 15,
  },
  tabletDropdownBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  tabletDateLabel: {
    fontSize: 15,
    marginVertical: 4,
  },
  tabletReadyBanner: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 18,
    gap: 16,
  },
  tabletReadyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  tabletReadyTitle: {
    fontSize: 18,
  },
  tabletReadySubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  tabletOptionCard: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderRadius: 20,
    gap: 18,
  },
  tabletIconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
  },
  tabletOptionTitle: {
    fontSize: 20,
  },
  tabletOptionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});
