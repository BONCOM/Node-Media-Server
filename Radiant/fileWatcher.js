require('dotenv').config();
const Logger = require('../node_core_logger');
const { spawn } = require('child_process');
const fs = require('fs-extra');
const readLastLines = require('read-last-lines');
const chokidar = require('chokidar');
const _ = require('lodash');

const AWS = require('../aws_util/aws-util');
const axiosHandler = require('./axiosHandler');

const S3Bucket = {
    DEV: process.env.DEV_S3_BUCKET,
    STAGING: process.env.STAGING_S3_BUCKET,
    PRODUCTION: process.env.PRODUCTION_S3_BUCKET,
};

const streamTracker = {};
let watcher;

/**
 * watch
 * @param ouPath
 * @param args
 */
module.exports.watch = (ouPath, args) => {
    fs.mkdir(ouPath, (err) => {
        if(err){

        }
        streamTracker[args.uuid] = {
            status: 'STREAMING',
            errors: [],
        };
        watcher = chokidar.watch(ouPath, { ignored: '*.DS_Store', useFsEvents: false, usePolling: false, alwaysStat: true });
        watcher.on('add', function (path) {
            //check file
            streamTracker[path] = {
                retry: 0,
            };
            const ext = path.replace(/^.*[\\\/]/, '').split('.')[1];
            if(ext === 'm3u8'){
                streamTracker[path].m3u8 = false;
            }
            streamTracker[path].conversationTopicId = args.conversationTopicId;
            streamTracker[path].authToken = args.token;
            streamTracker[path].throttleCheck = _.throttle(checkFile, 250);
                streamTracker[path].throttleCheck({
                path,
                conversationTopicId: args.conversationTopicId,
                authToken: args.token,
                uuid: args.uuid,
            }, 0);
        });
    });
};

/**
 * end
 * @param ouPath
 */
module.exports.end = (ouPath) => {
    //TODO: Add logic to check video integrity and then retry the video.
    //TODO: call graphql and update errors if any.

    setTimeout(() => {
        fs.remove(ouPath, (err) => {
            if(err){
                Logger.log(err);
            }
            const checkPath = ouPath.substring(2,ouPath.length);
            _.each(streamTracker, (item, key) => {
                if(key.match(checkPath)){
                    delete streamTracker[key];
                }
            });
        })
    }, 30000);
};

/**
 * checkM3U8
 * @param file
 */
const checkM3U8 = (file) => {
    fs.stat(file, (err) => {
        if(err === null) {
            readLastLines.read(file, 1).then((line) => {
                if(line === '#EXT-X-ENDLIST\n'){
                    uploadFile({
                        path: file,
                    }, true);
                }
            }).catch(err => {
                Logger.error(err);
            });
        } else {
            Logger.log(`File not found ${err}`);
        }
    });
};

/**
 * checkFileAgain
 * @param info
 * @param previousSize
 */
const checkFile = function (info, previousSize){
    const ext = info.path.replace(/^.*[\\\/]/, '').split('.')[1];
    fs.stat(info.path, (err, fileInfo) => {
        if(err === null) {
            if(ext !== 'm3u8' && fileInfo.size === previousSize && fileInfo.size > 0) {
                uploadFile(info, false);
            } else {
                streamTracker[info.path].throttleCheck(info, fileInfo.size);
            }
        }  else {
            Logger.error(`File not found ${err}`);
        }
    });
};

/**
 * uploadFile
 * @param info
 * @param endStream
 */
const uploadFile = function (info, endStream){
    const ext = info.path.replace(/^.*[\\\/]/, '').split('.')[1];
    const mimeType = ext === 'ts' ? 'video/MP2T' : 'application/x-mpegURL';
    fs.stat(info.path, (err) => {
        if(err === null) {
            //upload files
            let params = {
                Bucket: S3Bucket[process.env.ENV],
                Key: info.path.replace(/^.*[\\\/]/, ''),
                Body: fs.createReadStream(info.path),
                ACL: 'public-read',
                ContentType: mimeType,
            };

            AWS.getS3().upload(params, (err, data) => {
                if(err){
                    Logger.error(`Error Uploading FILE to S3: ${err}`);
                    streamTracker[info.uuid].state = 'ERROR';
                    streamTracker[info.uuid].errors.push(err);
                } else {
                    const pathFind = info.path.match(/^(.*[\\\/])/);
                    const mainPath = pathFind[0].substr(0, pathFind[0].length - 1);
                    try{
                        if(ext === 'm3u8' && !streamTracker[info.path].m3u8){
                            streamTracker[info.path].m3u8 = true;
                            setTimeout(() => {
                                Logger.log(`CREATING VIDEO STREAM conversationTopicId = ${streamTracker[info.path].conversationTopicId} fileKey = ${info.path.replace(/^.*[\\\/]/, '')} `);
                                return axiosHandler.createVideoStream(streamTracker[info.path].conversationTopicId, streamTracker[info.path].authToken)
                                    .then((streamData) => axiosHandler.updateVideoStream(streamData.vidData, data.Key, mainPath, streamData.authToken)
                                        .then((res) => {
                                            Logger.log(`StreamID = : ${res.videoStreamData.liveStream.updateStream.id} `);
                                            Logger.log(`Stream downloadUrl : ${res.videoStreamData.liveStream.updateStream.downloadUrl.url} `);
                                            return createThumbnail(mainPath, `${data.Key.split('-')[0]}`, res.authToken, res.vidData.conversationTopic.createConversationTopicVideo.video.id, info.uuid, 0);
                                        })).catch((err => {
                                        Logger.log(err);
                                        streamTracker[info.uuid].state = 'ERROR';
                                        streamTracker[info.uuid].errors.push(err);
                                    }));
                            }, process.env.TIMEOUT_TO_CREATE_VIDEO_OBJECT);
                        }
                    } catch (e) {
                        Logger.log(`ERROR: ${e.message} not too big of a deal :D`);
                        streamTracker[info.uuid].state = 'ERROR';
                        streamTracker[info.uuid].errors.push(err);
                    }
                    const m3u8 = data.Key.split('-')[0];
                    if(ext === 'ts'){
                        // upload m3u8 to keep it updated
                        uploadFile({
                            path: `${mainPath}/${m3u8}-i.m3u8`,
                            authToken: info.authToken,
                            conversationTopicId: info.conversationTopicId,
                            uuid: info.uuid,
                        }, false);
                        // delete ts file
                        if(info.path === `${mainPath}/${m3u8}-i${process.env.THUMBNAIL_SEGMENT}.ts`){
                            // dont delete we use this file for thumbnail
                        } else {
                            fs.stat(info.path, (err) => {
                                if(err === null) {
                                    fs.unlink(info.path, (err, data) => {
                                        if(err){
                                            Logger.error(`ERROR: File Not Found ${err.message}`);
                                        }
                                        delete streamTracker[info.path];
                                    });
                                }
                            });
                        }
                    } else if(ext === 'm3u8' && !endStream){

                        checkM3U8(`${mainPath}/${m3u8}-i.m3u8`);
                    }
                    // endstream we delete the m3u8 after it has been finalized
                    if(endStream) {
                        Logger.log(`STREAM END = Deleting File: ${mainPath}/${m3u8}-i.m3u8}`);
                        fs.unlink(`${mainPath}/${m3u8}-i.m3u8`, (err) => {
                            if(err){
                                Logger.error(`ERROR: STREAM END: File Not Found ${err.message}`);
                            }
                            delete streamTracker[`${mainPath}/${m3u8}-i.m3u8`];
                        });
                    }
                }
            });
        } else {
            Logger.error(`File not found ${err} aborting upload`);
        }
    });
};

/**
 * uploadThumbnail
 * @param thumb
 * @param videoPath
 * @param fileKey
 * @param authToken
 * @param videoId
 * @param retry
 */
const uploadThumbnail = function(thumb, videoPath, fileKey, authToken, videoId, uuid, retry){
    return new Promise((resolve, reject) => {
        fs.stat(thumb, (err) => {
            if(err === null) {
                const params = {
                    Bucket: S3Bucket[process.env.ENV],
                    Key: fileKey,
                    Body: fs.createReadStream(thumb),
                    ACL: 'public-read',
                    ContentType: 'image/png',
                };
                // upload thumbnail
                AWS.getS3().upload(params, (err, data) => {
                    if(err){
                        Logger.error(`ERROR uploading Thumbnail to S3: ${err}`);
                        reject(err);
                    } else {
                        Logger.log('Uploaded Thumbnail');
                        // update thumbnail on video record
                        return axiosHandler.updateVideo(videoId, data.Location, authToken).then((data) => {
                            Logger.log(`Video Update Success => ${data.data.data.updateVideo.id}`);

                            // delete thumbnail
                            fs.unlink(thumb, (err) => {
                                if(err){
                                    Logger.error(`Error Deleting thumbnail for ${fileKey}: ${err}`);
                                }
                            });
                            // delete thumbnail video file reference
                            fs.unlink(videoPath, (err) => {
                                if(err){
                                    Logger.error(`Error Deleting video reference for thumbnail: ${videoPath}: ${err}`);
                                }
                                delete streamTracker[videoPath];
                            });
                            resolve('success');
                        }).catch((err) => {
                            Logger.error(`Error Updating Video: ${err}`);
                            streamTracker[info.uuid].state = 'ERROR';
                            streamTracker[uuid].errors.push(`Error Updating Video: ${err}`);
                        });
                    }
                });
            } else {
                Logger.error(`File not found ${err} aborting thumbnail upload`);
                Logger.log(`Retrying Thumbnail Upload for ${fileKey} thumb: ${thumb}`);
                retry++;
                if(retry <= 3){
                    Logger.log(`uploadThumbnail authToken: ${JSON.stringify(authToken)}`);
                    return uploadThumbnail(thumb, videoPath, fileKey, authToken, videoId, retry);
                } else {
                    Logger.error('Upload Thumbnail: ERROR out of retrys ');
                    reject('Upload Thumbnail: ERROR out of retrys ');
                }
            }
        });
    });
};
/**
 * createThumbnail
 * @param mainPath
 * @param fileKey
 * @param authToken
 * @param videoId
 * @param retry
 */
const createThumbnail = function(mainPath, fileKey, authToken, videoId, uuid, retry) {
    return new Promise((resolve, reject) => {
        const thumbnailPath = `media/thumbnails/${fileKey}.png`;
        const videoPath = `${mainPath}/${fileKey}-i${process.env.THUMBNAIL_SEGMENT}.ts`;
        fs.stat(videoPath, (err, data) => {
            if(err === null){
                const argv = [
                    '-i',
                    videoPath,
                    '-ss',
                    '00:00:00.01',
                    '-c:v',
                    'mjpeg',
                    '-f',
                    'mjpeg',
                    '-vframes',
                    '1',
                    thumbnailPath,
                ];
                const ffmpegSpawn = spawn(process.env.FFMPEG_PATH, argv);
                ffmpegSpawn.on('error', (e) => {
                    Logger.log(`Thumbnail ERROR => FFMPEG Creating Thumbnail Failed: ${e}`);
                    reject(`Thumbnail ERROR => : ${err}`);
                });
                ffmpegSpawn.stdout.on('data', (d) => {
                    // Logger.log(`Thumbnail: ${d}`);
                });
                ffmpegSpawn.stderr.on('data', (d) => {
                    // Logger.log(`Thumbnail: ${d}`);
                });
                ffmpegSpawn.on('close', (c) => {
                    Logger.log(`Thumbnail Close: ${c}`);
                    fs.stat(thumbnailPath, (err, fileInfo) => {
                        if(err === null){
                            if(fileInfo.size > 0){
                                return uploadThumbnail(thumbnailPath, videoPath, fileKey, authToken, videoId, uuid, 0);
                            } else {
                                Logger.debug(`Thumbnail ERROR => File Not Finished : ${fileInfo.size}`);
                                reject(`Thumbnail ERROR => : ${err}`);
                                // retry thumbnail upload
                            }
                        } else {
                            Logger.error(`Thumbnail ERROR => No Thumbnail File: ${err}`);
                            reject(`Thumbnail ERROR => : ${err}`);
                        }
                    });
                });
            } else {
                Logger.error(`Thumbnail => No Video File: ${err}`);
                reject(`Thumbnail ERROR => No Video File: ${err}`);
            }
        });
    });
};