import * as firebaseAdmin from 'firebase-admin';
const serviceAccount = require('../creds/brownes2018-wedding-firebase-adminsdk-k556p-de979a89dc.json');

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
  databaseURL: 'https://brownes2018-wedding.firebaseio.com',
});

const storage = firebaseAdmin.storage();
const fireStore = firebaseAdmin.firestore();

fireStore.settings({ timestampsInSnapshots: true });

export const adminStorage = storage;
export const firestore = fireStore;
export const admin = firebaseAdmin;

export function addCloudinaryRefToFirestore(filePath, result) {
	return firestore.doc(`cloudinaryFiles/${filePath}`).set(result)
}
