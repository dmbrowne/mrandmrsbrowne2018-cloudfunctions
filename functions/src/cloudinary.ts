import * as functions from 'firebase-functions';
import * as cloudinary from 'cloudinary';

export interface UploadResponse {
	status?: 'pending',
	public_id: string,
	version: string,
	width: number,
	height: number,
	format: 'jpg',
	created_at: string,
	resource_type: 'image' | 'video',
	tags: string[],
	bytes: number,
	type: 'upload',
	etag: string,
	url: string,
	secure_url: string,
	signature: string,
	original_filename: string,
}

cloudinary.config({
  cloud_name: functions.config().cloudinary.cloudname,
  api_key: functions.config().cloudinary.apikey,
  api_secret: functions.config().cloudinary.apisecret,
});

export function upload(...args): Promise<UploadResponse> {
	const largeUpload = args.length === 3 ? args.pop() : false;
	const uploadFn = largeUpload
		? cloudinary.v2.uploader.upload_large
		: cloudinary.v2.uploader.upload;

	return new Promise((resolve, reject) => {
    uploadFn(...args, (err, res) => {
			if (err) reject(err)
			else resolve(res)
		})
	})
}

export const folderName = 'wedding-day-app';
export default cloudinary
