import * as SecureStore from 'expo-secure-store';

export interface DeviceSettings {
  qrEnabled: boolean;
  pinEnabled: boolean;
  kioskLocked: boolean;
}

const SETTINGS_KEY = 'ns_attendance_device_settings';

export const DeviceSettingsService = {
  getSettings: async (): Promise<DeviceSettings> => {
    try {
      const stored = await SecureStore.getItemAsync(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          qrEnabled: parsed.qrEnabled !== false,
          pinEnabled: parsed.pinEnabled !== false,
          kioskLocked: parsed.kioskLocked !== false,
        };
      }
    } catch (e) {
      console.warn('Failed to load device settings:', e);
    }
    return {
      qrEnabled: true,
      pinEnabled: true,
      kioskLocked: true,
    };
  },

  saveSettings: async (settings: Partial<DeviceSettings>): Promise<DeviceSettings> => {
    try {
      const current = await DeviceSettingsService.getSettings();
      const updated: DeviceSettings = {
        ...current,
        ...settings,
      };
      await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.warn('Failed to save device settings:', e);
      throw e;
    }
  },
};
