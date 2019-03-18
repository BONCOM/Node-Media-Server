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

const createRtmpVideoQuery = gql`
    mutation createVideo($conversationTopicId: ID!, $m3u8Key: String!, $thumbnailKey: String!, $uuid: String) {
        conversationTopic {
            createRtmpVideo(input: {
                conversationTopicId: $conversationTopicId,
                conversationTopicPermissions: [FULL_CONTROL],
                m3u8Key: $m3u8Key,
                thumbnailKey: $thumbnailKey,
                clientUuid: $uuid
            }) {
                id
                thumbnailUrl
                streamsConnection{
                    streams{
                        id
                        downloadUrl{
                            url
                        }
                    }
                }
            }
        }
    }  
`;

module.exports = {
    /**
     * createRtmpVideo
     * @param conversationTopicId
     * @param m3u8Key
     * @param thumbnailKey
     * @param uuid
     * @param authToken
     * @returns {PromiseLike<{vidData: *, authToken: *} | never> | Promise<{vidData: *, authToken: *} | never>}
     */
    createRtmpVideo: (conversationTopicId, m3u8Key, thumbnailKey, uuid, authToken) => {
        const options = {
            headers: {
                Accept: "application/json",
                subauth: `Bearer ${authToken}`,
                "Content-Type": "application/json"
            }
        };
        const variables = {
            conversationTopicId,
            m3u8Key,
            thumbnailKey,
            uuid,
        };
        let endpoint = radiantBackendEndpoints[process.env.ENV];
        return axios.post(endpoint, {
            query: print(createRtmpVideoQuery),
            variables,
        }, options).then((results) => {
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
};



