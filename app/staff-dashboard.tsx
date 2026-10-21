import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { DeviceApiService } from '../services/DeviceApiService';
import { KioskService } from '../services/KioskService';
import { DeviceSettingsService } from '../services/DeviceSettingsService';

interface StudentRosterItem {
  id: string;
  name: string;
  status: 'CHECKED_IN' | 'CHECKED_OUT' | 'NOT_CHECKED_IN';
  time?: string;
}

export default function StaffDashboardScreen() {
  const router = useRouter();

  // Active sub-modals
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [registerVisible, setRegisterVisible] = useState(false);
  const [selectedSessionName, setSelectedSessionName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Device dynamic details
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('Attendance Device');
  const [orgName, setOrgName] = useState('');
  const [locationName, setLocationName] = useState('');

  // Toggles for device settings
  const [qrEnabled, setQrEnabled] = useState(true);
  const [pinEnabled, setPinEnabled] = useState(true);
  const [kioskLocked, setKioskLocked] = useState(true);

  // Dynamic student roster
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  React.useEffect(() => {
    const loadConfig = async () => {
      try {
        const cfg = await DeviceApiService.getDeviceConfig().catch(() => null);
        if (cfg?.deviceId) setDeviceId(cfg.deviceId);
        if (cfg?.deviceName) setDeviceName(cfg.deviceName);
        if (cfg?.organisationName) setOrgName(cfg.organisationName);
        if (cfg?.locationName) setLocationName(cfg.locationName);

        const settings = await DeviceSettingsService.getSettings();
        setQrEnabled(settings.qrEnabled);
        setPinEnabled(settings.pinEnabled);
        setKioskLocked(settings.kioskLocked);
      } catch {}
    };
    loadConfig();
  }, []);

  const handleToggleKioskLock = (value: boolean) => {
    setKioskLocked(value);
  };

  const handleSaveSettings = async () => {
    try {
      await DeviceSettingsService.saveSettings({
        qrEnabled,
        pinEnabled,
        kioskLocked,
      });
      await KioskService.setLocked(kioskLocked);
      Alert.alert('Settings Saved', 'Device check-in options and kiosk security mode have been updated.');
      setSettingsVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save settings.');
    }
  };

  const handleManualCheckIn = (studentId: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? { ...s, status: 'CHECKED_IN', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          : s
      )
    );
    Alert.alert('Success', 'Student checked in manually.');
  };

  const handleDisconnectDevice = async () => {
    Alert.alert(
      'Disconnect Device?',
      'This will remove device credentials and return to the Setup Code screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await DeviceApiService.clearCredentials();
            setSettingsVisible(false);
            router.replace('/' as any);
          },
        },
      ]
    );
  };

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Attendance Staff</Text>
            <Text style={styles.headerSub}>{orgName} • {locationName}</Text>
          </View>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setSettingsVisible(true)}
          >
            <MaterialIcons name="settings" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {/* Live Stats Counters (Screen 16) */}
          <View style={styles.statsCard}>
            <View style={styles.statColumn}>
              <Text style={styles.statNumber}>{students.length}</Text>
              <Text style={styles.statLabel}>Expected</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statColumn}>
              <Text style={[styles.statNumber, { color: Colors.success }]}>
                {students.filter((s) => s.status === 'CHECKED_IN').length}
              </Text>
              <Text style={styles.statLabel}>Checked In</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statColumn}>
              <Text style={[styles.statNumber, { color: Colors.warning }]}>
                {students.filter((s) => s.status === 'CHECKED_OUT').length}
              </Text>
              <Text style={styles.statLabel}>Checked Out</Text>
            </View>
          </View>

          {/* Sessions List */}
          <Text style={styles.sectionTitle}>Active Sessions</Text>
          <View style={styles.sessionList}>
            {sessions.length === 0 ? (
              <View style={styles.emptySessionBox}>
                <Text style={styles.emptySessionText}>
                  No active session limits configured. All enrolled members can check in.
                </Text>
              </View>
            ) : (
              sessions.map((sess) => (
                <TouchableOpacity
                  key={sess.id}
                  style={styles.sessionCard}
                  onPress={() => {
                    setSelectedSessionName(sess.title);
                    setRegisterVisible(true);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.sessionCardTitle}>{sess.title}</Text>
                    <Text style={styles.sessionCardTime}>{sess.time}</Text>
                    <Text style={styles.sessionCardRatio}>{sess.ratio}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Quick Shortcuts */}
          <TouchableOpacity
            style={styles.locationSwitchBtn}
            onPress={() => router.push('/select-location' as any)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="location-on" size={20} color={Colors.primary} />
            <Text style={styles.locationSwitchText}>Switch Today's Location</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ======================================================== */}
      {/* SESSION REGISTER MODAL (Screens 17 & 18)                 */}
      {/* ======================================================== */}
      <Modal visible={registerVisible} animationType="slide">
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.registerContainer}>
            <View style={styles.registerHeader}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setRegisterVisible(false)}>
                <MaterialIcons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.registerTitle}>{selectedSessionName}</Text>
                <Text style={styles.registerSubtitle}>Friday 16 Oct 2026 • 6:00 PM – 7:00 PM</Text>
              </View>
            </View>

            {/* Search Input */}
            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={20} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search member..."
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Student List */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
              {filteredStudents.map((st) => (
                <View key={st.id} style={styles.studentRow}>
                  <View
                    style={[
                      styles.studentStatusCircle,
                      st.status === 'CHECKED_IN' && { backgroundColor: Colors.success },
                      st.status === 'CHECKED_OUT' && { backgroundColor: Colors.warning },
                      st.status === 'NOT_CHECKED_IN' && { backgroundColor: Colors.surfaceSubtle },
                    ]}
                  >
                    <MaterialIcons
                      name={st.status === 'NOT_CHECKED_IN' ? 'person' : 'check'}
                      size={18}
                      color={st.status === 'NOT_CHECKED_IN' ? Colors.textMuted : Colors.textWhite}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{st.name}</Text>
                    <Text style={styles.studentStatusText}>
                      {st.status === 'CHECKED_IN'
                        ? `Checked in ${st.time}`
                        : st.status === 'CHECKED_OUT'
                        ? `Checked out ${st.time}`
                        : 'Not checked in'}
                    </Text>
                  </View>

                  {st.status === 'NOT_CHECKED_IN' && (
                    <TouchableOpacity
                      style={styles.manualCheckInBtn}
                      onPress={() => handleManualCheckIn(st.id)}
                    >
                      <Text style={styles.manualCheckInBtnText}>Check In</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ======================================================== */}
      {/* DEVICE SETTINGS MODAL (Screen 21)                        */}
      {/* ======================================================== */}
      <Modal visible={settingsVisible} animationType="slide">
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.registerContainer}>
            <View style={styles.registerHeader}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setSettingsVisible(false)}>
                <MaterialIcons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.registerTitle}>Device Settings</Text>
            </View>

            <ScrollView contentContainerStyle={{ gap: 20, paddingBottom: 30 }}>
              {/* Device Profile Card */}
              <View style={styles.settingsCard}>
                <View style={styles.onlineBadgeRow}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>Online</Text>
                </View>
                <Text style={styles.settingsDevName}>{deviceName}</Text>
                <Text style={styles.settingsOrgName}>
                  {orgName}{locationName ? ` • ${locationName}` : ''}
                </Text>
              </View>

              {/* Method Toggles */}
              <View style={styles.settingsCard}>
                <Text style={styles.settingsSectionTitle}>Check-in Methods</Text>
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>QR Code Scanning</Text>
                  <Switch
                    value={qrEnabled}
                    onValueChange={setQrEnabled}
                    trackColor={{ true: Colors.primary }}
                  />
                </View>
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>Student PIN Entry</Text>
                  <Switch
                    value={pinEnabled}
                    onValueChange={setPinEnabled}
                    trackColor={{ true: Colors.primary }}
                  />
                </View>
              </View>

              {/* Kiosk Mode Lock / Unlock */}
              <View style={styles.settingsCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.settingsSectionTitle}>Kiosk Security Mode</Text>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: kioskLocked ? '#064e3b' : '#374151',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8
                  }}>
                    <MaterialIcons name={kioskLocked ? 'lock' : 'lock-open'} size={14} color={kioskLocked ? Colors.success : Colors.textSecondary} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: kioskLocked ? Colors.success : Colors.textSecondary }}>
                      {kioskLocked ? 'LOCKED' : 'UNLOCKED'}
                    </Text>
                  </View>
                </View>

                <View style={styles.toggleRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.toggleLabel}>Lock Kiosk On Tablet</Text>
                    <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>
                      Keeps screen awake 24/7 & hides Android navigation so students cannot exit.
                    </Text>
                  </View>
                  <Switch
                    value={kioskLocked}
                    onValueChange={handleToggleKioskLock}
                    trackColor={{ true: Colors.primary }}
                  />
                </View>
              </View>

              {/* Save Settings Button */}
              <TouchableOpacity
                style={styles.saveSettingsBtn}
                onPress={handleSaveSettings}
                activeOpacity={0.8}
              >
                <MaterialIcons name="save" size={20} color={Colors.textWhite} />
                <Text style={styles.saveSettingsBtnText}>Save Settings</Text>
              </TouchableOpacity>

              {/* Device Info */}
              <View style={styles.settingsCard}>
                <Text style={styles.settingsSectionTitle}>Device Information</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Device ID</Text>
                  <Text style={styles.infoVal}>{deviceId || 'NS-DEVICE'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>App Version</Text>
                  <Text style={styles.infoVal}>1.0.0</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Last Sync</Text>
                  <Text style={styles.infoVal}>Just now</Text>
                </View>
              </View>

              {/* Disconnect Action */}
              <TouchableOpacity
                style={styles.disconnectBtn}
                onPress={handleDisconnectDevice}
                activeOpacity={0.8}
              >
                <MaterialIcons name="link-off" size={20} color={Colors.error} />
                <Text style={styles.disconnectBtnText}>Disconnect Device</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalSafeArea: {
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollBody: {
    paddingVertical: 14,
    gap: 16,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
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
  },
  sessionCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  sessionCardTime: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  sessionCardRatio: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  locationSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    marginTop: 8,
  },
  locationSwitchText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  registerContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  registerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  registerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  registerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  studentStatusCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  studentStatusText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  manualCheckInBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  manualCheckInBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  settingsCard: {
    backgroundColor: Colors.cardBackground,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  onlineBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  onlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.success,
  },
  settingsDevName: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  settingsOrgName: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  settingsSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoKey: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  disconnectBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.error,
    gap: 8,
    backgroundColor: Colors.errorLight,
  },
  disconnectBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.error,
  },
  saveSettingsBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  saveSettingsBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  emptySessionBox: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptySessionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
