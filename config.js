// ─── Réglages : c'est le seul fichier à modifier ───────────────────────────
window.CONFIG = {
  runnerName: "Quentin",
  raceName: "Marathon de Bordeaux",

  // Trace du parcours (fichier dans le même dossier)
  gpx: "trace.gpx",

  // URL de ta Realtime Database Firebase (voir README, étape 1)
  // ex : "https://marathon-live-12345-default-rtdb.europe-west1.firebasedatabase.app"
  firebaseUrl: "",

  // Allure objectif (min:s par km) : sert au lièvre virtuel et aux estimations
  // tant qu'il n'y a pas encore assez de points GPS.
  targetPace: "5:30",

  // Optionnel : heure du départ ("2027-04-10T21:00:00+02:00").
  // Permet d'afficher des horaires de passage avant même que tu partes.
  startTime: "",
};
