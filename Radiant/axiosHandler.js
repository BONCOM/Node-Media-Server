require('dotenv').config();

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
            console.log('-=*[ CREATED VIDEO STREAM ]*=-');
            // console.log(`-=*[ Conversation Topic Id = ${conversationTopicId} ]*=-`);
            // console.log(`-=*[ Video Id = ${results.data.data.conversationTopic.createConversationTopicVideo.video.id} ]*=-`);
            // console.log(`-=*[ Video Stream Id = ${results.data.data.conversationTopic.createConversationTopicVideo.videoHLSStreamUpload.id} ]*=-`);
            return results.data.data;
        });
    },
    /**
     * updateVideoStream
     * @param vidData
     * @param mainPath
     * @param authToken
     * @returns {Promise<T | never>}
     */
    updateVideoStream: (vidData, key, mainPath, authToken) => {
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

        console.log(`-=*[ UPDATING VIDEO STREAM ]*=-`);
        // console.log(`-=*[ key = ${key} ]*=-`);
        // i have thumbnail upload url here
        return axios.post(endpoint, {
            query: print(videoStreamQuery),
            variables,
        }, options).then((results) => {
            console.log('-=*[ UPDATED VIDEO STREAM ]*=-');
            console.log(`-=*[ m3u8 : ${results.data.data.liveStream.updateStream.downloadUrl.url} ]*=-`);
            return {
                vidData,
                videoStreamData: results.data.data
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

        console.log(`-=*[ UPDATING VIDEO ]*=-`);
        console.log(`-=*[ VideoId = ${videoId} ]*=-`);
        // i have thumbnail upload url here
        return axios.post(endpoint, {
            query: print(updateVideoQuery),
            variables,
        }, options).then((results) => {
            console.log('-=*[ UPDATED VIDEO ]*=-');
            console.log(`-=*[ Video Id : ${results.data.data.updateVideo.id} ]*=-`);
            console.log(`-=*[ Thumbnail Url: ${thumbnailUrl} ]*=-`);
            return results;
        });
    },
};



