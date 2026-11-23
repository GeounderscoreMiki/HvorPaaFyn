// Firebase-nøglerne er ikke hemmelige – det er reglerne i firestore.rules, der beskytter databasen.
// Det nye spil bruger egne samlinger (hpf_scores, hpf_stats), så det gamle spils data ikke berøres.
export const firebaseConfig = {
  apiKey: 'AIzaSyCtUQqA029yz0Xx27iSu0FE1IDbeR2Nsms',
  authDomain: 'fynsspil.firebaseapp.com',
  projectId: 'fynsspil',
  appId: '1:1021548556343:web:adc5b099009d10b5278fb2',
};

export const questionSeconds = 90;
export const maxLives = 3;
