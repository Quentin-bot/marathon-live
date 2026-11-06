// ─── Réglages : c'est le seul fichier à modifier ───────────────────────────
window.CONFIG = {
  runnerName: "Quentin",
  raceName: "Marathon de Bordeaux",

  // Trace du parcours (fichier dans le même dossier)
  gpx: "trace.gpx",

  // URL de ta Realtime Database Firebase (voir README, étape 1)
  // ex : "https://marathon-live-12345-default-rtdb.europe-west1.firebasedatabase.app"
  firebaseUrl: "",

  // Objectif par défaut (modifiable ensuite en direct depuis runner.html).
  // Remplis targetTime (temps final visé) OU targetPace (allure en min:s par km).
  // Si les deux sont remplis, targetTime l'emporte.
  targetTime: "3:50:00",
  targetPace: "",

  // Optionnel : heure du départ ("2027-04-10T21:00:00+02:00").
  // Permet d'afficher des horaires de passage avant même que tu partes.
  startTime: "",
};
