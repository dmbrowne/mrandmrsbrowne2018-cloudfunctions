// import * as functions from 'firebase-functions';
// import { adminStorage, firestore, admin } from './firebaseAdmin';

// const functionsObject = functions.storage.object;

// export const CloudinaryUploadSuccessNotification = functions.https.onRequest(function updateMediaDocumentCloudinaryInfo(req, res) {
// 	const result = req.body;
// 	const collection = result.resource_type === 'image' ? 'photos' : 'videos';

// 	return firestore
// 		.collection(collection)
// 		.where('cloudinaryPublicId', '==', result.public_id)
// 		.get()
// 		.then(snapshot => {
// 			if (!snapshot.docs.length) {
// 				res.status(400).send({ message: 'document does not exist' });
// 			}
// 			const document = snapshot.docs[0]
// 			document.ref.update({ cloudinary: result, complete: true, })
// 				.then(() => res.send(result))
// 				.catch(e => res.status(400).send({ error: e }))
// 		})
// });