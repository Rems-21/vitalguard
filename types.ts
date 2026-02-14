export interface VitalSigns {
  timestamp: number;
  heartRate: number; // bpm
  spO2: number; // %
  temperature: number; // Celsius
  systolicBP: number; // mmHg
  diastolicBP: number; // mmHg
  batteryLevel: number; // %
  isMoving: boolean; // from accelerometer
}

export enum SensorStatus {
  CONNECTED = 'Connecté',
  DISCONNECTED = 'Déconnecté',
  CALIBRATING = 'Calibrage'
}

export interface AnomalyReport {
  hasAnomaly: boolean;
  severity: 'low' | 'medium' | 'critical' | 'none';
  message: string;
  recommendation: string;
}

export interface PatientProfile {
  id: string;
  name: string;
  age: number;
  condition: string;
  bloodType: string;
  weight: number;
  height: number;
}

export interface Alert {
  id: string;
  type: 'temperature' | 'heartRate' | 'spo2' | 'bp';
  message: string;
  value: string;
  timestamp: number;
  read: boolean;
}