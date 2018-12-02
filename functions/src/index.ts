import * as functions from 'firebase-functions';
import cloudinary, { upload as cloudinaryUpload, folderName } from './cloudinary';
import { adminStorage, firestore, admin } from './firebaseAdmin';

const functionsObject = functions.storage.object;
const functionsDocument = functions.firestore.document;

export const uploadNotification = functions.https.onRequest(updateMediaDocumentCloudinaryInfo);

export const migrateMediaData = functions.https.onCall(function migrateMedia() {
	const migrateDocRef = firestore.collection('migrations').doc('moveMediaLocation');
	return Promise.all([
		firestore.collection('photos').get(),
		firestore.collection('videos').get(),
	])
	.then(([photoSnapshots, videoSnapshots]) => {
		const totalItemsToMigrate = photoSnapshots.docs.length + videoSnapshots.docs.length;
		return migrateDocRef.set({
			inProgress: true,
			totalItemsToMigrate,
			migrated: [],
		})
		.then(() => [photoSnapshots, videoSnapshots]);
	})
	.then(snapshots => snapshots.map(mediaSnapshots =>
		mediaSnapshots.docs.map(doc => {
			const isVideo = doc.ref.path.includes('video');
			const docData = doc.data();
			return firestore.collection('media').doc(doc.id).set({
				...docData,
				mediaType: isVideo ? 'video' : 'image',
				takenAt: docData.takenAt || docData.createdAt,
			})
			.then(() => migrateDocRef.update({
				migrated: admin.firestore.FieldValue.arrayUnion(doc.id),
			}))
		})
	))
	.then(() => migrateDocRef.update({ inProgress: false }))
	.catch(err => {
		migrateDocRef.update({ inProgress: false });
		throw new functions.https.HttpsError('invalid-argument', err.message);
	})
});

export const imageUpload = functionsObject().onFinalize(addImageToCloudinaryAndUpdateFirestore);
export const videoUpload = functionsObject().onFinalize(addVideoToCloudinaryAndUpdateFirestore);
export const removeMediaFromCloudinary = functionsObject().onDelete(RemoveMediaFromCloudinary);
export const removeMediaFromFirestore = functionsObject().onDelete(RemoveMediaFromFirestore);

export const updatePhotoFeedPost = functionsDocument('photos/{id}').onUpdate(markFeedPostAsViewable);
export const updateVideoFeedPost = functionsDocument('videos/{id}').onUpdate(markFeedPostAsViewable);
export const photoDelete_deleteFeedPost = functionsDocument('photos/{id}').onDelete(DeleteFeedItem);
export const videoDelete_deleteFeedPost = functionsDocument('videos/{id}').onDelete(DeleteFeedItem);

export const addCreatedAtToComments = functionsDocument('feedPostComments/{postid}/comments/{commentId}').onCreate(addCreatedAtTimestamp);
export const addCreatedAtToFeedPost = functionsDocument('feed/{id}').onCreate(addCreatedAtTimestamp);
export const addCreatedAtToPhotoMedia = functionsDocument('photos/{id}').onCreate(addCreatedAtTimestamp);
export const addCreatedAtToVideoMedia = functionsDocument('videos/{id}').onCreate(addCreatedAtTimestamp);
export const addCreatedAtToScenarioMedia = functionsDocument(
	'games/{gameId}/scenarios/{scenarioId}/media/{mediaId}'
).onCreate(addCreatedAtTimestamp);


const expiryTime = () => Date.now() + 300000; // expires in 5 minutes

function addCreatedAtTimestamp(snap, context) {
	return snap.ref.update({
		createdAt: admin.firestore.FieldValue.serverTimestamp()
	})
}

function DeleteFeedItem(snap) {
	return firestore
		.collection('feed')
		.where('mediaReference', 'array-contains', snap.ref)
		.get()
		.then(snapshot => {
			if (!snapshot.empty) {
				const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
				return Promise.all(deletePromises) as PromiseLike<any>;
			}
			return false;
		})
}

async function addImageToCloudinaryAndUpdateFirestore(object) {
	if (!object.contentType.includes('image')) {
    return Promise.reject('object is not of image type');
  }

	if (object.metaData && object.metaData.thumbnail) {
		return Promise.reject('file upload is a thumbnail');
	}

	const fileClass = adminStorage.bucket(object.bucket).file(object.name);
	const [url] = await fileClass.getSignedUrl({ action: 'read', expires: expiryTime() });

	const result = await cloudinaryUpload(url, {
		folder: folderName,
		public_id: object.name,
		resource_type: 'auto',
		width: 1024,
		height: 768,
		crop: 'limit',
		quality: 'auto:good',
		eager: [
			{
				aspect_ratio: '16:10',
				crop: 'crop',
			},
			{
				aspect_ratio: '1:1',
				crop: 'crop',
			},
			{
				aspect_ratio: '16:10',
				crop: 'crop',
				quality: '50',
				effect: 'blur:800',
			},
		]
	})

	const photosSnapshot = await firestore.collection('photos').where(
		'storageReference',
		'==',
		object.name
	).get();

	if (photosSnapshot.empty) {
		throw Error(`photo document with storageReference ${object.name} couldn\'t be found!`)
	}

	const photoDocument = photosSnapshot.docs[0]
	return photoDocument.ref.update({
		cloudinaryPublicId: result.public_id,
		cloudinary: result,
		complete: true,
	})
}

async function addVideoToCloudinaryAndUpdateFirestore(object) {
	if (!object.contentType.includes('video')) {
    return false;
  }

	const publicId = object.name;
	const fileClass = adminStorage.bucket(object.bucket).file(object.name);
	const [metaData] = await fileClass.getMetadata();
	const [url] = await fileClass.getSignedUrl({ action: 'read', expires: expiryTime() });

  const notificationUrl = 'https://us-central1-brownes2018-wedding.cloudfunctions.net/uploadNotification'
	const fileIsLarge = metaData.size >= 1000000;

	const result = await cloudinaryUpload(url, {
		public_id: publicId,
		folder: folderName,
		resource_type: 'video',
		width: 700,
		height: 700,
		format: 'mp4',
		crop: 'limit',
    async: fileIsLarge,
		...fileIsLarge ? { notification_url: notificationUrl }: {},
		eager: [
			{
				crop: 'crop',
				aspect_ratio: '5:4',
				format: 'mp4',
			},
			{
				crop: 'crop',
				aspect_ratio: '1:1',
				format: 'jpg',
			},
			{
				crop: 'crop',
				aspect_ratio: '5:4',
				format: 'jpg',
				quality: '30',
				effect: 'blur:800',
			},
		]
	}, fileIsLarge)

	const videosSnapshot = await firestore.collection('videos').where(
		'storageReference',
		'==',
		object.name
	).get();

	if (videosSnapshot.empty) {
		throw Error(`video document with storageReference ${object.name} couldn\'t be found!`)
	}

	const videoDocument = videosSnapshot.docs[0]
	return videoDocument.ref.update({
		cloudinaryPublicId: result.public_id,
		cloudinary: result,
		complete: result.status !== 'pending',
	})
}

function RemoveMediaFromCloudinary(object) {
	if (!object.contentType.includes('image') && !object.contentType.includes('video')) {
    return false;
  }

	return new Promise((resolve, reject) => {
		cloudinary.v2.uploader.destroy(
			`${folderName}/${object.name}`,
			{
				invalidate: true,
			},
			(err, res) => {
				if (err) reject(err)
				else resolve(res);
			}
		);
	});
}

function RemoveMediaFromFirestore(object) {
	if (!object.contentType.includes('image') && !object.contentType.includes('video')) {
    return false;
  }

	const collection = object.contentType.includes('image') ? 'photos' : 'videos';
	const cloudinaryPublicId = `${folderName}/${object.name}`;

	return firestore
		.collection(collection)
		.where('cloudinaryPublicId', '==', cloudinaryPublicId)
		.get()
		.then(snapshot => {
			const media = snapshot.docs[0]
			if (media) {
				return media.ref.delete()
			}
			console.error('no documents found with public_id:' + cloudinaryPublicId);
			return null;
		});
}

function updateMediaDocumentCloudinaryInfo(req, res) {
	const result = req.body;
	const collection = result.resource_type === 'image' ? 'photos' : 'videos';
	
	return firestore
		.collection(collection)
		.where('cloudinaryPublicId', '==', result.public_id)
    .get()
    .then(snapshot => {
      if (!snapshot.docs.length) {
        res.status(400).send({ message: 'document does not exist'});
      }
      const document = snapshot.docs[0]
      document.ref.update({ cloudinary: result, complete: true, })
        .then(() => res.send(result))
        .catch(e => res.status(400).send({ error: e }))
    })
}

function markFeedPostAsViewable({after, before}) {
	const { complete: prevComplete } = before.data();
	const { complete: nextComplete, cloudinary: cloudinaryData } = after.data();
	
	if (!prevComplete && !!nextComplete) {
		const blurredImgTranformation = cloudinaryData.eager && cloudinaryData.eager[2];

		return firestore
		.collection('feed')
		.where('mediaReference', 'array-contains', after.ref)
		.get()
			.then(snapshot => {
				if (snapshot.empty) {
					return Promise.reject(`feed post with mediaReference ${after.ref} not found`);
				}
				const documentSnapshot = snapshot.docs[0];
				const { mediaReference, loaderImg = [] } = documentSnapshot.data();
				let { mediaComplete } = documentSnapshot.data();

				if (!mediaComplete) {
					mediaComplete = 0
				}

				// this update is the last of the media documents to update
				const newMediaCompleteValue = (mediaComplete === mediaReference.length - 1)
					? true
					: mediaComplete + 1 || 0;

				return documentSnapshot.ref.update({
					mediaComplete: newMediaCompleteValue,
					loaderImg: [
						...loaderImg,
						...blurredImgTranformation
							? [blurredImgTranformation.secure_url]
							: []
					]
				})
			})
	}

	return Promise.resolve('complete stauses are the same');
}
