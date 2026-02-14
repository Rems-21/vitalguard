import { VitalSigns, PatientProfile, Alert } from "../types";

export const syncDataToCloud = async (
  apiUrl: string,
  profile: PatientProfile, 
  history: VitalSigns[], 
  alerts: Alert[]
): Promise<boolean> => {
  // Si aucune URL n'est configurée, on annule la synchronisation
  if (!apiUrl || apiUrl.trim() === '') {
    console.log("☁️ Sync annulée : Aucune URL API configurée.");
    return false;
  }

  try {
    const payload = {
      patientId: profile.id,
      timestamp: Date.now(),
      profile: profile,
      vitals: history.length > 0 ? history[history.length - 1] : null,
      alerts: alerts.filter(a => !a.read)
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Ajoutez ici d'autres headers si nécessaire (ex: Authorization)
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    console.log("☁️ Données synchronisées avec succès vers :", apiUrl);
    return true;

  } catch (error) {
    console.error("Erreur de synchronisation cloud:", error);
    return false;
  }
};