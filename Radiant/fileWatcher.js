require('dotenv').config();
const Logger = require('../node_core_logger');
const { spawn } = require('child_process');
const fs = require('fs-extra');
const readLastLines = require('read-last-lines');
const insertLine = require('insert-line');
const chokidar = require('chokidar');
const _ = require('lodash');

const AWS = require('../aws_util/aws-util');
const axiosHandler = require('./axiosHandler');

const S3Bucket = {
    LOCAL: process.env.DEV_S3_BUCKET,
    DEV: process.env.DEV_S3_BUCKET,
    STAGING: process.env.STAGING_S3_BUCKET,
    PRODUCTION: process.env.PRODUCTION_S3_BUCKET,
    FAMIFI_PROD: process.env.FAMIFI_PRODUCTION_S3_BUCKET,
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
            state: 'STREAMING',
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
            streamTracker[path].uuid = args.uuid;
            streamTracker[path].app = args.app;
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
    setTimeout(() => {
        fs.remove(ouPath, (err) => {
            if(err){
                Logger.log(err);
            }
            const checkPath = ouPath.substring(2,ouPath.length);
            _.each(streamTracker, (item, key) => {
                if(key.match(checkPath)){
                    if(_.has(streamTracker[streamTracker[key].uuid], 'errors') && streamTracker[streamTracker[key].uuid].errors.length > 0){
                        Logger.log(`Errors collected: ${streamTracker[streamTracker[key].uuid].errors.length}`);
                        //TODO: call graphql and update errors if any  future iteration.
                        delete streamTracker[streamTracker[key].uuid];
                    }
                    delete streamTracker[streamTracker[key].uuid];
                    delete streamTracker[key];
                }
            });
        });
    }, process.env.TIMEOUT_TO_CLEANUP);
};

/**
 * checkM3U8
 * @param file
 */
const checkM3U8 = (file, info) => {
    fs.stat(file, (err) => {
        if(err === null) {
            readLastLines.read(file, 1).then((line) => {
                if(line === '#EXT-X-ENDLIST\n'){
                    uploadFile(info, true);
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
            const sayApp = _.has(streamTracker[info.path], 'app');
            const prodUrl = sayApp && streamTracker[info.path].app === 'say' ? S3Bucket[process.env.ENV] : S3Bucket['FAMIFI_PROD'];
            //upload files
            let params = {
                Bucket: prodUrl,
                Key: info.key ? info.key : info.path.replace(/^.*[\\\/]/, ''),
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
                    const thumbnailKey = data.Key.split('-')[0];
                    const segment = data.Key.split('-')[1];
                    if(ext === 'm3u8' && _.has(streamTracker[info.path], 'm3u8') && !streamTracker[info.path].m3u8){
                        streamTracker[info.path].m3u8 = true;
                        setTimeout(() => {
                            Logger.log(`CREATING VIDEO STREAM - conversationTopicId = ${streamTracker[info.path].conversationTopicId} fileKey = ${info.path.replace(/^.*[\\\/]/, '')} `);
                            axiosHandler.createRtmpVideo(streamTracker[info.path].conversationTopicId, data.Key, thumbnailKey, streamTracker[info.path].uuid, streamTracker[info.path].authToken, streamTracker[info.path].app).then((results) => {
                                Logger.log(`Video Created - Thumbnail location => ${results.vidData.conversationTopic.createRtmpVideo.thumbnailUrl}`);
                                Logger.log(`Video Created - Video location => ${results.vidData.conversationTopic.createRtmpVideo.streamsConnection.streams[0].downloadUrl.url}`);


                            }).catch((err) => {
                                Logger.log(err);
                                streamTracker[info.uuid].state = 'ERROR';
                                streamTracker[info.uuid].errors.push(err);
                            });
                        }, process.env.TIMEOUT_TO_CREATE_VIDEO_OBJECT);
                    }

                    const seg = segment.substr(1,segment.length);
                    const seggy = seg.split('.')[0];
                    if(parseFloat(process.env.THUMBNAIL_SEGMENT) === parseFloat(seggy)) {
                        createThumbnail(mainPath, thumbnailKey, info.uuid, streamTracker[info.path].app, 0).catch((err) => {
                            Logger.error(err);
                        });
                    }

                    const m3u8 = data.Key.split('-')[0];
                    if(ext === 'ts'){
                        makeCopy(`${mainPath}/${m3u8}-i.m3u8`, `${mainPath}/${m3u8}-copy-i.m3u8`).then((destination) => {
                            // upload m3u8 to keep it updated
                            uploadFile({
                                key: `${mainPath}/${m3u8}-i.m3u8`.replace(/^.*[\\\/]/, ''),
                                path: destination,
                                authToken: info.authToken,
                                conversationTopicId: info.conversationTopicId,
                                uuid: info.uuid,
                            }, false);
                        }).catch(err => {
                            Logger.error(err);
                        });

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
                        checkM3U8(`${mainPath}/${m3u8}-i.m3u8`, info);
                    }
                }
            });
        } else {
            Logger.error(`File not found ${err} aborting upload`);
        }
    });
};

/**
 * makeCopy
 * @param source
 * @param destination
 * @returns {PromiseLike<T | T | never> | Promise<T | T | never>}
 */
const makeCopy = function(source, destination) {
    return new Promise((resolve, reject) => {
        fs.copyFile(source, destination).then(() => {
            // insert #EXT-X-START:TIME-OFFSET=0 at line 5 so we start at beginning and not from 'live'
            // or most recent segment
            insertLine(destination).content('#EXT-X-START:TIME-OFFSET=0').at(5).then((err) => {
                if(err) {
                    Logger.error(err);
                    reject(err);
                    return;
                }
                resolve(destination);
            });
        });
    });
};

/**
 * uploadThumbnail
 * @param thumb
 * @param videoPath
 * @param fileKey
 * @param uuid
 * @param app
 * @param retry
 */
const uploadThumbnail = function(thumb, videoPath, fileKey, uuid, app, retry){
    return new Promise((resolve, reject) => {
        fs.stat(thumb, (err) => {
            if(err === null) {
                const prodUrl = app === 'say' ? S3Bucket[process.env.ENV] : S3Bucket['FAMIFI_PROD'];
                const params = {
                    Bucket: prodUrl,
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
                    }
                });
            } else {
                Logger.error(`File not found ${err} aborting thumbnail upload`);
                Logger.log(`Retrying Thumbnail Upload for ${fileKey} thumb: ${thumb}`);
                retry++;
                if(retry <= 3){
                    Logger.log(`uploadThumbnail authToken: ${JSON.stringify(authToken)}`);
                    return uploadThumbnail(thumb, videoPath, fileKey, retry);
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
 * @param uuid
 * @param app
 * @param retry
 */
const createThumbnail = function(mainPath, fileKey, uuid, app, retry) {
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
                    Logger.error(`Thumbnail ERROR => FFMPEG Creating Thumbnail Failed: ${e}`);
                    Logger.log(`Thumbnail Retry => ${retry}`);
                    retry++;
                    if(retry < 3) {
                        return createThumbnail(mainPath, fileKey, uuid, app, retry);
                    } else {
                        Logger.error(`Thumbnail ERROR on multiple retries aborting => FFMPEG Creating Thumbnail Failed: ${e}`);
                        reject(`Thumbnail ERROR => : ${e}`);
                    }
                });
                ffmpegSpawn.stdout.on('data', (d) => {
                    // Logger.log(`Thumbnail: ${d}`);
                });
                ffmpegSpawn.stderr.on('data', (d) => {
                    // Logger.log(`Thumbnail: ${d}`);
                });
                ffmpegSpawn.on('close', (c) => {
                    Logger.log(`Thumbnail Close: ${c}`);
                    if(c === 1 && retry < 3){
                        retry++;
                        return createThumbnail(mainPath, fileKey, uuid, app, retry);
                    } else {
                        fs.stat(thumbnailPath, (err, fileInfo) => {
                            if(err === null){
                                if(fileInfo.size > 0){
                                    return uploadThumbnail(thumbnailPath, videoPath, fileKey, uuid, app, 0);
                                } else {
                                    Logger.debug(`Thumbnail ERROR => File Not Finished : ${fileInfo.size}`);
                                    reject(`Thumbnail ERROR => : ${err}`);
                                }
                            } else {
                                Logger.error(`Thumbnail ERROR => No Thumbnail File: ${err}`);
                                reject(`Thumbnail ERROR => : ${err}`);
                                retry++;
                                if(retry < 3) {
                                    return createThumbnail(mainPath, fileKey, uuid, app, retry);
                                } else {
                                    Logger.error(`Thumbnail ERROR on multiple retries aborting => No Thumbnail File: ${e}`);
                                    reject(`Thumbnail ERROR => : ${e}`);
                                }
                            }
                        });
                    }
                });
            } else {
                Logger.error(`Thumbnail => No Video File: ${err}`);
                retry++;
                if(retry < 3) {
                    return createThumbnail(mainPath, fileKey, uuid, app, retry);
                } else {
                    Logger.error(`Thumbnail ERROR on multiple retries aborting => No Video File: ${e}`);
                    reject(`Thumbnail ERROR => No Video File: ${err}`);
                }
            }
        });
    });
};
