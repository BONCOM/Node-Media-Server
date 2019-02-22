require('dotenv').config();
const Logger = require('../node_core_logger');
const axios = require('axios');
const gql = require('graphql-tag');
const { print } = require('graphql');

const radiantBackendEndpoints = {
    LOCAL: process.env.LOCAL_RADIANT_BACKEND_SERVER,
    DEV: process.env.DEV_RADIANT_BACKEND_SERVER,
    STAGING: process.env.STAGING_RADIANT_BACKEND_SERVER,
    PRODUCTION: process.env.PRODUCTION_RADIANT_BACKEND_SERVER,
};


const query = gql`
    mutation createCTVide($location: String, $conversationTopicId: ID!){
        conversationTopic{
            createConversationTopicVideo(input:{
                location: $location,
                conversationTopicId:$conversationTopicId,
                conversationTopicPermissions:[READ, WRITE]
            }){
                video{
                    id
                }
                videoHLSStreamUpload(sendSubscriptionEvent: false){
                    id
                    segments{
                        id
                        uploadUrl{
                            url
                        }
                    }
                }
                thumbnailUploadUrl{
                    url
                }
            }
        }
    }
`;


const videoStreamQuery = gql`
    mutation updateStream($id: ID!, $m3u8Key: String!){
        liveStream{
            updateStream(input:{
                id: $id,
                m3u8Key: $m3u8Key
            }){
                id
                downloadUrl{
                    url
                }
            }
        }
    }
`;

const updateVideoQuery = gql`
    mutation updateVideo($id: ID!, $thumbnail: String!){
        updateVideo(input:{
            id:$id
            thumbnailUrl:$thumbnail
        }){
            id
            thumbnailUrl
        }
    }
`;


module.exports = {
    /**
     * createVideoStream
     * @param conversationTopicId
     * @param authToken
     * @returns {Promise<T | never>}
     */
    createVideoStream: (conversationTopicId, authToken) => {
        Logger.log('CREATE VIDEO STREAM START');
        const options = {
            headers: {
                Accept: "application/json",
                subauth: `Bearer ${authToken}`,
                "Content-Type": "application/json"
            }
        };
        const variables = {
            location: 'test location',
            conversationTopicId,
        };
        let endpoint = radiantBackendEndpoints[process.env.ENV];
        return axios.post(endpoint, {
            query: print(query),
            variables,
        }, options).then((results) => {
            Logger.log('CREATE VIDEO STREAM END');
            if(results.data.errors && results.data.errors.length > 0){
                throw JSON.stringify(results.data.errors[0]);
            }
            Logger.log('CREATED VIDEO STREAM');
            return {
                vidData: results.data.data,
                authToken,
            };
        });
    },
    /**
     * updateVideoStream
     * @param vidData
     * @param key
     * @param mainPath
     * @param authToken
     * @returns {Promise<T | never>}
     */
    updateVideoStream: (vidData, key, mainPath, authToken) => {
        Logger.log('UPDATE VIDEO STREAM START');
        const options = {
            headers: {
                Accept: "application/json",
                subauth: `Bearer ${authToken}`,
                "Content-Type": "application/json"
            }
        };
        const variables = {
            id: vidData.conversationTopic.createConversationTopicVideo.videoHLSStreamUpload.id,
            m3u8Key: key,
        };
        let endpoint = radiantBackendEndpoints[process.env.ENV];

        Logger.log(`UPDATING VIDEO STREAM`);
        // i have thumbnail upload url here
        return axios.post(endpoint, {
            query: print(videoStreamQuery),
            variables,
        }, options).then((results) => {
            Logger.log('UPDATE VIDEO STREAM END');
            if(results.data.errors && results.data.errors.length > 0){
                throw JSON.stringify(results.data.errors[0]);
            }
            Logger.log('UPDATED VIDEO STREAM');
            Logger.log(`m3u8 : ${results.data.data.liveStream.updateStream.downloadUrl.url}`);
            return {
                vidData,
                videoStreamData: results.data.data,
                authToken,
            };
        });
    },
    /**
     * updateVideo
     * @param videoId
     * @param thumbnailUrl
     * @param authToken
     * @returns {Promise<T | never>}
     */
    updateVideo: (videoId, thumbnailUrl, authToken) => {
        Logger.log('UPDATING VIDEO => RADIANT BACKEND');
        const options = {
            headers: {
                Accept: "application/json",
                subauth: `Bearer ${authToken}`,
                "Content-Type": "application/json"
            }
        };
        const variables = {
            id: videoId,
            thumbnail: thumbnailUrl,
        };
        let endpoint = radiantBackendEndpoints[process.env.ENV];

        Logger.log(`UPDATING VIDEO`);
        Logger.log(`VideoId = ${videoId}`);
        // i have thumbnail upload url here
        return axios.post(endpoint, {
            query: print(updateVideoQuery),
            variables,
        }, options).then((results) => {
            Logger.log('DONE UPDATED VIDEO => RADIANT BACKEND');
            if(results.data.errors && results.data.errors.length > 0){
                throw JSON.stringify(results.data.errors[0]);
            }
            Logger.log('UPDATED VIDEO');
            Logger.log(`Video Id : ${results.data.data.updateVideo.id}`);
            Logger.log(`Thumbnail Url: ${thumbnailUrl}`);
            return results;
        });
    },
};



