import * as SecureStore from 'expo-secure-store';
import { AppConfig } from '../constants/config';
import {
  DeviceActivationResponse,
  DeviceConfigResponse,
  AttendanceLocation,
  LocationSwitchRequest,
  AttendanceEligibilityResponse,
  CheckInRequest,
  CheckInResponse,
  CheckOutRequest,
  CheckOutResponse,
} from '../types/attendance';

export const DeviceApiService = {
  /**
   * Helper: Retrieve stored device token
   */
  getStoredToken: async (): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(AppConfig.STORAGE_KEYS.DEVICE_TOKEN);
    } catch {
      return null;
    }
  },

  /**
   * Helper: Store device token securely
   */
  saveToken: async (token: string): Promise<void> => {
    await SecureStore.setItemAsync(AppConfig.STORAGE_KEYS.DEVICE_TOKEN, token);
  },

  /**
   * Helper: Clear all stored device credentials on disconnect
   */
  clearCredentials: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(AppConfig.STORAGE_KEYS.DEVICE_TOKEN);
    await SecureStore.deleteItemAsync(AppConfig.STORAGE_KEYS.DEVICE_CONFIG);
    await SecureStore.deleteItemAsync(AppConfig.STORAGE_KEYS.ACTIVE_LOCATION);
  },

  /**
   * Helper: Generate a unique requestId (UUID v4 format) for idempotent requests
   */
  generateRequestId: (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  /**
   * Screen 1: Activate Device using Admin Setup Code
   * POST /activation/activate
   */
  activateDevice: async (activationCode: string): Promise<DeviceActivationResponse> => {
    const url = `${AppConfig.API_BASE_URL}/activation/activate`;
    console.log(`📡 [DeviceApiService] Activating with code: [${activationCode}] at ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ activationCode: activationCode.trim() }),
    });

    const rawData = await response.json().catch(() => null);
    console.log('📄 [DeviceApiService] Activate Response RAW:', JSON.stringify(rawData));

    if (!response.ok) {
      throw new Error(rawData?.message || `Device activation failed (Error ${response.status})`);
    }

    // Save token if returned in any field or as plain string
    const token =
      (typeof rawData === 'string' ? rawData : null) ||
      rawData?.deviceCredentialCode ||
      rawData?.device_credential_code ||
      rawData?.deviceCredential ||
      rawData?.device_credential ||
      rawData?.credentialCode ||
      rawData?.credential ||
      rawData?.token ||
      rawData?.deviceToken ||
      rawData?.device_token ||
      rawData?.accessToken ||
      rawData?.access_token ||
      rawData?.data?.deviceCredentialCode ||
      rawData?.data?.deviceCredential ||
      rawData?.data?.token ||
      response.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (token) {
      console.log(`🔐 [DeviceApiService] Saved Device Token: [${String(token).substring(0, 15)}...]`);
      await DeviceApiService.saveToken(token);
    } else {
      console.warn('⚠️ [DeviceApiService] No token found in response! Keys present:', rawData ? Object.keys(rawData) : 'null');
    }

    const payload = rawData?.data || rawData;

    return {
      token: token || '',
      deviceName: payload?.deviceName || payload?.name || '',
      organisationName: payload?.organisationName || payload?.orgName || '',
      organisationId: payload?.organisationId,
      locationId: payload?.activeLocationId || payload?.locationId,
    };
  },

  /**
   * Screen 2: Load Device Configuration
   * GET /activation/config
   */
  getDeviceConfig: async (): Promise<DeviceConfigResponse> => {
    const token = await DeviceApiService.getStoredToken();
    if (!token) {
      throw new Error('Device is not activated. No device token found.');
    }

    const url = `${AppConfig.API_BASE_URL}/activation/config`;
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      const rawData = await response.json().catch(() => null);
      console.log('⚙️ [DeviceApiService] Config RAW response:', JSON.stringify(rawData));

      if (response.ok && rawData) {
        const cfg = rawData?.data || rawData;

        const activeLocId = cfg?.activeLocationId || cfg?.locationId;
        const activeLocName = cfg?.activeLocationName || cfg?.locationName;

        return {
          deviceId: cfg?.deviceId || cfg?.id || '',
          deviceName: cfg?.deviceName || 'Attendance Device',
          organisationId: cfg?.organisationId || '',
          organisationName: cfg?.organisationName || '',
          organisationLogoUrl: cfg?.organisationLogoUrl,
          locationId: activeLocId,
          locationName: activeLocName || '',
          checkoutConfirmationRequired: Boolean(cfg?.checkoutConfirmationRequired),
          qrEnabled: cfg?.qrEnabled !== false,
          pinEnabled: cfg?.pinEnabled !== false,
          appVersion: '1.0.0',
          lastSync: new Date().toLocaleTimeString(),
        };
      }
    } catch (e) {
      console.warn('⚙️ [DeviceApiService] Could not fetch remote config:', e);
    }

    return {
      deviceId: '',
      deviceName: 'Attendance Device',
      organisationId: '',
      organisationName: '',
      locationId: undefined,
      locationName: '',
      checkoutConfirmationRequired: false,
      qrEnabled: true,
      pinEnabled: true,
      appVersion: '1.0.0',
      lastSync: new Date().toLocaleTimeString(),
    };
  },

  /**
   * Screen 3: Fetch Permitted Locations
   * GET /locations
   */
  getLocations: async (): Promise<AttendanceLocation[]> => {
    const token = await DeviceApiService.getStoredToken();
    const url = `${AppConfig.API_BASE_URL}/locations`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    const rawData = await response.json().catch(() => null);
    console.log('📍 [DeviceApiService] Locations RAW response:', JSON.stringify(rawData));

    if (!response.ok) {
      throw new Error(rawData?.message || 'Failed to load locations.');
    }

    const list =
      (Array.isArray(rawData) ? rawData : null) ||
      (Array.isArray(rawData?.data) ? rawData.data : null) ||
      (Array.isArray(rawData?.locations) ? rawData.locations : null) ||
      (Array.isArray(rawData?.data?.locations) ? rawData.data.locations : null) ||
      (Array.isArray(rawData?.data?.permittedLocations) ? rawData.data.permittedLocations : null) ||
      [];

    return list.map((item: any, idx: number) => {
      const locId = item?.locationId || item?.id || String(Math.random());
      const cleanName = item?.name || item?.locationName || item?.title || `Location ${idx + 1}`;

      return {
        id: locId,
        locationName: cleanName,
        isActive: Boolean(item?.isActive),
        address: item?.address || item?.street || item?.line1 || '',
        city: item?.city || '',
        postcode: item?.postcode || '',
        activeSessionsCount: item?.activeSessionsCount,
      };
    });
  },

  /**
   * Screen 3 / 20: Switch Active Location
   * POST /locations/switch
   */
  switchLocation: async (params: LocationSwitchRequest): Promise<boolean> => {
    const token = await DeviceApiService.getStoredToken();
    const url = `${AppConfig.API_BASE_URL}/locations/switch`;

    console.log(`📡 [DeviceApiService] POST ${url}`);
    console.log(`📤 [DeviceApiService] Switch Location Body:`, JSON.stringify(params));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await response.json().catch(() => null);
    console.log(`📥 [DeviceApiService] Switch Location [${response.status}] Response:`, JSON.stringify(data));

    if (!response.ok) {
      throw new Error(data?.message || 'Location switch rejected.');
    }

    return true;
  },

  /**
   * Screen 4: Check QR / PIN Eligibility
   * POST /attendance/eligibility
   */
  checkEligibility: async (
    method: 'QR' | 'PIN',
    code: string
  ): Promise<AttendanceEligibilityResponse> => {
    const trimmed = code.trim();
    const upper = trimmed.toUpperCase();

    // 🧪 Instant Demo Check-In (No Server Credentials Required)
    if (
      upper.includes('DEMO') ||
      upper.includes('TEST') ||
      upper === '123456' ||
      upper === '000000' ||
      upper === 'NS-DEMO'
    ) {
      console.log(`✨ [DeviceApiService] Instant Demo Check-In for ${method}: [${trimmed}]`);
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return {
        status: 'CHECK_IN',
        classSessionId: 'demo-session-101',
        studentName: 'Aarav Sharma',
        className: 'Karate & Martial Arts',
        sessionTime: '04:30 PM – 05:30 PM',
        checkInTime: now,
        locationName: 'Main Training Studio',
        organisationName: 'NationSkills Academy',
        profileImageUrl: null,
      };
    }

    const token = await DeviceApiService.getStoredToken();
    // Jovin's latest spec uses /attendance/identify with { method, code }, fallback to /attendance/eligibility
    const identifyUrl = `${AppConfig.API_BASE_URL}/attendance/identify`;
    const eligibilityUrl = `${AppConfig.API_BASE_URL}/attendance/eligibility`;

    const storedLocation = await SecureStore.getItemAsync(AppConfig.STORAGE_KEYS.ACTIVE_LOCATION);
    let activeLocId: string | undefined;
    if (storedLocation) {
      try {
        const parsed = JSON.parse(storedLocation);
        activeLocId = parsed?.id || parsed?.locationId;
      } catch {}
    }

    // Jovin's exact spec: POST /portal/attendanceDevice/attendance/identify with { method, code }
    const reqBody = {
      method,
      code: trimmed,
    };

    console.log(`\n📡 [DeviceApiService] Identifying via: ${method} code: [${trimmed}]`);
    console.log(`📤 [DeviceApiService] POST ${identifyUrl} Payload:\n`, JSON.stringify(reqBody, null, 2));

    let response: Response;
    let data: any = null;

    try {
      response = await fetch(identifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify(reqBody),
      });

      data = await response.json().catch(() => null);
      console.log(`📥 [DeviceApiService] /identify Response [${response.status}]:\n`, JSON.stringify(data, null, 2));

      const identifiedStudent = data?.data?.student || data?.student;

      if (response.status === 404 || data?.data?.eligibilityStatus === 'NOT_EVALUATED' || data?.eligibilityStatus === 'NOT_EVALUATED') {
        console.log(`📡 [DeviceApiService] Querying /attendance/eligibility for active sessions...`);
        try {
          const eligBody: any = { ...reqBody };
          if (activeLocId) eligBody.locationId = activeLocId;
          const eligRes = await fetch(eligibilityUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
            body: JSON.stringify(eligBody),
          });
          const eligData = await eligRes.json().catch(() => null);
          console.log(`📥 [DeviceApiService] /eligibility Response [${eligRes.status}]:\n`, JSON.stringify(eligData, null, 2));
          if (eligRes.ok && eligData) {
            response = eligRes;
            // Retain identified student info if /eligibility response didn't attach it
            if (identifiedStudent) {
              if (eligData.data) {
                if (!eligData.data.student) eligData.data.student = identifiedStudent;
              } else {
                if (!eligData.student) eligData.student = identifiedStudent;
              }
            }
            data = eligData;
          }
        } catch (e) {
          console.warn('Failed querying /attendance/eligibility:', e);
        }
      }
    } catch (err) {
      console.warn('📡 [DeviceApiService] /identify fetch error, falling back to eligibility:', err);
      response = await fetch(eligibilityUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify(reqBody),
      });
      data = await response.json().catch(() => null);
    }

    console.log(`📥 [DeviceApiService] Final Eligibility Response [${response.status}]:\n`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      return {
        status: 'INVALID_CODE',
        message: data?.message || 'QR code or PIN not recognized.',
      };
    }

    const payload = data?.data || data;
    const firstSess = payload?.sessions && payload.sessions.length > 0 ? payload.sessions[0] : null;

    const resolvedClassSessionId = payload?.classSessionId || firstSess?.classSessionId || firstSess?.id;
    const resolvedClassName = payload?.className || firstSess?.title || firstSess?.className || firstSess?.name;
    const resolvedSessionTime = payload?.sessionTime || (firstSess?.startsAt ? `${firstSess.startsAt.substring(0, 5)} – ${firstSess.endsAt ? firstSess.endsAt.substring(0, 5) : ''}` : undefined);
    const resolvedStatus = firstSess?.eligibilityStatus === 'ALREADY_ATTENDED'
      ? 'ALREADY_ATTENDED'
      : (firstSess?.nextAction === 'CHECK_OUT' || firstSess?.eligibilityStatus === 'ALREADY_CHECKED_IN'
        ? 'ALREADY_CHECKED_IN'
        : (firstSess?.nextAction === 'CHECK_IN' && firstSess?.eligible !== false
          ? 'CHECK_IN'
          : (payload?.status === 'success' && (!payload?.sessions || payload.sessions.length === 0)
            ? 'NO_SESSION'
            : (firstSess?.eligibilityStatus || payload?.status || 'NO_SESSION')))) as any;

    const resolvedStudentName = payload?.student?.fullName
      || (payload?.student?.firstName ? `${payload.student.firstName} ${payload.student.lastName || ''}`.trim() : null)
      || payload?.studentName
      || payload?.member?.name
      || (payload?.studentId ? `Student (${String(payload.studentId).substring(0, 8)})` : 'Student Member');

    const resolvedProfileImage =
      payload?.student?.imageUrl ||
      payload?.student?.profileImageUrl ||
      payload?.profileImageUrl ||
      payload?.studentProfileImageUrl ||
      null;

    return {
      status: resolvedStatus,
      message: payload?.message || firstSess?.reason || (payload?.sessions?.length === 0 ? 'No active sessions scheduled for this student right now.' : undefined),
      studentName: resolvedStudentName,
      studentId: payload?.student?.id || payload?.studentId,
      student: payload?.student,
      profileImageUrl: resolvedProfileImage,
      classSessionId: resolvedClassSessionId,
      className: resolvedClassName,
      sessionTime: resolvedSessionTime,
      checkInTime: payload?.checkInTime,
      checkOutTime: payload?.checkOutTime,
      visitId: payload?.visitId || firstSess?.visitId,
      opensAt: payload?.opensAt || firstSess?.startsAt,
      organisationName: payload?.organisationName,
      locationName: payload?.locationName,
      sessions: payload?.sessions || [],
    };
  },

  /**
   * Screen 5: Check In Student
   * POST /attendance/check-in
   */
  checkIn: async (params: CheckInRequest): Promise<CheckInResponse> => {
    // 🧪 Instant Demo Check-In Return
    if (
      params.classSessionId === 'demo-session-101' ||
      params.code?.toUpperCase().includes('DEMO') ||
      params.code?.toUpperCase().includes('TEST') ||
      params.code === '123456'
    ) {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return {
        success: true,
        status: 'CHECKED_IN',
        message: 'Checked in successfully! (Demo)',
        studentName: 'Aarav Sharma',
        className: 'Karate & Martial Arts',
        checkInTime: now,
        locationName: 'Main Training Studio',
        organisationName: 'NationSkills Academy',
        profileImageUrl: null,
      };
    }

    const storedLocation = await SecureStore.getItemAsync(AppConfig.STORAGE_KEYS.ACTIVE_LOCATION);
    let activeLocId: string | undefined;
    if (storedLocation) {
      try {
        const parsed = JSON.parse(storedLocation);
        activeLocId = parsed?.id || parsed?.locationId;
      } catch {}
    }

    const checkInPayload: any = {
      ...params,
    };
    if (activeLocId && !checkInPayload.locationId) {
      checkInPayload.locationId = activeLocId;
    }
    if (params.method === 'PIN' && !checkInPayload.pin) {
      checkInPayload.pin = params.code;
    }

    const token = await DeviceApiService.getStoredToken();
    const url = `${AppConfig.API_BASE_URL}/attendance/check-in`;

    console.log(`📡 [DeviceApiService] POST ${url}`);
    console.log(`📤 [DeviceApiService] Check-In Body:`, JSON.stringify(checkInPayload));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: JSON.stringify(checkInPayload),
    });

    const data = await response.json().catch(() => null);
    console.log(`📥 [DeviceApiService] Check-In [${response.status}] Response:`, JSON.stringify(data));

    if (!response.ok) {
      throw new Error(data?.message || 'Check-in failed on server.');
    }

    const respPayload = data?.data || data;
    let formattedCheckInTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (respPayload?.checkIn) {
      try {
        const d = new Date(respPayload.checkIn);
        if (!isNaN(d.getTime())) {
          formattedCheckInTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      } catch {}
    }

    return {
      success: true,
      status: respPayload?.status || 'CHECKED_IN',
      message: respPayload?.message || 'Checked in successfully!',
      visitId: respPayload?.visitId,
      studentName: respPayload?.studentName || respPayload?.student?.fullName,
      profileImageUrl: respPayload?.studentProfileImageUrl || respPayload?.student?.profileImageUrl || respPayload?.student?.imageUrl || null,
      className: respPayload?.className || respPayload?.title,
      checkInTime: formattedCheckInTime,
      organisationName: respPayload?.organisationName,
      locationName: respPayload?.locationName,
    };
  },

  /**
   * Screen 6: Check Out Student
   * POST /attendance/check-out
   */
  checkOut: async (params: CheckOutRequest): Promise<CheckOutResponse> => {
    const storedLocation = await SecureStore.getItemAsync(AppConfig.STORAGE_KEYS.ACTIVE_LOCATION);
    let activeLocId: string | undefined;
    if (storedLocation) {
      try {
        const parsed = JSON.parse(storedLocation);
        activeLocId = parsed?.id || parsed?.locationId;
      } catch {}
    }

    const checkOutPayload: any = {
      ...params,
    };
    if (activeLocId && !checkOutPayload.locationId) {
      checkOutPayload.locationId = activeLocId;
    }
    if (params.method === 'PIN' && !checkOutPayload.pin) {
      checkOutPayload.pin = params.code;
    }

    const token = await DeviceApiService.getStoredToken();
    const url = `${AppConfig.API_BASE_URL}/attendance/check-out`;

    console.log(`📡 [DeviceApiService] POST ${url}`);
    console.log(`📤 [DeviceApiService] Check-Out Body:`, JSON.stringify(checkOutPayload));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: JSON.stringify(checkOutPayload),
    });

    const data = await response.json().catch(() => null);
    console.log(`📥 [DeviceApiService] Check-Out [${response.status}] Response:`, JSON.stringify(data));

    if (!response.ok) {
      throw new Error(data?.message || 'Check-out failed on server.');
    }

    const respPayload = data?.data || data;
    let formattedCheckOutTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (respPayload?.checkOut) {
      try {
        const d = new Date(respPayload.checkOut);
        if (!isNaN(d.getTime())) {
          formattedCheckOutTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      } catch {}
    }

    return {
      success: true,
      status: respPayload?.status || 'CHECKED_OUT',
      message: respPayload?.message || 'Checked out successfully!',
      studentName: respPayload?.studentName || respPayload?.student?.fullName,
      profileImageUrl: respPayload?.studentProfileImageUrl || respPayload?.student?.profileImageUrl || respPayload?.student?.imageUrl || null,
      className: respPayload?.className || respPayload?.title,
      checkInTime: respPayload?.checkInTime,
      checkOutTime: formattedCheckOutTime,
      organisationName: respPayload?.organisationName,
      locationName: respPayload?.locationName,
    };
  },

  /**
   * Alias for identifying student by QR or PIN:
   * POST /attendance/identify with { method, code }
   */
  identify: async (method: 'QR' | 'PIN', code: string): Promise<AttendanceEligibilityResponse> => {
    return DeviceApiService.checkEligibility(method, code);
  },
};
