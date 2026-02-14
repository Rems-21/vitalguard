export const THRESHOLDS = {
  HEART_RATE: {
    MIN: 60,
    MAX: 100,
    CRITICAL_MIN: 45,
    CRITICAL_MAX: 120
  },
  SPO2: {
    MIN: 95,
    CRITICAL: 92
  },
  TEMPERATURE: {
    MIN: 36.0,
    MAX: 37.5,
    FEVER: 38.0
  },
  BP_SYSTOLIC: {
    MAX: 130,
    CRITICAL: 140
  },
  BP_DIASTOLIC: {
    MAX: 85,
    CRITICAL: 90
  }
};

export const MOCK_PATIENT = {
  id: "PAT-001",
  name: "Jean Dupont",
  age: 64,
  condition: "Hypertension Chronique",
  bloodType: "A+",
  weight: 78,
  height: 175
};