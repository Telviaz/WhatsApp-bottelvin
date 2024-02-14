const qrcode = require('qrcode');
// const { Client, MessageMedia } = require('whatsapp-web.js');
const { Client } = require('whatsapp-web.js');
const ytdl = require('ytdl-core');
const fs = require('fs');
const mime = require('mime-types');
const googleIt = require('google-it');
const weather = require('weather-js');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');

// Create a new client instance
let downloadProcess = null;

const downloadFolder = './downloads/';

// Ensure download folder exists
if (!fs.existsSync(downloadFolder)){
    fs.mkdirSync(downloadFolder);
}

// client.on('qr', async (qr) => {
//     // Generate and scan this code with your phone
//     console.log('QR code generated, scan it with your phone.');
//     qrcode.toFile('./qrcode.png', qr);
//     qrcode.toString(qr, { type: 'terminal' }, function (err, url) {
//         console.log(url);
//     });
// });
let sessionCfg;
if (fs.existsSync('./session.json')) {
    sessionCfg = require('./session.json');
}

const client = new Client({ puppeteer: { headless: true }, session: sessionCfg });

client.on('qr', async (qr) => {
    // Generate and scan this code with your phone
    console.log('QR code generated, scan it with your phone.');
    qrcode.toFile('./qrcode.png', qr);
    qrcode.toString(qr, { type: 'terminal' }, function (err, url) {
        console.log(url);
    });
});

client.on('authenticated', (session) => {
    console.log('AUTHENTICATED', session);
    sessionCfg=session;
    fs.writeFile('./session.json', JSON.stringify(session), function (err) {
        if (err) {
            console.error(err);
        }
    });
});


client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', async msg => {
    try {
        let command = msg.body.toLowerCase();
        if (command.startsWith('download video from')) {
            let url = command.split(' ')[3];
            let quality = command.includes('in high quality') ? 'highest' : 'lowest';
            downloadVideoOrAudio(url, 'video', quality, msg);
        } else if (command.startsWith('download audio from')) {
            let url = command.split(' ')[3];
            let quality = command.includes('in high quality') ? 'highest' : 'lowest';
            downloadVideoOrAudio(url, 'audio', quality, msg);
        } else if (command.startsWith('google for')) {
            let query = command.split(' ').slice(2).join(' ');
            googleIt({'query': query}).then(results => {
                msg.reply(results[0].link);
            }).catch(e => {
                msg.reply('An error occurred while searching.');
            });
        } else if (command.startsWith('what is the weather in')) {
            let city = command.split(' ').slice(5).join(' ');
            weather.find({search: city, degreeType: 'C'}, function(err, result) {
                if(err) msg.reply('An error occurred while fetching weather data.');
                else msg.reply(JSON.stringify(result, null, 2));
            });
        } else if (command === 'tell me a joke') {
            axios.get('https://official-joke-api.appspot.com/random_joke')
            .then(response => {
                msg.reply(`${response.data.setup}\n\n${response.data.punchline}`);
            })
            .catch(error => {
                msg.reply('An error occurred while fetching a joke.');
            });
        } else if (command === 'help') {
            msg.reply('You can ask me to:\n- "Download video from [YouTube URL] in high/low quality"\n- "Download audio from [YouTube URL] in high/low quality"\n- "Google for [search term]"\n- "What is the weather in [city]"\n- "Tell me a joke"');
        } else if (command === 'status') {
            if (downloadProcess) {
                msg.reply('Download is in progress.');
            } else {
                msg.reply('No download is currently in progress.');
            }
        } else if (command === 'stop') {
            if (downloadProcess) {
                downloadProcess.destroy();
                downloadProcess = null;
                msg.reply('Download stopped.');
            } else {
                msg.reply('No download is currently in progress.');
            }
        } else if (command === 'are you there') {
            msg.reply('Yes, I am here!');
        }
    } catch (err) {
        console.error(err);
        msg.reply('An error occurred.');
    }
});

async function downloadVideoOrAudio(url, format, quality, msg) {
    if (ytdl.validateURL(url)) {
        let info = await ytdl.getInfo(url);
        let videoFormat = ytdl.chooseFormat(info.formats, { quality: quality });
        if (videoFormat) {
            msg.reply('Starting download...');
            let filename = `${downloadFolder}video.${videoFormat.container}`;
            downloadProcess = ytdl(url, { format: videoFormat })
                .pipe(fs.createWriteStream(filename))
                .on('finish', () => {
                    if (format === 'audio') {
                        msg.reply('Download finished, converting to audio...');
                        let audioFilename = `${downloadFolder}audio.mp3`;
                        ffmpeg(filename)
                            .output(audioFilename)
                            .on('end', function() {
                                msg.reply('Conversion finished, sending audio...');
                                const media = MessageMedia.fromFilePath(audioFilename);
                                msg.reply(media);
                                downloadProcess = null;
                            })
                            .run();
                    } else {
                        msg.reply('Download finished, sending video...');
                        const media = MessageMedia.fromFilePath(filename);
                        msg.reply(media);
                        downloadProcess = null;
                    }
                });
        } else {
            msg.reply('No suitable format found.');
        }
    } else {
        msg.reply('Invalid URL.');
    }
}

client.initialize();