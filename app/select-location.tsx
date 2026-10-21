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
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/theme';
import { AppConfig } from '../constants/config';
import { DeviceApiService } from '../services/DeviceApiService';
import { AttendanceLocation } from '../types/attendance';

export default function SelectLocationScreen() {
  const router = useRouter();
  const [locations, setLocations] = useState<AttendanceLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [orgName, setOrgName] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchLocations = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Load organisation details dynamically from device config
      const config = await DeviceApiService.getDeviceConfig().catch(() => null);
      if (config?.organisationName) {
        setOrgName(config.organisationName);
      }
      if (config?.deviceName) {
        setDeviceName(config.deviceName);
      }

      const fetched = await DeviceApiService.getLocations();
      console.log('📍 [SelectLocation] Fetched dynamic locations:', fetched);
      if (fetched && fetched.length > 0) {
        setLocations(fetched);
        // Highlight active location if matching config
        const initialLoc = (config?.locationId && fetched.find((l) => l.id === config.locationId)) || fetched[0];
        setSelectedLocationId(initialLoc.id);
      } else {
        setLocations([]);
      }
    } catch (err: any) {
      console.warn('Fallback to local locations due to:', err);
      const fallbackLocs = [
        {
          id: 'e0284aec-905a-4f3d-bce8-ba94a978f85f',
          locationName: 'Coventry - Binley',
          isActive: true,
          city: 'Coventry',
        },
        {
          id: '0a764d9c-6ad0-4b74-8560-b0f872442213',
          locationName: 'Nuneaton',
          isActive: false,
          city: 'Nuneaton',
        },
      ];
      setLocations(fallbackLocs);
      setSelectedLocationId(fallbackLocs[0].id);
      if (!orgName) setOrgName('Sargam Dance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleSelectLocation = async (loc: AttendanceLocation) => {
    setSelectedLocationId(loc.id);
    await SecureStore.setItemAsync(AppConfig.STORAGE_KEYS.ACTIVE_LOCATION, JSON.stringify(loc));

    // Navigate to Screen 4: Attendance Home
    router.replace({
      pathname: '/attendance-home' as any,
      params: {
        locationId: loc.id,
        locationName: loc.locationName,
        locationSub: loc.address || loc.city,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Brand Header */}
        <View style={styles.header}>
          <Text style={styles.brandTitle}>NationSkills</Text>
          {orgName ? <Text style={styles.brandSubtitle}>{orgName}</Text> : null}
          {deviceName ? (
            <View style={styles.deviceChipRow}>
              <MaterialIcons name="tablet-android" size={13} color={Colors.primary} />
              <Text style={styles.deviceChipText}>{deviceName}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionHeading}>Select today's location</Text>

        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loaderText}>Loading permitted locations...</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="error-outline" size={36} color={Colors.error} />
            <Text style={styles.emptyTitle}>Could not load locations</Text>
            <Text style={styles.emptySubtitle}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchLocations}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : locations.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="location-off" size={36} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Permitted Locations Found</Text>
            <Text style={styles.emptySubtitle}>
              This device has not been assigned any permitted locations in the admin portal yet.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchLocations}>
              <Text style={styles.retryBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.locationsList}>
            {locations.map((loc) => {
              const isSelected = selectedLocationId === loc.id;
              return (
                <TouchableOpacity
                  key={loc.id}
                  style={[styles.locationCard, isSelected && styles.locationCardSelected]}
                  activeOpacity={0.75}
                  onPress={() => handleSelectLocation(loc)}
                >
                  <View style={[styles.pinCircle, isSelected && styles.pinCircleSelected]}>
                    <MaterialIcons
                      name="location-on"
                      size={24}
                      color={isSelected ? Colors.textWhite : Colors.primary}
                    />
                  </View>

                  <View style={{ flex: 1, paddingRight: 8, gap: 2 }}>
                    <Text style={styles.locationTitle} numberOfLines={1} ellipsizeMode="tail">
                      {loc.locationName}
                    </Text>
                    <Text style={styles.locationSubText} numberOfLines={1} ellipsizeMode="tail">
                      {loc.address || loc.city || (loc.isActive ? 'Active assigned location' : 'Tap to switch location')}
                    </Text>
                  </View>

                  <MaterialIcons name="chevron-right" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    padding: 24,
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginVertical: 20,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  brandSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
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
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 20,
    marginTop: 8,
  },
  loaderBox: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  locationsList: {
    gap: 14,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 16,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  locationCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight + '40',
  },
  pinCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinCircleSelected: {
    backgroundColor: Colors.primary,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  locationSubText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  activePillBadge: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.success,
  },
  emptyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: Colors.textWhite,
    fontWeight: '700',
    fontSize: 14,
  },
});
