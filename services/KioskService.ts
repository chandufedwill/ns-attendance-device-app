import { Platform, BackHandler, NativeEventSubscription } from 'react-native';
import * as KeepAwake from 'expo-keep-awake';
import * as NavigationBar from 'expo-navigation-bar';
import * as SecureStore from 'expo-secure-store';

const KIOSK_STORAGE_KEY = 'NS_KIOSK_LOCKED_STATE';

class KioskServiceManager {
  private isLocked: boolean = true;
  private backSubscription: NativeEventSubscription | null = null;

  public async init(): Promise<boolean> {
    try {
      const stored = await SecureStore.getItemAsync(KIOSK_STORAGE_KEY);
      if (stored !== null) {
        this.isLocked = stored === 'true';
      } else {
        // Default is locked for kiosk security
        this.isLocked = true;
      }
    } catch {
      this.isLocked = true;
    }

    if (this.isLocked) {
      await this.applyLockState(true);
    }
    return this.isLocked;
  }

  public getIsLocked(): boolean {
    return this.isLocked;
  }

  public async setLocked(locked: boolean): Promise<void> {
    this.isLocked = locked;
    try {
      await SecureStore.setItemAsync(KIOSK_STORAGE_KEY, locked ? 'true' : 'false');
    } catch {}
    await this.applyLockState(locked);
  }

  private async applyLockState(locked: boolean): Promise<void> {
    try {
      if (locked) {
        // 1. Keep tablet screen awake indefinitely
        KeepAwake.activateKeepAwakeAsync('kiosk_attendance').catch(() => {});

        // 2. Hide system navigation bar on Android (immersive sticky mode)
        if (Platform.OS === 'android') {
          await NavigationBar.setVisibilityAsync('hidden').catch(() => {});
          await NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
        }

        // 3. Prevent hardware/gesture back press from exiting app
        if (!this.backSubscription) {
          this.backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
            return true; // Consumes event, prevents back action
          });
        }
      } else {
        // Unlock mode for maintenance
        KeepAwake.deactivateKeepAwake('kiosk_attendance').catch(() => {});

        if (Platform.OS === 'android') {
          await NavigationBar.setVisibilityAsync('visible').catch(() => {});
          await NavigationBar.setBehaviorAsync('inset-touch').catch(() => {});
        }

        if (this.backSubscription) {
          this.backSubscription.remove();
          this.backSubscription = null;
        }
      }
    } catch (err) {
      console.warn('KioskService applyLockState error:', err);
    }
  }
}

export const KioskService = new KioskServiceManager();
