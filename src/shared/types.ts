export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    requestId: string;
    timestamp: number;
  };
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
  meta?: {
    requestId: string;
    timestamp: number;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface HealthCheckData {
  status: 'ok' | 'degraded';
  environment: string;
  version: string;
  timestamp: number;
  uptimeSeconds: number;
  services: {
    database: 'connected' | 'unreachable';
  };
}

export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'invited' | 'disabled';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: number;
}

export type ThemeMode = 'system' | 'light' | 'dark';
export type AccentColor = 'emerald' | 'indigo' | 'violet' | 'amber' | 'rose' | 'cyan';
export type FontSize = 'small' | 'normal' | 'large';
export type Density = 'compact' | 'comfortable' | 'spacious';
export type BorderRadius = 'none' | 'small' | 'medium' | 'large';
export type ReducedMotion = 'system' | 'reduce' | 'no-preference';

export interface UserPreferencesData {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  fontSize: FontSize;
  density: Density;
  borderRadius: BorderRadius;
  reducedMotion: ReducedMotion;
  sidebarCollapsed: boolean;
  timezone?: string;
  baseCurrency?: string;
}

export interface AuthSessionData {
  user: PublicUser;
  preferences: UserPreferencesData;
  isInitialSetup: boolean;
}

export interface AuditEventData {
  id: string;
  userId?: string | null;
  eventType: string;
  ipHash?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: number;
}

export interface InviteData {
  id: string;
  code: string;
  email: string;
  role: UserRole;
  expiresAt: number;
  usedAt?: number | null;
  createdAt: number;
}

export * from './platformTypes';
export * from './productivityTypes';
export * from './trackerTypes';
export * from './financeTypes';
export * from './investmentTypes';

