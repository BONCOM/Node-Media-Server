const { NodeMediaServer } = require('./index');
const dotenv = require('dotenv').config();
const dotenvParseVariables = require('dotenv-parse-variables');

const SDC = require('statsd-client');

sdc = new SDC({
  host: process.env.STATS_HOST,
  port: process.env.PORT,
  prefix: 'NodeMediaServer',
});


if(dotenv.error){
  throw dotenv.error;
}
const env = dotenvParseVariables(dotenv.parsed);

const config = {
  rtmp: {
    port: process.env.RTMP_PORT,
    chunk_size: 60000,
    gop_cache: true,
    ping: 60,
    ping_timeout: 30
  },
  http: {
    port: process.env.HTTP_PORT,
    webroot: './public',
    mediaroot: './media',
    allow_origin: '*'
  },
  https: {
    port: process.env.HTTPS_PORT,
    key: './privatekey.pem',
    cert: './certificate.pem',
  },
  auth: {
    api: true,
    api_user: process.env.API_USER,
    api_pass: process.env.API_PASSWORD,
    play: env.SECURE_PLAY,
    publish: env.SECURE_PUBLISH, // enables sign parameter to be used for server
    secret: process.env.SHARED_SECRET,
  },
  trans: {
    ffmpeg: process.env.FFMPEG_PATH,
    tasks: [
        {
          app: 'radiant',
          hls: true,
          hlsFlags: `[hls_time=${process.env.SEGMENT_LENGTH}:hls_list_size=0]`,
        },
    ],
  },
  sdc,
};

let nms = new NodeMediaServer(config);
nms.run();

nms.on('preConnect', (id, args) => {
  console.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
  sdc.increment('preConnect.value', 1);
  // let session = nms.getSession(id);
  // session.reject();
});

nms.on('postConnect', (id, args) => {
  sdc.increment('postConnect.value', 1);
  console.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('doneConnect', (id, args) => {
  sdc.increment('doneConnect.value', 1);
  console.log('[NodeEvent on doneConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('prePublish', (id, StreamPath, args) => {
  sdc.increment('prePublish.value', 1);
  console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  // let session = nms.getSession(id);
  // session.reject();
});

nms.on('postPublish', (id, StreamPath, args) => {
  sdc.increment('postPublish.value', 1);
  console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePublish', (id, StreamPath, args) => {
  sdc.increment('donePublish.value', 1);
  console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('prePlay', (id, StreamPath, args) => {
  sdc.increment('prePlay.value', 1);
  console.log('[NodeEvent on prePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  // let session = nms.getSession(id);
  // session.reject();
});

nms.on('postPlay', (id, StreamPath, args) => {
  sdc.increment('postPlay.value', 1);
  console.log('[NodeEvent on postPlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePlay', (id, StreamPath, args) => {
  sdc.increment('donePlay.value', 1);
  console.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

