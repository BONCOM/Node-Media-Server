require('dotenv').config();

const { spawn } = require('child_process');
const fs = require('fs');
const readLastLines = require('read-last-lines');
const chokidar = require('chokidar');

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
    // console.log(`watcher started for : ${ouPath}`);
    const authToken = args.token;

    fs.mkdir(ouPath, (err) => {
        if(err){
            // console.log(`Error Creating directory: ${err}`);
        }
    //     const mainPath = ouPath.substring(2,ouPath.length);
    //     watchers[mainPath] = chokidar.watch(ouPath);
    //     watchers[mainPath].on('add', function (path) {
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
            // console.log(`TOPIC = ${args.conversationTopicId}`);
            checkFile({
                path,
                conversationTopicId: args.conversationTopicId,
                authToken,
            }, 0);
        });
    });
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
                    // console.log(`#EXT-X-ENDLIST => ${file}`);
                    // console.log(`Deleting file => ${file}`);
                    uploadFile({
                        path: file,
                    }, true);
                } else {
                    // for debugging
                    // console.log('NOT END OF STREAM');
                }
            });
        } else {
            console.log(`File not found ${err}`);
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
    if(ext === 'm3u8'){
        uploadFile(info, false);
    } else {
        fs.stat(info.path, (err, fileInfo) => {
            if(err === null) {
                if(fileInfo.size === previousSize && fileInfo.size > 0) {
                    uploadFile(info, false);
                } else {
                    checkFile(info, fileInfo.size);
                }
            }  else {
                console.log(`File not found ${err}`);
            }
        });
    }
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
                    console.log(`Error Uploading FILE to S3: ${err}`);
                } else {
                    // console.log(`${data.Key} uploaded to: ${data.Bucket}`);
                    const pathFind = info.path.match(/^(.*[\\\/])/);
                    const mainPath = pathFind[0].substr(0, pathFind[0].length - 1);
                    try{
                        if(ext === 'm3u8' && !streamTracker[info.path].m3u8){
                            streamTracker[info.path].m3u8 = true;
                            // console.log(`-=*[ CREATING VIDEO STREAM ]*=-`);
                            console.log(`-=*[ CREATING VIDEO STREAM conversationTopicId = ${info.conversationTopicId} fileKey = ${info.path.replace(/^.*[\\\/]/, '')} ]*=-`);
                            // console.log(`-=*[ auth token = ${info.authToken} ]*=-`);
                            return axiosHandler.createVideoStream(info.conversationTopicId, info.authToken)
                                .then((vidData) => axiosHandler.updateVideoStream(vidData, data.Key, mainPath, info.authToken)
                                    .then((res) => {
                                        console.log(`-=*[ StreamID = : ${res.videoStreamData.liveStream.updateStream.id} ]*=-`);
                                        console.log(`-=*[ Stream downloadUrl : ${res.videoStreamData.liveStream.updateStream.downloadUrl.url} ]*=-`);
                                        // createThumbnail(mainPath, `${data.Key.split('-')[0]}`, info.authToken, res.vidData.conversationTopic.createConversationTopicVideo.video.id, 0);
                                    })).catch((err => {
                                console.log(err);
                            }));
                        }
                    } catch (e) {
                        // console.log(`ERROR: ${e.message} not too big of a deal :D`);
                    }
                    const m3u8 = data.Key.split('-')[0];
                    if(ext === 'ts'){
                        // upload m3u8 to keep it updated
                        // console.log(`-=*[ Updating - conversationTopicId = ${info.conversationTopicId} fileKey = ${m3u8} ]*=-`);
                        uploadFile({
                            path: `${mainPath}/${m3u8}-i.m3u8`,
                            authToken: info.authToken,
                            conversationTopicId: info.conversationTopicId,
                        }, false);
                        // console.log(`-=*[ UPDATE: uploading file: ${mainPath}/${m3u8}-i.m3u8 ]*=-`);
                        // delete ts file
                        // console.log(`deleting file => ${info.path}`);
                        if(info.path === `${mainPath}/${m3u8}-i0.ts`){
                            // dont delete we use this file for thumbnail
                        } else {
                            fs.stat(info.path, (err) => {
                                if(err === null) {
                                    fs.unlink(info.path, (err, data) => {
                                        if(err){
                                            console.log(`ERROR: File Not Found ${err.message}`);
                                        }
                                        delete streamTracker[info.path];
                                    });
                                } else {
                                    // console.log(`File not found ${err}`);
                                }
                            });
                        }
                    } else if(ext === 'm3u8' && !endStream){

                        checkM3U8(`${mainPath}/${m3u8}-i.m3u8`);
                    }
                    // endstream we delete the m3u8 after it has been finalized
                    if(endStream) {
                        console.log(`STREAM END = Deleting File: ${mainPath}/${m3u8}-i.m3u8}`);
                        fs.unlink(`${mainPath}/${m3u8}-i.m3u8`, (err) => {
                            if(err){
                                console.log(`ERROR: STREAM END: File Not Found ${err.message}`);
                            }
                            delete streamTracker[`${mainPath}/${m3u8}-i.m3u8`];
                            // watcher.close();
                        });
                    }
                }
            });
        } else {
            console.log(`File not found ${err} aborting upload`);
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
const uploadThumbnail = function(thumb, videoPath, fileKey, authToken, videoId, retry){
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
                    console.log(`ERROR uploading THUMBNAIL to S3: ${err}`);
                } else {
                    console.log(data);
                    // update thumbnail on video record
                    return axiosHandler.updateVideo(videoId, data.Location, authToken).then((data) => {
                        console.log(`VIDEO UPDATED SUCCESS => ${data.data.data.updateVideo.id}`);

                        // delete thumbnail
                        fs.unlink(thumb, (err) => {
                            if(err){
                                console.log(`Error Deleting thumbnail for ${fileKey}: ${err}`);
                            }
                        });
                        // delete thumbnail video file reference
                        fs.unlink(videoPath, (err) => {
                            if(err){
                                console.log(`Error Deleting video reference for thumbnail: ${videoPath}: ${err}`);
                            }
                            delete streamTracker[videoPath];
                        });
                        return 'Success';
                    }).catch((err) => {
                        console.log(`UPDATE VIDEO ERROR: ${err}`);
                    });
                }
            });
        } else {
            console.log(`File not found ${err} aborting thumbnail upload`);
            console.log(`Retrying Thumbnail Upload for ${fileKey} thumb: ${thumb}`);
            retry++;
            if(retry <= 3){
                return uploadThumbnail(thumb, videoPath, fileKey, authToken, videoId, retry);
            } else {
                console.log('UPLOAD THUMBNAIL: ERROR out of retrys ');
            }
        }
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
const createThumbnail = function(mainPath, fileKey, authToken, videoId, retry) {
    console.log(`-=*[ Thumbnail Creation ]*=-  ${fileKey}`);
    const thumbnailPath = `media/thumbnails/${fileKey}.png`;
    const videoPath = `${mainPath}/${fileKey}-i0.ts`;
    setTimeout(() =>{
    fs.stat(videoPath, (err, data) => {
       if(err === null){
           const argv = [
               '-i',
               videoPath,
               '-ss',
               '00:00:01',
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
               console.log(`-=*[ Thumbnail => Error Creating Thumbnail: ${e} ]*=-`);
           });
           ffmpegSpawn.stdout.on('data', (d) => {
               // console.log(`Thumbnail: ${d}`);
           });
           ffmpegSpawn.stderr.on('data', (d) => {
               // console.log(`Thumbnail: ${d}`);
           });
           ffmpegSpawn.on('close', (c) => {
               console.log(`-=*[ Thumbnail Close: ${c} ]*=-`);
               fs.stat(thumbnailPath, (err) => {
                  if(err === null){
                      return uploadThumbnail(thumbnailPath, videoPath, fileKey, authToken, videoId, 0);
                  } else {
                      retry++;
                      if (retry <= 3) {
                          createThumbnail(mainPath, fileKey, retry);
                      } else {
                          uploadThumbnail(thumbnailPath, videoPath, fileKey, authToken, videoId, 0);
                      }
                  }
               });
           });
       } else {
           console.log(`-=*[ Thumbnail => No Video File: ${err} ]*=-`);
       }
    });
    }, 1000);
};