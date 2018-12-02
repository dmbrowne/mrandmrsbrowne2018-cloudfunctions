"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const cloudinary = require("cloudinary");
cloudinary.config({
    cloud_name: functions.config().cloudinary.cloudname,
    api_key: functions.config().cloudinary.apikey,
    api_secret: functions.config().cloudinary.apisecret,
});
function upload(...args) {
    const largeUpload = args.length === 3 ? args.pop() : false;
    const uploadFn = largeUpload
        ? cloudinary.v2.uploader.upload_large
        : cloudinary.v2.uploader.upload;
    return new Promise((resolve, reject) => {
        uploadFn(...args, (err, res) => {
            if (err)
                reject(err);
            else
                resolve(res);
        });
    });
}
exports.upload = upload;
exports.folderName = 'wedding-day-app';
exports.default = cloudinary;
//# sourceMappingURL=cloudinary.js.map