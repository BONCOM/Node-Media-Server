# RADIANT NODE MEDIA SERVER

## Configuration

.env file in base project directory like `Node-Media-Server/.env`

example

```
  SHARED_SECRET="SECRET"
  AWS_ACCESS_KEY="key"
  AWS_SECRET_ACCESS_SECRET="secret"
  HTTPS_PORT=8443
  HTTP_PORT=8000
  RTMP_PORT=1935
  ENV="LOCAL"
  SECURE_PLAY=true
  SECURE_PUBLISH=true
  API_USER="user"
  API_PASSWORD="password"
  FFMPEG_PATH="/usr/local/bin/ffmpeg"
  SEGMENT_LENGTH=1
  TIMEOUT_TO_CLEANUP=5000
  THUMBNAIL_SEGMENT=0
```

## Running Server

`npm start` or `node app.js`

## Using Server

### RTMP UP

javascript example signing url
```
// server
const expiration = moment().add(5, 'minutes').unix();
const uuid = 123;
const token = JWT web token without the Bearer
const HashValue = MD5(`/radiant/${uuid}-${expiration}-${config.auth.secret}`);
console.log(`Expiration Value = ${expiration} = ${moment.unix(expiration)}`);
console.log(`Hash Value = ${HashValue.toString()}`);
console.log(`Request Address looks like = rtmp://media.server.url/radiant/${uuid}?sign=${expiration}-${HashValue}&token=${token}&uuid=${uuid}&app=say`);

```

example of how your publishing url should look.

```
rtmp://localhost/radiant/123?sign=1549059252-84c5c395681132c0cb3d7687d58cf38b&token=84c5c395681132c0cb3d7687d58cf38b&uuid=123&app=say
```

 #### Anatomy of our RTMP URL
 
 rtmp = Real-Time Messaging Protocol [rtmp](https://en.wikipedia.org/wiki/Real-Time_Messaging_Protocol)  

 radiant = app specific streams. 
 
 123 = the uuid which is generated app side
 
 URL Parameters:

`sign` = security part of our url.. prevents from having just anyone start publishing their video.

`token` = JWT token need to allow us to connect to radiant backend

 With the same url someone can watch the stream as its still live.  
