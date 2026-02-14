import { GoogleGenAI } from "@google/genai";
import { VitalSigns, PatientProfile } from "../types";
import { THRESHOLDS } from "../constants";

export const analyzeVitalsWithGemini = async (
  vitals: VitalSigns, 
  profile: PatientProfile,
  userApiKey: string
): Promise<string> => {
  try {
    // On utilise la clé fournie par l'utilisateur
    if (!userApiKey || userApiKey.trim() === '') {
      return "Clé API Gemini manquante. Veuillez la configurer dans l'onglet Profil.";
    }

    const ai = new GoogleGenAI({ apiKey: userApiKey });

    const prompt = `
      Tu es un assistant médical IA avancé pour "VitalGuard". Analyse les signes vitaux suivants pour ce patient spécifique.
      
      PROFIL PATIENT :
      - Nom : ${profile.name}
      - Âge : ${profile.age} ans
      - Condition médicale connue : ${profile.condition}
      - Poids/Taille : ${profile.weight}kg / ${profile.height}cm

      DONNÉES EN TEMPS RÉEL :
      - Rythme Cardiaque : ${vitals.heartRate} bpm (Normal: ${THRESHOLDS.HEART_RATE.MIN}-${THRESHOLDS.HEART_RATE.MAX})
      - SpO2 : ${vitals.spO2}% (Cible > ${THRESHOLDS.SPO2.MIN}%)
      - Température : ${vitals.temperature}°C
      - Tension Artérielle : ${vitals.systolicBP}/${vitals.diastolicBP} mmHg
      - Mouvement : ${vitals.isMoving ? "En mouvement" : "Au repos"}

      TA MISSION :
      1. Analyse : Détecte toute anomalie subtile en tenant compte de l'âge et de la condition du patient (ex: une tension normale pour un jeune peut être basse pour une personne âgée hypertendue).
      2. Conseil : Donne un conseil immédiat et actionnable pour le patient ou l'aidant.
      
      FORMAT DE RÉPONSE (en Français, ton professionnel mais rassurant, max 60 mots) :
      [Analyse] : <Ton analyse brève>
      [Conseil] : <Ton conseil pratique>
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Aucune analyse générée.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Erreur lors de l'analyse IA. Vérifiez votre clé API et votre connexion internet.";
  }
};