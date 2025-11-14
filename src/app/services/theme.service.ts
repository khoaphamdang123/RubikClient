import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'ADMIN_UI_THEME';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly documentRef: Document;
  private readonly theme$ = new BehaviorSubject<ThemeMode>('light');

  constructor(@Inject(DOCUMENT) document: Document) {
    this.documentRef = document;
    const stored = this.getStoredTheme();
    const preferred = this.getPreferredTheme();
    const initial = stored ?? preferred;
    this.setTheme(initial);
  }

  /**
   * Observable that emits whenever theme changes.
   */
  get themeChanges() {
    return this.theme$.asObservable();
  }

  /**
   * Returns the current theme mode.
   */
  get currentTheme(): ThemeMode {
    return this.theme$.value;
  }

  /**
   * Toggles between light and dark themes.
   */
  toggleTheme(): ThemeMode {
    const nextTheme: ThemeMode = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(nextTheme);
    return nextTheme;
  }

  /**
   * Explicitly sets a theme and syncs across document + storage.
   */
  setTheme(theme: ThemeMode): void {
    if (this.theme$.value !== theme) {
      this.theme$.next(theme);
    }
    this.persistTheme(theme);
    this.applyThemeToDocument(theme);
  }

  private getStoredTheme(): ThemeMode | null {
    try {
      const fromStorage = localStorage.getItem(STORAGE_KEY);
      if (fromStorage === 'light' || fromStorage === 'dark') {
        return fromStorage;
      }
    } catch (error) {
      console.warn('Unable to access theme in localStorage:', error);
    }
    return null;
  }

  private persistTheme(theme: ThemeMode): void {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      console.warn('Unable to persist theme preference:', error);
    }
  }

  private getPreferredTheme(): ThemeMode {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  private applyThemeToDocument(theme: ThemeMode): void {
    const root = this.documentRef.documentElement;
    root.setAttribute('data-theme', theme);

    // Allow smooth transitions on first manual change.
    root.classList.add('theme-initialized');
  }
}

