// Test helper: prints a Firebase custom token for a given uid (journey testing only).
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "autodeck-studio", serviceAccountId: "autodeck-studio@appspot.gserviceaccount.com" });
admin.auth().createCustomToken(process.argv[2]).then((t) => console.log("TOK=" + t + "=END")).catch((e) => { console.error(e.message); process.exit(1); });
