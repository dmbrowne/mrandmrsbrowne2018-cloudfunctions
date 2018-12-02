"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firebaseAdmin = require("firebase-admin");
const serviceAccount = require('../brownes2018-wedding-firebase-adminsdk-k556p-de979a89dc.json');
firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
    databaseURL: 'https://brownes2018-wedding.firebaseio.com',
});
const storage = firebaseAdmin.storage();
const fireStore = firebaseAdmin.firestore();
fireStore.settings({ timestampsInSnapshots: true });
exports.adminStorage = storage;
exports.firestore = fireStore;
exports.admin = firebaseAdmin;
function addCloudinaryRefToFirestore(filePath, result) {
    return exports.firestore.doc(`cloudinaryFiles/${filePath}`).set(result);
}
exports.addCloudinaryRefToFirestore = addCloudinaryRefToFirestore;
//# sourceMappingURL=firebaseAdmin.js.map