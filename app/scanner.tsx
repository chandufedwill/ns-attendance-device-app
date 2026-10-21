import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/theme';
import { AppConfig } from '../constants/config';
import { DeviceApiService } from '../services/DeviceApiService';
import { SoundService } from '../services/SoundService';
import { KioskService } from '../services/KioskService';
import {
  AttendanceEligibilityResponse,
  EligibilityStatus,
} from '../types/attendance';
import { CheckInSuccessView } from '../components/CheckInSuccessView';

function StudentAvatar({ name, imageUrl }: { name?: string; imageUrl?: string | null }) {
  const [imgError, setImgError] = useState(false);

  const getInitials = (fullName?: string) => {
    if (!fullName || fullName.startsWith('Student (')) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(name);

  if (imageUrl && !imgError) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={styles.modalStudentAvatar}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <View style={styles.modalStudentAvatarFallback}>
      {initials ? (
        <Text style={styles.avatarInitialsText}>{initials}</Text>
      ) : (
        <MaterialIcons name="person" size={32} color={Colors.primary} />
      )}
    </View>
  );
}

export default function MainQRScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [activeLocation, setActiveLocation] = useState('');
  const [orgName, setOrgName] = useState('');
  const [deviceName, setDeviceName] = useState('');

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [torch, setTorch] = useState(false);
  const isProcessingRef = useRef(false);
  const lastScanTimestampRef = useRef(0);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Result modal state
  const lastScannedCodeRef = useRef<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalResult, setModalResult] = useState<AttendanceEligibilityResponse | null>(null);
  const [checkoutInProgress, setCheckoutInProgress] = useState(false);

  // Auto-close progress animation
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const config = await DeviceApiService.getDeviceConfig().catch(() => null);
        if (config?.organisationName) setOrgName(config.organisationName);
        if (config?.locationName) setActiveLocation(config.locationName);
        if (config?.deviceName) setDeviceName(config.deviceName);

        const stored = await SecureStore.getItemAsync(AppConfig.STORAGE_KEYS.ACTIVE_LOCATION);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.locationName) setActiveLocation(parsed.locationName);
        }
      } catch {}
    };
    loadMetadata();
    KioskService.init();

    return () => {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, []);

  const triggerAutoClose = (durationMs = 2800) => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);

    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: durationMs,
      useNativeDriver: false,
    }).start();

    autoCloseTimerRef.current = setTimeout(() => {
      closeModal();
    }, durationMs);
  };

  const closeModal = () => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    setModalVisible(false);
    setModalResult(null);
    setCheckoutInProgress(false);
    isProcessingRef.current = false;
    setIsScanning(false);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    const now = Date.now();
    // 2.5 second cooldown between scans
    if (now - lastScanTimestampRef.current < 2500 || isProcessingRef.current) {
      return;
    }

    lastScanTimestampRef.current = now;
    isProcessingRef.current = true;
    setIsScanning(true);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const scannedCode = data.trim();
    console.log('\n================== 📷 NEW QR SCAN ==================');
    console.log('📷 [Scanner] RAW Scanned Data:', scannedCode);
    console.log('====================================================\n');
    await processScan(scannedCode);
  };

  const processScan = async (code: string) => {
    try {
      lastScannedCodeRef.current = code;

      // Step 1: Check eligibility
      const eligibility = await DeviceApiService.checkEligibility('QR', code);
      console.log('📡 Eligibility Result:', eligibility);

      // If eligible for immediate check-in:
      if (eligibility.status === 'CHECK_IN' && eligibility.classSessionId) {
        const requestId = DeviceApiService.generateRequestId();
        const checkInRes = await DeviceApiService.checkIn({
          method: 'QR',
          code,
          classSessionId: eligibility.classSessionId,
          requestId,
        });

        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          SoundService.playSuccess();
        } catch {}

        setModalResult({
          status: 'CHECK_IN',
          studentName: checkInRes.studentName || eligibility.studentName || 'Student',
          profileImageUrl: eligibility.profileImageUrl,
          className: checkInRes.className || eligibility.className || '',
          sessionTime: eligibility.sessionTime || '',
          checkInTime: checkInRes.checkInTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
        setModalVisible(true);
        triggerAutoClose(2800);
      } else {
        // Render other states (Already checked in, already attended, too early, closed, invalid)
        setModalResult(eligibility);
        setModalVisible(true);

        if (eligibility.status === 'ALREADY_CHECKED_IN') {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            SoundService.playWarning();
          } catch {}
          // Does not auto-close; wait for user tap
        } else if (eligibility.status === 'ALREADY_ATTENDED') {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            SoundService.playWarning();
          } catch {}
          triggerAutoClose(3500);
        } else if (eligibility.status === 'TOO_EARLY' || eligibility.status === 'CHECKIN_CLOSED') {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            SoundService.playWarning();
          } catch {}
          triggerAutoClose(3000);
        } else {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            SoundService.playError();
          } catch {}
        }
      }
    } catch (err: any) {
      console.error('Scan processing error:', err);
      try {
        SoundService.playError();
      } catch {}
      setModalResult({
        status: 'INVALID_CODE',
        message: err?.message || 'Could not verify student pass.',
      });
      setModalVisible(true);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmCheckOut = async () => {
    if (!modalResult) return;
    setCheckoutInProgress(true);

    try {
      const requestId = DeviceApiService.generateRequestId();
      const checkOutRes = await DeviceApiService.checkOut({
        method: 'QR',
        code: lastScannedCodeRef.current || modalResult.studentId || '',
        classSessionId: modalResult.classSessionId || '',
        visitId: String(modalResult.visitId || ''),
        requestId,
        checkoutConfirmed: true,
      });

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        SoundService.playSuccess();
      } catch {}

      // Switch modal to Screen 9: Check-Out Successful
      setModalResult({
        ...modalResult,
        status: 'CHECK_OUT',
        checkOutTime: checkOutRes.checkOutTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      triggerAutoClose(2800);
    } catch (err: any) {
      try {
        SoundService.playError();
      } catch {}
      alert(err?.message || 'Check-out failed.');
    } finally {
      setCheckoutInProgress(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.permissionBox}>
          <MaterialIcons name="videocam-off" size={54} color={Colors.error} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSubtitle}>
            To scan student attendance QR codes, camera permission is required for this device.
          </Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Enable Camera</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.rootContainer}>
      {/* Live Camera Viewfinder */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={isScanning || modalVisible ? undefined : handleBarcodeScanned}
      />

      {/* Darkened Overlay & Viewfinder Reticle */}
      <SafeAreaView style={styles.cameraOverlayArea}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={() => router.replace('/attendance-home' as any)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>

          <View style={styles.topHeaderCenter}>
            <Image
              source={require('../assets/images/nationskills-logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            {orgName ? <Text style={styles.topHeaderOrg}>{orgName}</Text> : null}
            <Text style={styles.topHeaderLoc}>{activeLocation || 'Attendance Station'}</Text>
          </View>

          <TouchableOpacity
            style={[styles.iconCircleBtn, torch && styles.iconCircleBtnActive]}
            onPress={() => setTorch(!torch)}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={torch ? 'flash-on' : 'flash-off'}
              size={22}
              color={Colors.textWhite}
            />
          </TouchableOpacity>
        </View>

        {/* Center Scanner Reticle */}
        <View style={styles.reticleContainer}>
          <View style={styles.reticleBox}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {isScanning && (
              <View style={styles.scanningBadge}>
                <ActivityIndicator size="small" color={Colors.textWhite} />
                <Text style={styles.scanningText}>Verifying...</Text>
              </View>
            )}
          </View>

          <Text style={styles.scannerInstructions}>Scan your QR code</Text>
          <Text style={styles.scannerSubInstructions}>Hold your code within the frame</Text>
        </View>

        {/* Bottom Bar: Cancel Button */}
        <View style={styles.bottomBarCentered}>
          <TouchableOpacity
            style={styles.cancelScanBtn}
            onPress={() => router.replace('/attendance-home' as any)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="close" size={18} color="#0F172A" />
            <Text style={styles.cancelScanBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ======================================================== */}
      {/* RESULT MODALS (Screen 3 Check-In Success & Statuses)     */}
      {/* ======================================================== */}
      <Modal visible={modalVisible} transparent={modalResult?.status !== 'CHECK_IN'} animationType="fade" onRequestClose={closeModal}>
        {modalResult?.status === 'CHECK_IN' ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <CheckInSuccessView
              studentName={modalResult.studentName}
              profileImageUrl={modalResult.profileImageUrl}
              className={modalResult.className || 'Class Session'}
              locationName={activeLocation || orgName || 'Attendance Station'}
              checkInTime={modalResult.checkInTime}
              autoCloseDurationMs={2800}
              onDismiss={() => {
                closeModal();
                router.replace('/attendance-home' as any);
              }}
            />
          </SafeAreaView>
        ) : (
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              {modalResult?.status === 'CHECK_OUT' && (
                <>
                  <View style={[styles.statusIconCircle, { backgroundColor: Colors.success }]}>
                    <MaterialIcons name="check" size={48} color={Colors.textWhite} />
                  </View>
                  <Text style={styles.modalHeading}>Checked out successfully!</Text>

                  <View style={styles.modalStudentBox}>
                    <StudentAvatar
                      name={modalResult.studentName}
                      imageUrl={modalResult.profileImageUrl}
                    />
                    <Text style={styles.modalStudentName}>{modalResult.studentName || 'Student Member'}</Text>
                    {modalResult.className ? <Text style={styles.modalSessionTime}>{modalResult.className}</Text> : null}
                    {modalResult.sessionTime ? <Text style={styles.modalSessionTime}>{modalResult.sessionTime}</Text> : null}
                  </View>

                  <View style={styles.timestampRow}>
                    {modalResult.checkOutTime && (
                      <Text style={styles.timestampText}>Checked out at {modalResult.checkOutTime}</Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => {
                      closeModal();
                      router.replace('/attendance-home' as any);
                    }}
                  >
                    <Text style={styles.modalCloseBtnText}>Done</Text>
                  </TouchableOpacity>
                </>
              )}

            {/* Screen 7 & 8: Already Checked In (Prompt for Check-out) */}
            {modalResult?.status === 'ALREADY_CHECKED_IN' && (
              <>
                <View style={[styles.statusIconCircle, { backgroundColor: Colors.success }]}>
                  <MaterialIcons name="check" size={48} color={Colors.textWhite} />
                </View>
                <Text style={styles.modalHeading}>Already checked in</Text>

                <View style={styles.modalStudentBox}>
                  <StudentAvatar
                    name={modalResult.studentName}
                    imageUrl={modalResult.profileImageUrl}
                  />
                  <Text style={styles.modalStudentName}>{modalResult.studentName || 'Student Member'}</Text>
                  {modalResult.className ? <Text style={styles.modalSessionTime}>{modalResult.className}</Text> : null}
                  {modalResult.sessionTime ? <Text style={styles.modalSessionTime}>{modalResult.sessionTime}</Text> : null}
                </View>

                {modalResult.checkInTime ? (
                  <Text style={styles.timestampText}>Checked in at {modalResult.checkInTime}</Text>
                ) : null}

                <View style={styles.infoAlertBox}>
                  <MaterialIcons name="info" size={18} color={Colors.info} />
                  <Text style={styles.infoAlertText}>
                    Student is currently checked in. Do you want to check them out?
                  </Text>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.confirmCheckOutBtn, checkoutInProgress && { opacity: 0.7 }]}
                    onPress={handleConfirmCheckOut}
                    disabled={checkoutInProgress}
                  >
                    {checkoutInProgress ? (
                      <ActivityIndicator color={Colors.textWhite} />
                    ) : (
                      <Text style={styles.confirmCheckOutBtnText}>Check Out</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Screen: Already Attended Today / Repeat visits disabled */}
            {modalResult?.status === 'ALREADY_ATTENDED' && (
              <>
                <View style={[styles.statusIconCircle, { backgroundColor: Colors.info }]}>
                  <MaterialIcons name="done-all" size={44} color={Colors.textWhite} />
                </View>
                <Text style={styles.modalHeading}>Already attended today</Text>

                <View style={styles.modalStudentBox}>
                  <StudentAvatar
                    name={modalResult.studentName}
                    imageUrl={modalResult.profileImageUrl}
                  />
                  <Text style={styles.modalStudentName}>{modalResult.studentName || 'Student Member'}</Text>
                  {modalResult.className ? <Text style={styles.modalSessionTime}>{modalResult.className}</Text> : null}
                  {modalResult.sessionTime ? <Text style={styles.modalSessionTime}>{modalResult.sessionTime}</Text> : null}
                </View>

                <Text style={styles.modalDescText}>
                  {modalResult.message || 'You have already attended this class today.'}
                </Text>

                <TouchableOpacity style={styles.primaryModalBtn} onPress={closeModal}>
                  <Text style={styles.primaryModalBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Screen 10: No Eligible Session */}
            {modalResult?.status === 'NO_SESSION' && (
              <>
                <View style={[styles.statusIconCircle, { backgroundColor: Colors.error }]}>
                  <MaterialIcons name="priority-high" size={44} color={Colors.textWhite} />
                </View>
                <Text style={styles.modalHeading}>No session found</Text>
                <View style={styles.modalStudentBox}>
                  <StudentAvatar
                    name={modalResult.studentName}
                    imageUrl={modalResult.profileImageUrl}
                  />
                  <Text style={styles.modalStudentName}>{modalResult.studentName || 'Student Member'}</Text>
                </View>
                <Text style={styles.modalDescText}>
                  We couldn't find an eligible session at this location right now. Please speak to your instructor.
                </Text>
                <TouchableOpacity style={styles.primaryModalBtn} onPress={closeModal}>
                  <Text style={styles.primaryModalBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Screen 11: Too Early */}
            {modalResult?.status === 'TOO_EARLY' && (
              <>
                <View style={[styles.statusIconCircle, { backgroundColor: Colors.warning }]}>
                  <MaterialIcons name="access-time" size={44} color={Colors.textWhite} />
                </View>
                <Text style={styles.modalHeading}>You're a little early</Text>
                <View style={styles.modalStudentBox}>
                  <StudentAvatar
                    name={modalResult.studentName}
                    imageUrl={modalResult.profileImageUrl}
                  />
                  <Text style={styles.modalStudentName}>{modalResult.studentName || 'Student Member'}</Text>
                  {modalResult.className ? <Text style={styles.modalSessionTime}>{modalResult.className}</Text> : null}
                </View>
                <Text style={styles.modalDescText}>
                  {modalResult.opensAt ? `Check-in opens at ${modalResult.opensAt}.` : 'Check-in is not open yet. Please check your class timetable.'}
                </Text>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={closeModal}>
                  <Text style={styles.modalCloseBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Screen 12: Check-In Closed */}
            {modalResult?.status === 'CHECKIN_CLOSED' && (
              <>
                <View style={[styles.statusIconCircle, { backgroundColor: Colors.error }]}>
                  <MaterialIcons name="block" size={44} color={Colors.textWhite} />
                </View>
                <Text style={styles.modalHeading}>Check-in has closed</Text>
                <View style={styles.modalStudentBox}>
                  <StudentAvatar
                    name={modalResult.studentName}
                    imageUrl={modalResult.profileImageUrl}
                  />
                  <Text style={styles.modalStudentName}>{modalResult.studentName || 'Student Member'}</Text>
                </View>
                <Text style={styles.modalDescText}>
                  This session check-in window has ended. Please speak to your instructor.
                </Text>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={closeModal}>
                  <Text style={styles.modalCloseBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Screen 13: Invalid QR */}
            {modalResult?.status === 'INVALID_CODE' && (
              <>
                <View style={[styles.statusIconCircle, { backgroundColor: Colors.error }]}>
                  <MaterialIcons name="close" size={48} color={Colors.textWhite} />
                </View>
                <Text style={styles.modalHeading}>QR not recognised</Text>
                <Text style={styles.modalDescText}>
                  Please scan your official member QR pass.
                </Text>
                <TouchableOpacity style={styles.primaryModalBtn} onPress={closeModal}>
                  <Text style={styles.primaryModalBtnText}>Try again</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  permissionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  permissionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  cameraOverlayArea: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  iconCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleBtnActive: {
    backgroundColor: Colors.warning,
  },
  topHeaderCenter: {
    alignItems: 'center',
  },
  headerLogo: {
    width: 130,
    height: 40,
    marginBottom: 2,
  },
  topHeaderOrg: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textWhite,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  topHeaderLoc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bottomBarCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 28,
    width: '100%',
  },
  cancelScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  cancelScanBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  reticleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  reticleBox: {
    width: 250,
    height: 250,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#FFFFFF',
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 20,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 20,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 20,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 20,
  },
  scanningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  scanningText: {
    color: Colors.textWhite,
    fontSize: 13,
    fontWeight: '600',
  },
  scannerInstructions: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textWhite,
    marginBottom: 4,
  },
  scannerSubInstructions: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
  },
  usePinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  usePinBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  liveGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textWhite,
  },
  staffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  staffBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textWhite,
  },

  // Modal styling
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.cardBackground,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  statusIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  modalStudentBox: {
    alignItems: 'center',
    gap: 2,
    marginVertical: 4,
  },
  modalStudentAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
  },
  modalStudentAvatarFallback: {
    width: 68,
    height: 68,
    borderRadius: 34,
    marginBottom: 8,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1,
  },
  modalStudentName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  modalSessionTime: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestampText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.success,
    borderRadius: 2,
    alignSelf: 'flex-start',
  },
  returningText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  modalCloseBtn: {
    width: '100%',
    height: 48,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  modalCloseBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  infoAlertBox: {
    flexDirection: 'row',
    backgroundColor: Colors.infoLight,
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginVertical: 8,
    alignItems: 'center',
  },
  infoAlertText: {
    fontSize: 13,
    color: Colors.text,
    flex: 1,
    lineHeight: 18,
  },
  actionRow: {
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
  confirmCheckOutBtn: {
    width: '100%',
    height: 50,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCheckOutBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  cancelBtn: {
    width: '100%',
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalDescText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginVertical: 6,
  },
  primaryModalBtn: {
    width: '100%',
    height: 50,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryModalBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  demoTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  demoTestBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D9488',
  },
  demoModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E6F4F4',
  },
  demoModalBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D9488',
  },
});
