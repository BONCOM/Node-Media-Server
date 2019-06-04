require('dotenv').config();
const Logger = require('../node_core_logger');
const axios = require('axios');
const gql = require('graphql-tag');
const { print } = require('graphql');

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
     * @param app
     * @returns {PromiseLike<{vidData: *, authToken: *} | never> | Promise<{vidData: *, authToken: *} | never>}
     */
    createRtmpVideo: (conversationTopicId, m3u8Key, thumbnailKey, uuid, authToken, app) => {
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

        return axios.post(process.env.RADIANT_BACKEND_SERVER, {
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
