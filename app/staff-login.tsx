import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/theme';
import { SoundService } from '../services/SoundService';
import { DeviceApiService } from '../services/DeviceApiService';
import { AvailableStaff } from '../types/attendance';

export default function StaffLoginScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isTablet = Math.min(screenWidth, screenHeight) >= 600 || screenWidth >= 600;

  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [staffList, setStaffList] = useState<AvailableStaff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<AvailableStaff | null>(null);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  useEffect(() => {
    const loadStaff = async () => {
      try {
        setLoadingStaff(true);
        console.log('👥 [StaffLogin] Loading eligible employee list from /staff/available...');
        const list = await DeviceApiService.getAvailableStaff();
        setStaffList(list);
        if (list && list.length > 0) {
          setSelectedStaff(list[0]);
        }
      } catch (err) {
        console.warn('⚠️ [StaffLogin] Could not load staff list:', err);
      } finally {
        setLoadingStaff(false);
      }
    };
    loadStaff();
  }, []);

  const handleKeyPress = (num: string) => {
    if (verifying) return;
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      setErrorMessage('');
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}

      // Auto-submit once 6 digits are reached
      if (newPin.length === 6) {
        verifyStaffPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (verifying) return;
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMessage('');
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  };

  const verifyStaffPin = async (completedPin: string) => {
    if (verifying || completedPin.length < 4) return;
    setVerifying(true);
    setErrorMessage('');

    try {
      console.log(`🔒 [StaffLogin] Verifying PIN for ${selectedStaff?.displayName || 'Staff'} (userId: ${selectedStaff?.userId || 'none'})...`);
      const res = await DeviceApiService.verifyStaffPin({
        userId: selectedStaff?.userId,
        pin: completedPin,
        purpose: 'LOCATION_SWITCH',
      });

      if (res.verified) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          SoundService.playSuccess();
        } catch {}

        // Persist verified staff user details for audit & location switch
        try {
          await SecureStore.setItemAsync(
            'last_verified_staff_user',
            JSON.stringify({
              userId: res.userId || selectedStaff?.userId,
              pin: completedPin,
              displayName: selectedStaff?.displayName || res.staffName || 'Authorized Staff',
              role: res.role || 'STAFF',
              verifiedAt: new Date().toISOString(),
            })
          );
        } catch {}

        router.replace('/staff-dashboard' as any);
      } else {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          SoundService.playError();
        } catch {}
        setErrorMessage(res.message || 'Incorrect staff PIN. Try again.');
        setPin('');
      }
    } catch (err: any) {
      console.error('❌ [StaffLogin] Verification error:', err);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        SoundService.playError();
      } catch {}
      setErrorMessage(err?.message || 'Server error verifying staff PIN.');
      setPin('');
    } finally {
      setVerifying(false);
    }
  };

  const canSubmit = pin.length >= 4 && !verifying;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isTablet && styles.tabletContainer]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          disabled={verifying}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.headerBox}>
          <View style={styles.lockIconContainer}>
            <MaterialIcons name="admin-panel-settings" size={32} color={Colors.primary} />
          </View>
          <Text style={[styles.title, isTablet && styles.tabletTitle]}>Staff Access</Text>
          <Text style={[styles.subText, isTablet && styles.tabletSubText]}>
            {selectedStaff
              ? `Enter PIN for ${selectedStaff.displayName}`
              : 'Enter authorized staff or instructor PIN'}
          </Text>
        </View>

        {/* Staff / Instructor Dropdown Selector */}
        {loadingStaff ? (
          <View style={styles.staffLoadingRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.staffLoadingText}>Loading staff list...</Text>
          </View>
        ) : staffList.length > 0 ? (
          <View style={[styles.dropdownSection, isTablet && styles.dropdownSectionTablet]}>
            <Text style={styles.dropdownLabel}>Select Staff / Instructor</Text>
            <TouchableOpacity
              style={[styles.dropdownBtn, isTablet && styles.dropdownBtnTablet]}
              onPress={() => setDropdownVisible(true)}
              activeOpacity={0.7}
              disabled={verifying}
            >
              <View style={styles.dropdownLeft}>
                <View style={styles.dropdownAvatarIcon}>
                  <MaterialIcons name="person" size={20} color={Colors.primary} />
                </View>
                <Text style={[styles.dropdownSelectedText, isTablet && styles.dropdownSelectedTextTablet]} numberOfLines={1}>
                  {selectedStaff ? selectedStaff.displayName : 'Select Staff Member...'}
                </Text>
              </View>
              <MaterialIcons name="arrow-drop-down" size={28} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* 6-dot indicator */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const isFilled = index < pin.length;
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  isTablet && styles.tabletDot,
                  isFilled && styles.dotFilled,
                ]}
              />
            );
          })}
        </View>

        {/* Status / Error or Verifying Loader */}
        <View style={styles.statusBox}>
          {verifying ? (
            <View style={styles.verifyingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.verifyingText}>Verifying PIN with server...</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.errorRow}>
              <MaterialIcons name="error-outline" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : (
            <Text style={styles.hintText}>
              {pin.length >= 4 ? 'Tap checkmark to confirm or enter all 6 digits' : ' '}
            </Text>
          )}
        </View>

        {/* Numeric Dialpad */}
        <View style={[styles.dialpad, isTablet && styles.tabletDialpad]}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
            <View key={rIdx} style={styles.dialpadRow}>
              {row.map((digit) => (
                <TouchableOpacity
                  key={digit}
                  style={[styles.keyBtn, isTablet && styles.tabletKeyBtn]}
                  onPress={() => handleKeyPress(digit)}
                  activeOpacity={0.7}
                  disabled={verifying}
                >
                  <Text style={[styles.keyText, isTablet && styles.tabletKeyText]}>{digit}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          <View style={styles.dialpadRow}>
            {/* Submit checkmark button if >= 4 digits entered */}
            {canSubmit ? (
              <TouchableOpacity
                style={[styles.keyBtn, styles.submitKeyBtn, isTablet && styles.tabletKeyBtn]}
                onPress={() => verifyStaffPin(pin)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="check" size={isTablet ? 32 : 28} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <View style={[styles.keyPlaceholder, isTablet && styles.tabletKeyPlaceholder]} />
            )}

            <TouchableOpacity
              style={[styles.keyBtn, isTablet && styles.tabletKeyBtn]}
              onPress={() => handleKeyPress('0')}
              activeOpacity={0.7}
              disabled={verifying}
            >
              <Text style={[styles.keyText, isTablet && styles.tabletKeyText]}>0</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.keyBtn, isTablet && styles.tabletKeyBtn]}
              onPress={handleBackspace}
              activeOpacity={0.7}
              disabled={verifying || pin.length === 0}
            >
              <MaterialIcons
                name="backspace"
                size={isTablet ? 28 : 24}
                color={pin.length === 0 ? Colors.border : Colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => router.back()}
          disabled={verifying}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Staff Selection Dropdown Modal */}
      <Modal
        visible={dropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDropdownVisible(false)}
        >
          <View style={[styles.modalCard, isTablet && styles.modalCardTablet]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialIcons name="people" size={22} color={Colors.primary} />
                <Text style={styles.modalTitle}>Select Staff Member</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseIconBtn}
                onPress={() => setDropdownVisible(false)}
              >
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalStaffList} showsVerticalScrollIndicator={false}>
              {staffList.map((staff) => {
                const isSelected = selectedStaff?.userId === staff.userId;
                return (
                  <TouchableOpacity
                    key={staff.userId}
                    style={[styles.staffListItem, isSelected && styles.staffListItemActive]}
                    onPress={() => {
                      setSelectedStaff(staff);
                      setDropdownVisible(false);
                      setPin('');
                      setErrorMessage('');
                      try {
                        Haptics.selectionAsync();
                      } catch {}
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.staffItemLeft}>
                      <View style={[styles.staffAvatarCircle, isSelected && styles.staffAvatarCircleActive]}>
                        <MaterialIcons
                          name="person"
                          size={18}
                          color={isSelected ? '#FFFFFF' : Colors.primary}
                        />
                      </View>
                      <Text style={[styles.staffItemName, isSelected && styles.staffItemNameActive]}>
                        {staff.displayName}
                      </Text>
                    </View>
                    {isSelected && (
                      <MaterialIcons name="check" size={20} color="#0D9488" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
  tabletContainer: {
    maxWidth: 520,
    paddingVertical: 36,
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
  lockIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  tabletTitle: {
    fontSize: 28,
  },
  subText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  tabletSubText: {
    fontSize: 16,
  },
  staffLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  staffLoadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  dropdownSection: {
    width: '100%',
    maxWidth: 320,
    marginTop: 10,
    marginBottom: 6,
  },
  dropdownSectionTablet: {
    maxWidth: 420,
    marginTop: 14,
    marginBottom: 10,
  },
  dropdownLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  dropdownBtnTablet: {
    height: 60,
    borderRadius: 16,
    paddingHorizontal: 18,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dropdownAvatarIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownSelectedText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  dropdownSelectedTextTablet: {
    fontSize: 16,
  },

  // Dropdown Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '75%',
    backgroundColor: Colors.cardBackground,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalCardTablet: {
    maxWidth: 480,
    padding: 26,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 10,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  modalCloseIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalStaffList: {
    width: '100%',
  },
  staffListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: Colors.surfaceSubtle,
  },
  staffListItemActive: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#0D9488',
  },
  staffItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  staffAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  staffAvatarCircleActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  staffItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  staffItemNameActive: {
    color: '#0F766E',
    fontWeight: '800',
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
  tabletDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusBox: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifyingText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  dialpad: {
    width: '100%',
    gap: 16,
    marginVertical: 12,
  },
  tabletDialpad: {
    maxWidth: 460,
    gap: 20,
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
  tabletKeyBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  submitKeyBtn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  keyText: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
  },
  tabletKeyText: {
    fontSize: 32,
  },
  keyPlaceholder: {
    width: 72,
    height: 72,
  },
  tabletKeyPlaceholder: {
    width: 88,
    height: 88,
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
